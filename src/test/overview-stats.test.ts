import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { getOverviewSummary } from "@/lib/stats/overview-stats";
import { getTopEpisodes } from "@/lib/stats/home-stats";
import { resolveMediaThumbs } from "@/lib/stats/media-thumbs";

const HOUR = 3600000;
const BASE = new Date(2026, 6, 10, 12, 0, 0).getTime();

let seq = 0;
const insertRow = (opts: {
    userId?: string;
    serverId?: string;
    startTime?: number;
    duration?: number;
    playDuration?: number | null;
    percentComplete?: number | null;
    mediaId?: number | null;
}) => {
    db.prepare(
        `INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime,
            duration, pausedCounter, play_duration, percent_complete, mediaId
        ) VALUES (?, ?, ?, ?, 'Test', '1', ?, ?, ?, 0, ?, ?, ?)`
    ).run(
        `ov-${seq++}`,
        opts.serverId ?? "srv-a",
        opts.userId ?? "100",
        opts.userId ?? "100",
        opts.startTime ?? BASE,
        (opts.startTime ?? BASE) + (opts.duration ?? 600) * 1000,
        opts.duration ?? 600,
        opts.playDuration === undefined ? opts.duration ?? 600 : opts.playDuration,
        opts.percentComplete ?? null,
        opts.mediaId ?? null
    );
};

const insertMedia = (
    id: number,
    type: string,
    title: string,
    showMediaId: number | null = null,
    episodeNumber: number | null = null
) => {
    db.prepare(
        `INSERT INTO media_items (id, type, title, year, showMediaId, seasonNumber, episodeNumber, createdAt, updatedAt)
         VALUES (?, ?, ?, 2026, ?, ?, ?, '2026-01-01', '2026-01-01')`
    ).run(id, type, title, showMediaId, showMediaId ? 1 : null, episodeNumber);
};

beforeEach(() => {
    seq = 0;
    db.prepare("DELETE FROM activity_history").run();
    db.prepare("DELETE FROM media_items").run();
    db.prepare("DELETE FROM library_items").run();
});

describe("getOverviewSummary", () => {
    it("returns zeros on an empty window", () => {
        expect(getOverviewSummary({ since: 0 })).toEqual({
            totalPlays: 0,
            totalSeconds: 0,
            uniqueUsers: 0,
            playsByType: [],
        });
    });

    it("counts raw plays, pause-free seconds with wallclock fallback, and distinct users", () => {
        insertRow({ userId: "100", duration: 900, playDuration: 600 });
        insertRow({ userId: "100", duration: 900, playDuration: null }); // falls back to duration
        insertRow({ userId: "200", duration: 300 });

        const summary = getOverviewSummary({ since: 0 });
        expect(summary.totalPlays).toBe(3);
        expect(summary.totalSeconds).toBe(600 + 900 + 300);
        expect(summary.uniqueUsers).toBe(2);
    });

    it("buckets playsByType as movie/episode/other (NULL mediaId included)", () => {
        insertMedia(1, "movie", "Movie X");
        insertMedia(10, "show", "Show P");
        insertMedia(11, "episode", "Ep 1", 10);
        insertMedia(20, "track", "Song");

        insertRow({ mediaId: 1 });
        insertRow({ mediaId: 1 });
        insertRow({ mediaId: 11 });
        insertRow({ mediaId: 20 });
        insertRow({ mediaId: null });

        const byType = Object.fromEntries(
            getOverviewSummary({ since: 0 }).playsByType.map((b) => [b.type, b.plays])
        );
        expect(byType).toEqual({ movie: 2, episode: 1, other: 2 });
    });

    it("honours the window and server filters", () => {
        insertRow({ startTime: BASE - 10 * HOUR });
        insertRow({ startTime: BASE, serverId: "srv-a" });
        insertRow({ startTime: BASE, serverId: "srv-b" });

        expect(getOverviewSummary({ since: BASE - HOUR }).totalPlays).toBe(2);
        expect(getOverviewSummary({ since: 0, serverId: "srv-a" }).totalPlays).toBe(2);
        expect(getOverviewSummary({ since: 0, allowedServerIds: ["srv-b"] }).totalPlays).toBe(1);
    });
});

