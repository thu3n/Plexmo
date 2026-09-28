import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    const db = createTestDb();
    const insert = db.prepare(`
        INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration,
            device, video_decision, audio_decision, video_resolution, stream_video_resolution, meta_json
        ) VALUES (?, 'srv', ?, 'elias', 'Title', '1', ?, ?, 600, ?, ?, ?, ?, ?, ?)
    `);
    // Local-time constructors so the weekday/hour buckets are timezone-independent.
    const mon = new Date(2026, 8, 28, 20, 15).getTime();
    const tue = new Date(2026, 8, 29, 8, 5).getTime();
    const prev = new Date(2026, 8, 20, 12, 0).getTime();
    const hevcToH264 = JSON.stringify({ originalVideoCodec: "hevc", transcodeVideoCodec: "h264" });
    // Tautulli imports store the source codec as audioCodec, not originalAudioCodec.
    const truehdToAac = JSON.stringify({ audioCodec: "truehd", transcodeAudioCodec: "aac" });
    insert.run("a", "acc", mon, mon + 600_000, "Apple TV", "transcode", "copy", "4k", "1080", hevcToH264);
    insert.run("b", "acc", mon, mon + 600_000, "Apple TV", "copy", "transcode", "4k", "1080", truehdToAac);
    insert.run("c", "acc", tue, tue + 600_000, "Chrome", "copy", "copy", "1080", "1080", null);
    insert.run("d", "acc", tue, tue + 600_000, null, null, null, null, null, null);
    insert.run("p", "other", prev, prev + 600_000, null, null, null, null, null, null);

    const snapshot = db.prepare(
        "INSERT INTO concurrent_snapshots (count, sessions, timestamp, serverId) VALUES (?, '[]', ?, NULL)"
    );
    snapshot.run(3, mon);
    snapshot.run(1, mon + 60_000);
    snapshot.run(2, tue);
    snapshot.run(5, prev);
    return { db };
});

import { getGraphData } from "@/lib/stats/graph-stats";
import { getOverviewSummaryWithPeaks } from "@/lib/stats/overview-stats";

type Row = { bucket: string; total: number; duration?: number; detail?: string | null };

const SINCE_THIS_WEEK = new Date(2026, 8, 27).getTime();

describe("statistics v2 graph types", () => {
    it("plays_by_dow_hour buckets by local weekday and hour, with watch time and users", () => {
        const rows = getGraphData("plays_by_dow_hour", { since: SINCE_THIS_WEEK }) as Row[];
        expect(rows).toEqual([
            expect.objectContaining({ bucket: "1-20", total: 2, seconds: 1200, users: 1 }),
            expect.objectContaining({ bucket: "2-08", total: 2, seconds: 1200, users: 1 }),
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

    it("transcode_details reports counts and the most common codec/resolution change", () => {
        const rows = getGraphData("transcode_details", { since: 0 }) as Row[];
        expect(rows).toEqual([
            { bucket: "video", total: 1, detail: "HEVC → H264" },
            { bucket: "audio", total: 1, detail: "TRUEHD → AAC" },
            { bucket: "resolution", total: 2, detail: "4k → 1080" },
        ]);
    });

    it("concurrent_by_day is the per-day snapshot maximum", () => {
        const rows = getGraphData("concurrent_by_day", { since: SINCE_THIS_WEEK }) as Row[];
        expect(rows).toEqual([
            { bucket: "2026-09-28", total: 3 },
            { bucket: "2026-09-29", total: 2 },
        ]);
    });
});

describe("overview summary previous period", () => {
    it("computes the equally long window before `since`", () => {
        const days = 7;
        const since = new Date(2026, 8, 30).getTime() - days * 24 * 60 * 60 * 1000;
        const result = getOverviewSummaryWithPeaks({ since }, days, { previous: true });
        expect(result.totalPlays).toBe(4);
        expect(result.previous).toEqual({ totalPlays: 1, totalSeconds: 600, uniqueUsers: 1, peak: 5 });
    });

    it("omits previous unless asked", () => {
        expect(getOverviewSummaryWithPeaks({ since: 0 }, 30).previous).toBeUndefined();
    });
});
