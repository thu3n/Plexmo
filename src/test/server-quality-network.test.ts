import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { getRelayShare, relayWarning, MIN_RELAY_WARNING_PLAYS } from "@/lib/stats/server-quality-relay";
import { getWanLoad, peakSeries, pickGranularity, bucketLabel } from "@/lib/stats/server-quality-wan";
import {
    MAX_UPLOAD_CAPACITY_MBPS,
    getUploadCapacityMbps,
    parseUploadCapacity,
    setUploadCapacityMbps,
} from "@/lib/stats/server-quality-capacity";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Local midnight, so bucket boundaries are predictable in any TZ. */
const DAY0 = new Date(2026, 8, 20).getTime();
const NOW = DAY0 + 3 * DAY;

let seq = 0;
const insertPlay = (opts: {
    userId?: string;
    user?: string;
    serverId?: string;
    start: number;
    stop?: number;
    location?: string;
    relayed?: number | null;
    bandwidth?: number;
}) => {
    db.prepare(
        `INSERT INTO activity_history (id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration, location, relayed, bandwidth)
         VALUES (?, ?, ?, ?, 'T', '1', ?, ?, 60, ?, ?, ?)`
    ).run(
        `n-${seq++}`,
        opts.serverId ?? "srv-a",
        opts.userId ?? "u1",
        opts.user ?? "alice",
        opts.start,
        opts.stop ?? opts.start + HOUR,
        opts.location ?? "wan",
        opts.relayed === undefined ? 0 : opts.relayed,
        opts.bandwidth ?? 0,
    );
};

beforeEach(() => {
    seq = 0;
    db.prepare("DELETE FROM activity_history").run();
    db.prepare("DELETE FROM settings").run();
    db.prepare("DELETE FROM servers").run();
});

describe("getRelayShare", () => {
    it("computes relay share over WAN plays with a known flag, per user and server", () => {
        db.prepare(
            `INSERT INTO servers (id, name, baseUrl, token, createdAt, updatedAt) VALUES ('srv-a', 'Home', 'http://x', 't', '', ''), ('srv-b', 'Cabin', 'http://y', 't', '', '')`
        ).run();
        for (let i = 0; i < 3; i++) insertPlay({ start: DAY0 + i * HOUR, relayed: 1, userId: "u2", user: "bob", serverId: "srv-b" });
        insertPlay({ start: DAY0, relayed: 1, userId: "u1", user: "alice" });
        insertPlay({ start: DAY0, relayed: 0 });
        insertPlay({ start: DAY0, relayed: 0 });
        insertPlay({ start: DAY0, relayed: null }); // unknown: excluded from share
        insertPlay({ start: DAY0, relayed: 1, location: "lan" }); // LAN never counts

        const result = getRelayShare({ since: DAY0 - DAY, until: NOW });
        expect(result).toMatchObject({ wanPlays: 7, knownPlays: 6, relayed: 4, share: 67 });
        expect(result.users.map((u) => [u.user, u.relayed, u.share])).toEqual([["bob", 3, 100], ["alice", 1, 33]]);
        expect(result.servers.map((s) => s.name)).toEqual(["Cabin", "Home"]);
        expect(result.warning).toContain("67% of remote plays");
        expect(result.warning).toContain("worst: Cabin at 100%");

        expect(getRelayShare({ since: DAY0 - DAY, until: NOW, allowedServerIds: ["srv-a"] }).users.map((u) => u.user)).toEqual(["alice"]);
    });

    it("stays quiet below the play or share threshold", () => {
        expect(relayWarning(MIN_RELAY_WARNING_PLAYS - 1, 5)).toBeNull();
        expect(relayWarning(MIN_RELAY_WARNING_PLAYS, 1000)).toBeNull();
        expect(relayWarning(MIN_RELAY_WARNING_PLAYS, 10)).toContain("30%");
        expect(relayWarning(0, 0)).toBeNull();
    });
});

