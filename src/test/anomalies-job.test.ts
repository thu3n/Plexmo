import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

const { notifyAnomalies } = vi.hoisted(() => ({ notifyAnomalies: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications/anomaly-notify", () => ({ notifyAnomalies }));

import { db } from "@/lib/db";
import { runAnomalyScan, runAnomalyScanIfDue } from "@/lib/stats/anomalies-job";
import { ANOMALY_SCAN_LAST_RUN_KEY } from "@/lib/stats/anomalies-config";
import { collectNewClients, collectServerMetrics } from "@/lib/stats/anomalies-query";
import { ANOMALY_RETENTION_MS, REOPEN_GAP_MS, listAnomalies } from "@/lib/stats/anomalies-store";

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 8, 30, 12, 0, 0).getTime();

let seq = 0;
const play = (
    serverId: string,
    startTime: number,
    opts: { decision?: string | null; platform?: string; player?: string; user?: string } = {},
) => {
    const user = opts.user ?? "alice";
    db.prepare(
        `INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration,
            platform, player, transcode_decision
        ) VALUES (?, ?, ?, ?, 'T', '1', ?, ?, 600, ?, ?, ?)`
    ).run(
        `an-${seq++}`, serverId, user, user, startTime, startTime + 600_000,
        opts.platform ?? "Chrome", opts.player ?? "Browser", opts.decision === undefined ? "direct play" : opts.decision,
    );
};

const server = (id: string, disabled = false) =>
    db.prepare(
        `INSERT INTO servers (id, name, baseUrl, token, createdAt, updatedAt, disabledAt)
         VALUES (?, ?, 'http://x', 't', '2026-01-01', '2026-01-01', ?)`
    ).run(id, `Server ${id.toUpperCase()}`, disabled ? "2026-01-01" : null);

/** `perDay` plays on each of the 14 baseline days (ending `endAgo` before NOW). */
const seedBaseline = (serverId: string, perDay: number, endAgo = DAY, decision: string = "direct play") => {
    for (let d = 1; d <= 14; d++) {
        for (let i = 0; i < perDay; i++) play(serverId, NOW - endAgo - d * DAY + i * 60_000, { decision });
    }
};

beforeEach(() => {
    seq = 0;
    notifyAnomalies.mockClear();
    for (const table of ["activity_history", "servers", "stat_anomalies", "settings"]) {
        db.prepare(`DELETE FROM ${table}`).run();
    }
});

describe("collectServerMetrics", () => {
    it("splits current, baseline and silent windows and zero-fills idle servers", () => {
        seedBaseline("a", 2);
        play("a", NOW - HOUR, { decision: "transcode" });
        play("a", NOW - 2 * HOUR, { decision: null });
        const [a, idle] = collectServerMetrics(["a", "idle"], NOW);
        expect(a).toMatchObject({
            currentPlays: 2,
            currentKnownDecisions: 1,
            currentTranscodes: 1,
            baselinePlays: 28,
            baselineKnownDecisions: 28,
            // The 48h window also covers the newest baseline day (2 plays).
            silentWindowPlays: 4,
        });
        expect(idle).toMatchObject({ serverId: "idle", currentPlays: 0, baselinePlays: 0 });
    });
});

describe("collectNewClients", () => {
    it("returns only clients with no earlier history on that server", () => {
        seedBaseline("a", 2);
        play("a", NOW - 20 * DAY, { platform: "Roku", player: "Old TV" });
        for (let i = 0; i < 3; i++) {
            play("a", NOW - HOUR - i * 60_000, { platform: "Roku", player: "New TV", decision: "transcode", user: `u${i}` });
            play("a", NOW - HOUR - i * 60_000, { platform: "Roku", player: "Old TV", decision: "transcode" });
        }
        const clients = collectNewClients(["a"], NOW);
        expect(clients).toHaveLength(1);
        expect(clients[0]).toMatchObject({ platform: "Roku", client: "New TV", transcodes: 3 });
        expect(clients[0].users.sort()).toEqual(["u0", "u1", "u2"]);
    });
});

describe("runAnomalyScan", () => {
    it("detects a silent server, stores it once and refreshes it on the next scan", () => {
        server("a");
        seedBaseline("a", 3, 2 * DAY);

        const first = runAnomalyScan(NOW);
        expect(first.map((a) => a.kind)).toEqual(["server_silent"]);
        expect(first[0].serverName).toBe("Server A");

        const second = runAnomalyScan(NOW + DAY);
        expect(second).toEqual([]);
        const stored = listAnomalies({ since: 0, limit: 10 });
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({ firstDetectedAt: NOW, lastSeenAt: NOW + DAY });
    });

    it("opens a new incident once the old one has been quiet past the reopen gap", () => {
        server("a");
        seedBaseline("a", 3, 2 * DAY);
        runAnomalyScan(NOW);
        db.prepare("UPDATE stat_anomalies SET lastSeenAt = ?").run(NOW - REOPEN_GAP_MS - 1);
        expect(runAnomalyScan(NOW)).toHaveLength(1);
        expect(listAnomalies({ since: 0, limit: 10 })).toHaveLength(2);
    });

    it("skips paused servers and prunes expired incidents", () => {
        server("paused", true);
        seedBaseline("paused", 3, 2 * DAY);
        db.prepare(
            `INSERT INTO stat_anomalies (kind, serverId, severity, observed, firstDetectedAt, lastSeenAt)
             VALUES ('plays_drop', 'paused', 'warning', 0, ?, ?)`
        ).run(NOW - ANOMALY_RETENTION_MS - DAY, NOW - ANOMALY_RETENTION_MS - DAY);
        expect(runAnomalyScan(NOW)).toEqual([]);
        expect(listAnomalies({ since: 0, limit: 10 })).toEqual([]);
    });
});

describe("listAnomalies", () => {
    it("honours server scope and explicit server filters", () => {
        server("a");
        server("b");
        seedBaseline("a", 3, 2 * DAY);
        seedBaseline("b", 3, 2 * DAY);
        runAnomalyScan(NOW);
        expect(listAnomalies({ since: 0, limit: 10 })).toHaveLength(2);
        expect(listAnomalies({ since: 0, limit: 10, allowedServerIds: ["b"] }).map((a) => a.serverId)).toEqual(["b"]);
        expect(listAnomalies({ since: 0, limit: 10, serverId: "a", allowedServerIds: ["b"] })).toEqual([]);
        expect(listAnomalies({ since: NOW + 1, limit: 10 })).toEqual([]);
    });
});

describe("runAnomalyScanIfDue", () => {
    it("runs once a day and hands new incidents to the notifier", () => {
        server("a");
        seedBaseline("a", 3, 2 * DAY);

        expect(runAnomalyScanIfDue(NOW)).toHaveLength(1);
        expect(notifyAnomalies).toHaveBeenCalledTimes(1);
        expect(db.prepare("SELECT value FROM settings WHERE key = ?").get(ANOMALY_SCAN_LAST_RUN_KEY)).toEqual({ value: String(NOW) });

        expect(runAnomalyScanIfDue(NOW + HOUR)).toBeNull();
        // Next day: same incident, refreshed — nothing new to announce.
        expect(runAnomalyScanIfDue(NOW + DAY)).toEqual([]);
        expect(notifyAnomalies).toHaveBeenCalledTimes(1);
    });
});
