import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    const db = createTestDb();
    const insert = db.prepare(`
        INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration,
            device, video_decision, audio_decision, video_resolution, stream_video_resolution
        ) VALUES (?, 'srv', 'acc', 'elias', 'Title', '1', ?, ?, 600, ?, ?, ?, ?, ?)
    `);
    // Local-time constructors so the weekday/hour buckets are timezone-independent.
    const mondayEvening = new Date(2026, 8, 28, 20, 15).getTime();
    const tuesdayMorning = new Date(2026, 8, 29, 8, 5).getTime();
    insert.run("a", mondayEvening, mondayEvening + 600_000, "Apple TV", "transcode", "copy", "4k", "1080");
    insert.run("b", mondayEvening, mondayEvening + 600_000, "Apple TV", "copy", "transcode", "4k", "1080");
    insert.run("c", tuesdayMorning, tuesdayMorning + 600_000, "Chrome", "copy", "copy", "1080", "1080");
    insert.run("d", tuesdayMorning, tuesdayMorning + 600_000, null, null, null, null, null);
    return { db };
});

import { getGraphData } from "@/lib/stats/graph-stats";

type Row = { bucket: string; total: number; duration?: number; detail?: string | null };

describe("statistics v2 graph types", () => {
    it("plays_by_dow_hour buckets by local weekday and hour", () => {
        const rows = getGraphData("plays_by_dow_hour", { since: 0 }) as Row[];
        expect(rows).toEqual([
            expect.objectContaining({ bucket: "1-20", total: 2 }),
            expect.objectContaining({ bucket: "2-08", total: 2 }),
        ]);
    });

    it("plays_by_device ranks devices and skips rows without one", () => {
        const rows = getGraphData("plays_by_device", { since: 0 }) as Row[];
        expect(rows.map((r) => [r.bucket, r.total])).toEqual([
            ["Apple TV", 2],
            ["Chrome", 1],
        ]);
        expect(rows[0].duration).toBe(1200);
    });

    it("transcode_details counts per-component transcodes and the top resolution change", () => {
        const rows = getGraphData("transcode_details", { since: 0 }) as Row[];
        expect(rows).toEqual([
            { bucket: "video", total: 1, detail: null },
            { bucket: "audio", total: 1, detail: null },
            { bucket: "resolution", total: 2, detail: "4k → 1080" },
        ]);
    });
});