describe("getTopEpisodes", () => {
    beforeEach(() => {
        insertMedia(10, "show", "Show P");
        insertMedia(11, "episode", "Ep 1", 10, 5);
        insertMedia(12, "episode", "Ep 2", 10, 6);
    });

    it("dedupes plays per (user, day), carries the show title, and gates on qualified plays", () => {
        // Ep 1: two qualified rows same user+day = ONE play, plus a second day = two.
        // Ep 2: only a restart below both thresholds — must not appear at all.
        insertRow({ mediaId: 11, percentComplete: 90, startTime: BASE });
        insertRow({ mediaId: 11, percentComplete: 90, startTime: BASE + HOUR });
        insertRow({ mediaId: 11, percentComplete: 90, startTime: BASE + 25 * HOUR });
        insertRow({ mediaId: 12, percentComplete: 5, playDuration: 60, duration: 60 });

        const top = getTopEpisodes({ since: 0 }) as Array<Record<string, unknown>>;
        expect(top).toHaveLength(1);
        expect(top[0]).toMatchObject({
            mediaId: 11, title: "Ep 1", showTitle: "Show P", showMediaId: 10,
            seasonNumber: 1, episodeNumber: 5, plays: 2, uniqueUsers: 1,
        });
    });

    it("orders by uniqueUsers when requested", () => {
        // Ep 1: 3 plays by one user (three days); Ep 2: 2 plays by two users.
        insertRow({ mediaId: 11, percentComplete: 90, startTime: BASE });
        insertRow({ mediaId: 11, percentComplete: 90, startTime: BASE + 25 * HOUR });
        insertRow({ mediaId: 11, percentComplete: 90, startTime: BASE + 49 * HOUR });
        insertRow({ mediaId: 12, userId: "100", percentComplete: 90 });
        insertRow({ mediaId: 12, userId: "200", percentComplete: 90 });

        const byPlays = getTopEpisodes({ since: 0 }) as Array<{ mediaId: number }>;
        const byUsers = getTopEpisodes({ since: 0, orderBy: "uniqueUsers" }) as Array<{ mediaId: number }>;
        expect(byPlays[0].mediaId).toBe(11);
        expect(byUsers[0].mediaId).toBe(12);
    });
});

describe("resolveMediaThumbs", () => {
    const insertLibraryItem = (serverId: string, ratingKey: string, mediaId: number, thumb: string | null) => {
        db.prepare(
            `INSERT INTO library_items (serverId, ratingKey, sectionKey, mediaId, type, title, syncedAt, thumb)
             VALUES (?, ?, '1', ?, 'movie', 'X', 0, ?)`
        ).run(serverId, ratingKey, mediaId, thumb);
    };

    it("returns the first thumb per mediaId (deterministic by serverId) and skips misses", () => {
        insertLibraryItem("srv-b", "1", 1, "/thumb/from-b");
        insertLibraryItem("srv-a", "2", 1, "/thumb/from-a");
        insertLibraryItem("srv-a", "3", 2, null); // thumb missing -> no entry

        const thumbs = resolveMediaThumbs([1, 2, 999]);
        expect(thumbs.get(1)).toEqual({ path: "/thumb/from-a", serverId: "srv-a" });
        expect(thumbs.has(2)).toBe(false);
        expect(thumbs.has(999)).toBe(false);
    });

    it("respects the server scope and empty input", () => {
        insertLibraryItem("srv-a", "1", 1, "/thumb/a");
        expect(resolveMediaThumbs([1], ["srv-b"]).size).toBe(0);
        expect(resolveMediaThumbs([], ["srv-a"]).size).toBe(0);
        expect(resolveMediaThumbs([1], ["srv-a"]).get(1)).toEqual({ path: "/thumb/a", serverId: "srv-a" });
    });
});
