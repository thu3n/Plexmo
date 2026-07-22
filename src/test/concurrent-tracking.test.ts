import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() }; // fully migrated, incl. v13 (stream_peaks)
});

import { db } from "@/lib/db";
import type { PlexSession } from "@/lib/plex";
import type { ConcurrentSnapshotRow, StreamPeakRow } from "@/lib/db-types";
import {
    recordConcurrent,
    getWindowPeak,
    getAllTimePeak,
    GLOBAL_PEAK_SCOPE,
} from "@/lib/stats/concurrent";

const session = (serverId: string, key: string): PlexSession =>
    ({ id: `${serverId}:${key}`, serverId, user: "elias", title: `Title ${key}` }) as PlexSession;

const snapshots = (): ConcurrentSnapshotRow[] =>
    db.prepare("SELECT * FROM concurrent_snapshots ORDER BY id").all() as ConcurrentSnapshotRow[];

const peak = (scope: string): StreamPeakRow | undefined =>
    db.prepare("SELECT * FROM stream_peaks WHERE scope = ?").get(scope) as StreamPeakRow | undefined;

beforeEach(() => {
    db.prepare("DELETE FROM concurrent_snapshots").run();
    db.prepare("DELETE FROM stream_peaks").run();
});

describe("recordConcurrent (writer)", () => {
    it("writes one global row plus one row per server, and matching peaks", () => {
        recordConcurrent([session("a", "1"), session("a", "2"), session("b", "9")], 1000);

        const rows = snapshots();
        expect(rows).toHaveLength(3);
        expect(rows.find((r) => r.serverId === null)).toMatchObject({ count: 3, timestamp: 1000 });
        expect(rows.find((r) => r.serverId === "a")).toMatchObject({ count: 2 });
        expect(rows.find((r) => r.serverId === "b")).toMatchObject({ count: 1 });

        expect(peak(GLOBAL_PEAK_SCOPE)).toMatchObject({ count: 3, timestamp: 1000 });
        expect(peak("a")).toMatchObject({ count: 2 });
        expect(peak("b")).toMatchObject({ count: 1 });
    });

    it("dedups per scope: unchanged set adds no rows, a one-server change writes only that scope + global", () => {
        const set = [session("a", "1"), session("b", "9")];
        recordConcurrent(set, 1000);
        recordConcurrent(set, 2000); // identical — nothing new
        expect(snapshots()).toHaveLength(3);

        // Same count on server a but a different stream id — set comparison must catch it.
        recordConcurrent([session("a", "2"), session("b", "9")], 3000);
        const rows = snapshots();
        expect(rows).toHaveLength(5);
        expect(rows.filter((r) => r.serverId === "b")).toHaveLength(1);
        expect(rows.filter((r) => r.serverId === "a")).toHaveLength(2);
        expect(rows.filter((r) => r.serverId === null)).toHaveLength(2);
    });

    it("writes nothing when there are no sessions", () => {
        recordConcurrent([], 1000);
        expect(snapshots()).toHaveLength(0);
        expect(peak(GLOBAL_PEAK_SCOPE)).toBeUndefined();
    });

    it("keeps the peak monotonic and keeps the first timestamp on ties", () => {
        recordConcurrent([session("a", "1"), session("a", "2")], 1000);
        recordConcurrent([session("a", "1")], 2000); // drop — peak must not shrink
        expect(peak("a")).toMatchObject({ count: 2, timestamp: 1000 });

        recordConcurrent([session("a", "3"), session("a", "4")], 3000); // tie at 2
        expect(peak("a")).toMatchObject({ count: 2, timestamp: 1000 });

        recordConcurrent([session("a", "1"), session("a", "2"), session("a", "3")], 4000);
        expect(peak("a")).toMatchObject({ count: 3, timestamp: 4000 });
    });

    it("dedups against a legacy full-fat sessions blob via the id field", () => {
        db.prepare(
            "INSERT INTO concurrent_snapshots (count, sessions, timestamp, serverId) VALUES (?, ?, ?, NULL)"
        ).run(1, JSON.stringify([{ id: "a:1", user: "elias", title: "T", meta: { deep: true } }]), 500);

        recordConcurrent([session("a", "1")], 1000);
        // Global row deduped against the legacy blob; only the per-server row is new.
        expect(snapshots().filter((r) => r.serverId === null)).toHaveLength(1);
        expect(snapshots().filter((r) => r.serverId === "a")).toHaveLength(1);
    });
});

describe("getWindowPeak / getAllTimePeak (reader)", () => {
    it("windows on timestamp and prefers the earliest occurrence of the max", () => {
        recordConcurrent([session("a", "1"), session("a", "2")], 1000);
        recordConcurrent([session("a", "1")], 2000);
        recordConcurrent([session("a", "3"), session("a", "4")], 3000);

        expect(getWindowPeak({}, 0)).toMatchObject({ count: 2, timestamp: 1000 });
        expect(getWindowPeak({}, 1500)).toMatchObject({ count: 2, timestamp: 3000 });
        expect(getWindowPeak({}, 5000)).toEqual({ count: 0, timestamp: null });
    });

    it("scopes windows by serverId and by allowedServerIds without leaking", () => {
        recordConcurrent([session("a", "1"), session("a", "2"), session("b", "9")], 1000);

        expect(getWindowPeak({ serverId: "a" }, 0)).toMatchObject({ count: 2 });
        expect(getWindowPeak({ serverId: "b" }, 0)).toMatchObject({ count: 1 });
        // Scoped viewer: max over allowed per-server rows, not the global 3.
        expect(getWindowPeak({ allowedServerIds: ["b"] }, 0)).toMatchObject({ count: 1 });
        expect(getWindowPeak({ allowedServerIds: ["nope"] }, 0)).toEqual({ count: 0, timestamp: null });
    });

    it("reads all-time peaks from stream_peaks per scope", () => {
        recordConcurrent([session("a", "1"), session("a", "2"), session("b", "9")], 1000);
        recordConcurrent([session("b", "9")], 2000);

        expect(getAllTimePeak({})).toMatchObject({ count: 3, timestamp: 1000 });
        expect(getAllTimePeak({ serverId: "a" })).toMatchObject({ count: 2 });
        expect(getAllTimePeak({ allowedServerIds: ["a", "b"] })).toMatchObject({ count: 2 });
    });

    it("falls back to snapshots when the peaks row is missing, then to zero", () => {
        db.prepare(
            "INSERT INTO concurrent_snapshots (count, sessions, timestamp, serverId) VALUES (4, '[]', 700, NULL)"
        ).run();
        expect(getAllTimePeak({})).toMatchObject({ count: 4, timestamp: 700 });
        expect(getAllTimePeak({ serverId: "ghost" })).toEqual({ count: 0, timestamp: null });
    });
});
