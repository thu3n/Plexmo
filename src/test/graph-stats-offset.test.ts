import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { getGraphData } from "@/lib/stats/graph-stats";

const DAY = 24 * 3600000;
const NOW = new Date(2026, 8, 30, 12).getTime();

let seq = 0;
const insertPlay = (startTime: number) => {
    db.prepare(
        `INSERT INTO activity_history (id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration)
         VALUES (?, 'srv-a', 'u1', 'A', 'T', '1', ?, ?, 600)`
    ).run(`go-${seq++}`, startTime, startTime + 600000);
};
const insertSnapshot = (timestamp: number, count: number) => {
    db.prepare("INSERT INTO concurrent_snapshots (count, sessions, timestamp, serverId) VALUES (?, '[]', ?, NULL)").run(count, timestamp);
};

const total = (rows: unknown) => (rows as { total: number }[]).reduce((sum, r) => sum + r.total, 0);

beforeEach(() => {
    seq = 0;
    db.prepare("DELETE FROM activity_history").run();
    db.prepare("DELETE FROM concurrent_snapshots").run();
});

describe("graph `until` (previous-period compare)", () => {
    it("bounds the activity series to [since, until)", () => {
        insertPlay(NOW - 2 * DAY); // current window
        insertPlay(NOW - 9 * DAY); // previous window
        insertPlay(NOW - 7 * DAY); // exactly at until → excluded from previous

        expect(total(getGraphData("plays_by_day", { since: NOW - 7 * DAY }))).toBe(2);
        expect(total(getGraphData("plays_by_day", { since: NOW - 14 * DAY, until: NOW - 7 * DAY }))).toBe(1);
    });

    it("bounds the concurrent series too", () => {
        insertSnapshot(NOW - 2 * DAY, 5);
        insertSnapshot(NOW - 9 * DAY, 3);

        const previous = getGraphData("concurrent_by_day", { since: NOW - 14 * DAY, until: NOW - 7 * DAY });
        expect(previous).toEqual([expect.objectContaining({ total: 3 })]);
        expect(getGraphData("concurrent_by_day", { since: NOW - 14 * DAY })).toHaveLength(2);
    });
});
