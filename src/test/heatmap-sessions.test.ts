import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { getHeatmapSessions, isValidHeatmapCell } from "@/lib/stats/heatmap-sessions";

const DAY = 24 * 3600000;
// Monday 2026-09-21, local time — matches SQLite's 'localtime' modifier.
const MONDAY_20 = new Date(2026, 8, 21, 20, 15).getTime();
const MONDAY_21 = new Date(2026, 8, 21, 21, 5).getTime();
const TUESDAY_20 = new Date(2026, 8, 22, 20, 30).getTime();
const SINCE = MONDAY_20 - 30 * DAY;

let seq = 0;
const insert = (startTime: number, opts: { serverId?: string; mediaId?: number | null } = {}) => {
    db.prepare(
        `INSERT INTO activity_history (id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration, mediaId)
         VALUES (?, ?, 'u1', 'Alice', 'Title', '1', ?, ?, 600, ?)`
    ).run(`hm-${seq++}`, opts.serverId ?? "srv-a", startTime, startTime + 600000, opts.mediaId ?? null);
};

beforeEach(() => {
    seq = 0;
    db.prepare("DELETE FROM activity_history").run();
    db.prepare("DELETE FROM media_items").run();
});

describe("isValidHeatmapCell", () => {
    it("accepts weekday 0-6 and hour 0-23 only", () => {
        expect(isValidHeatmapCell({ weekday: 0, hour: 0 })).toBe(true);
        expect(isValidHeatmapCell({ weekday: 6, hour: 23 })).toBe(true);
        expect(isValidHeatmapCell({ weekday: 7, hour: 1 })).toBe(false);
        expect(isValidHeatmapCell({ weekday: 1, hour: 24 })).toBe(false);
        expect(isValidHeatmapCell({ weekday: Number.NaN, hour: 1 })).toBe(false);
        expect(isValidHeatmapCell({ weekday: 1.5, hour: 1 })).toBe(false);
    });
});

describe("getHeatmapSessions", () => {
    it("returns only the sessions of the requested local weekday and hour, newest first", () => {
        insert(MONDAY_20);
        insert(MONDAY_20 - 7 * DAY);
        insert(MONDAY_21);
        insert(TUESDAY_20);

        const result = getHeatmapSessions({ weekday: 1, hour: 20 }, { since: SINCE });
        expect(result.total).toBe(2);
        expect(result.sessions.map((s) => s.startTime)).toEqual([MONDAY_20, MONDAY_20 - 7 * DAY]);
        expect(result.sessions[0]).toMatchObject({ user: "Alice", seconds: 600, titleMediaId: null });
    });

    it("honours the window, server filter, scope and limit", () => {
        insert(MONDAY_20, { serverId: "srv-a" });
        insert(MONDAY_20 - 7 * DAY, { serverId: "srv-b" });
        insert(MONDAY_20 - 35 * DAY, { serverId: "srv-a" });

        const cell = { weekday: 1, hour: 20 };
        expect(getHeatmapSessions(cell, { since: SINCE }).total).toBe(2);
        expect(getHeatmapSessions(cell, { since: SINCE, serverId: "srv-b" }).total).toBe(1);
        expect(getHeatmapSessions(cell, { since: SINCE, allowedServerIds: ["srv-a"] }).total).toBe(1);
        const limited = getHeatmapSessions(cell, { since: SINCE }, 1);
        expect(limited.total).toBe(2);
        expect(limited.sessions).toHaveLength(1);
    });

    it("rolls episodes up to their show for the title link", () => {
        db.prepare(
            `INSERT INTO media_items (id, type, title, showMediaId, createdAt, updatedAt) VALUES
             (10, 'show', 'Show', NULL, '2026', '2026'), (11, 'episode', 'Ep', 10, '2026', '2026')`
        ).run();
        insert(MONDAY_20, { mediaId: 11 });
        expect(getHeatmapSessions({ weekday: 1, hour: 20 }, { since: SINCE }).sessions[0].titleMediaId).toBe(10);
    });
});