describe("peakSeries", () => {
    it("takes the concurrent peak per bucket and carries sessions across boundaries", () => {
        const points = peakSeries(
            [
                { start: DAY0 + 10 * MIN, stop: DAY0 + 50 * MIN, kbps: 4000 },
                { start: DAY0 + 20 * MIN, stop: DAY0 + 30 * MIN, kbps: 6000 },
                // Back-to-back with the next: must not stack.
                { start: DAY0 + HOUR, stop: DAY0 + HOUR + 30 * MIN, kbps: 3000 },
                { start: DAY0 + HOUR + 30 * MIN, stop: DAY0 + 3 * HOUR + 10 * MIN, kbps: 2000 },
            ],
            DAY0,
            DAY0 + 4 * HOUR,
            "hour",
        );
        expect(points.map((p) => [p.peakMbps, p.peakStreams])).toEqual([[10, 2], [3, 1], [2, 1], [2, 1]]);
        expect(points[0].bucket).toBe(bucketLabel(new Date(DAY0), "hour"));
    });

    it("trims leading empty buckets and clips intervals to the window", () => {
        const points = peakSeries([{ start: DAY0 - DAY, stop: DAY0 + 2 * DAY, kbps: 1500 }], DAY0 + DAY, DAY0 + 3 * DAY, "day");
        expect(points).toEqual([
            { bucket: bucketLabel(new Date(DAY0 + DAY), "day"), peakMbps: 1.5, peakStreams: 1 },
            { bucket: bucketLabel(new Date(DAY0 + 2 * DAY), "day"), peakMbps: 0, peakStreams: 0 },
        ]);
        expect(peakSeries([], DAY0, NOW, "day")).toEqual([]);
    });

    it("picks hour / day / month granularity by window length", () => {
        expect(pickGranularity(7)).toBe("hour");
        expect(pickGranularity(30)).toBe("day");
        expect(pickGranularity(730)).toBe("month");
        expect(bucketLabel(new Date(2026, 0, 5, 9), "hour")).toBe("2026-01-05 09:00");
        expect(bucketLabel(new Date(2026, 0, 5, 9), "month")).toBe("2026-01");
    });
});

describe("getWanLoad", () => {
    it("only counts WAN plays with bandwidth, including ones started before the window", () => {
        insertPlay({ start: DAY0 - 2 * HOUR, stop: DAY0 + HOUR, bandwidth: 5000 });
        insertPlay({ start: DAY0 + 2 * HOUR, bandwidth: 8000 });
        insertPlay({ start: DAY0 + 2 * HOUR, bandwidth: 9000, location: "lan" });
        insertPlay({ start: DAY0 + 2 * HOUR, bandwidth: 0 });

        const result = getWanLoad({ since: DAY0, until: DAY0 + DAY, granularity: "day" });
        expect(result).toMatchObject({ granularity: "day", peakMbps: 8, wanPlays: 2 });
        expect(result.points).toHaveLength(1);
        expect(getWanLoad({ since: DAY0, until: DAY0 + DAY, granularity: "day", serverId: "srv-b" }).points).toEqual([]);
    });
});

describe("upload capacity setting", () => {
    it("validates untrusted input", () => {
        expect(parseUploadCapacity(250)).toEqual({ ok: true, value: 250 });
        expect(parseUploadCapacity(null)).toEqual({ ok: true, value: null });
        expect(parseUploadCapacity("250").ok).toBe(false);
        expect(parseUploadCapacity(0).ok).toBe(false);
        expect(parseUploadCapacity(Number.NaN).ok).toBe(false);
        expect(parseUploadCapacity(MAX_UPLOAD_CAPACITY_MBPS + 1).ok).toBe(false);
    });

    it("round-trips and clears", () => {
        expect(getUploadCapacityMbps()).toBeNull();
        setUploadCapacityMbps(100);
        expect(getUploadCapacityMbps()).toBe(100);
        setUploadCapacityMbps(null);
        expect(getUploadCapacityMbps()).toBeNull();
    });
});
