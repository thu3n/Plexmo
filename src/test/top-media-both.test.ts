import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { getTopMediaBoth } from "@/lib/stats/top-media-both";
import { getTopMovies } from "@/lib/stats/home-stats";

const HOUR = 3600000;
const BASE = new Date(2026, 6, 10, 12, 0, 0).getTime();

let seq = 0;
const insertRow = (opts: {
    userId?: string;
    serverId?: string;
    startTime?: number;
    mediaId: number;
}) => {
    db.prepare(
        `INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime,
            duration, pausedCounter, play_duration, percent_complete, mediaId
        ) VALUES (?, ?, ?, ?, 'Test', '1', ?, ?, 600, 0, 600, 90, ?)`
    ).run(
        `tmb-${seq++}`,
        opts.serverId ?? "srv-a",
        opts.userId ?? "100",
        opts.userId ?? "100",
        opts.startTime ?? BASE,
        (opts.startTime ?? BASE) + 600 * 1000,
        opts.mediaId
    );
};

const insertMedia = (id: number, type: string, title: string, showMediaId: number | null = null) => {
    db.prepare(
        `INSERT INTO media_items (id, type, title, year, showMediaId, seasonNumber, episodeNumber, createdAt, updatedAt)
         VALUES (?, ?, ?, 2026, ?, ?, ?, '2026-01-01', '2026-01-01')`
    ).run(id, type, title, showMediaId, showMediaId ? 1 : null, showMediaId ? id : null);
};

const insertLibraryItem = (serverId: string, ratingKey: string, mediaId: number, thumb: string) => {
    db.prepare(
        `INSERT INTO library_items (serverId, ratingKey, sectionKey, mediaId, type, title, syncedAt, thumb)
         VALUES (?, ?, '1', ?, 'movie', 'X', 0, ?)`
    ).run(serverId, ratingKey, mediaId, thumb);
};

const insertMediaSource = (serverId: string, ratingKey: string, mediaId: number) => {
    db.prepare(
        `INSERT INTO media_sources (serverId, ratingKey, mediaId, updatedAt)
         VALUES (?, ?, ?, '2026-01-01')`
    ).run(serverId, ratingKey, mediaId);
};

beforeEach(() => {
    seq = 0;
    db.prepare("DELETE FROM activity_history").run();
    db.prepare("DELETE FROM media_items").run();
    db.prepare("DELETE FROM library_items").run();
    db.prepare("DELETE FROM media_sources").run();
});

describe("getTopMediaBoth", () => {
    it("byPlays matches the legacy single-order query exactly", () => {
        insertMedia(1, "movie", "Movie A");
        insertMedia(2, "movie", "Movie B");
        // A: 3 plays (3 days) by one user; B: 2 plays by two users.
        insertRow({ mediaId: 1, startTime: BASE });
        insertRow({ mediaId: 1, startTime: BASE + 25 * HOUR });
        insertRow({ mediaId: 1, startTime: BASE + 49 * HOUR });
        insertRow({ mediaId: 2, userId: "100" });
        insertRow({ mediaId: 2, userId: "200" });

        const legacy = getTopMovies({ since: 0, orderBy: "plays" }) as Array<{ mediaId: number }>;
        const both = getTopMediaBoth("movie", { since: 0 });
        expect(both.byPlays.map((r) => r.mediaId)).toEqual(legacy.map((r) => r.mediaId));
        expect(both.byPlays[0].mediaId).toBe(1);
    });

    it("byUsers ranks by unique users with plays as tiebreak", () => {
        insertMedia(1, "movie", "Movie A");
        insertMedia(2, "movie", "Movie B");
        insertMedia(3, "movie", "Movie C");
        // A: 4 plays / 1 user. B: 3 plays / 2 users. C: 2 plays / 2 users —
        // same uniqueUsers as B but fewer plays -> B before C (tiebreak).
        insertRow({ mediaId: 1, startTime: BASE });
        insertRow({ mediaId: 1, startTime: BASE + 25 * HOUR });
        insertRow({ mediaId: 1, startTime: BASE + 49 * HOUR });
        insertRow({ mediaId: 1, startTime: BASE + 73 * HOUR });
        insertRow({ mediaId: 2, userId: "100", startTime: BASE });
        insertRow({ mediaId: 2, userId: "200", startTime: BASE });
        insertRow({ mediaId: 2, userId: "200", startTime: BASE + 25 * HOUR });
        insertRow({ mediaId: 3, userId: "300", startTime: BASE });
        insertRow({ mediaId: 3, userId: "400", startTime: BASE });

        const { byUsers, byPlays } = getTopMediaBoth("movie", { since: 0 });
        expect(byUsers.map((r) => r.mediaId)).toEqual([2, 3, 1]);
        expect(byPlays.map((r) => r.mediaId)).toEqual([1, 2, 3]);
    });

    it("applies the limit to both rankings independently", () => {
        insertMedia(1, "movie", "Movie A");
        insertMedia(2, "movie", "Movie B");
        insertRow({ mediaId: 1, startTime: BASE });
        insertRow({ mediaId: 1, startTime: BASE + 25 * HOUR });
        insertRow({ mediaId: 1, startTime: BASE + 49 * HOUR });
        insertRow({ mediaId: 2, userId: "100" });
        insertRow({ mediaId: 2, userId: "200" });

        const { byUsers, byPlays } = getTopMediaBoth("movie", { since: 0, limit: 1 });
        expect(byPlays).toHaveLength(1);
        expect(byUsers).toHaveLength(1);
        expect(byPlays[0].mediaId).toBe(1); // most plays
        expect(byUsers[0].mediaId).toBe(2); // most unique users
    });

    it("resolves thumbs for the union of both top lists", () => {
        insertMedia(1, "movie", "Movie A");
        insertMedia(2, "movie", "Movie B");
        insertLibraryItem("srv-a", "1", 1, "/thumb/a");
        insertLibraryItem("srv-a", "2", 2, "/thumb/b");
        insertRow({ mediaId: 1, startTime: BASE });
        insertRow({ mediaId: 1, startTime: BASE + 25 * HOUR });
        insertRow({ mediaId: 1, startTime: BASE + 49 * HOUR });
        insertRow({ mediaId: 2, userId: "100" });
        insertRow({ mediaId: 2, userId: "200" });

        const { byUsers, byPlays } = getTopMediaBoth("movie", { since: 0, limit: 1 });
        expect(byPlays[0].thumb).toEqual({ path: "/thumb/a", serverId: "srv-a" });
        expect(byUsers[0].thumb).toEqual({ path: "/thumb/b", serverId: "srv-a" });
    });

    it("resolves episode thumbs through the show's mediaId", () => {
        insertMedia(10, "show", "Show P");
        insertMedia(11, "episode", "Ep 1", 10);
        insertLibraryItem("srv-a", "10", 10, "/thumb/show-p");
        insertRow({ mediaId: 11 });

        const { byPlays } = getTopMediaBoth("episode", { since: 0 });
        expect(byPlays[0].mediaId).toBe(11);
        expect(byPlays[0].thumb).toEqual({ path: "/thumb/show-p", serverId: "srv-a" });
    });

    it("falls back to a synthesized media_sources poster path when the library lacks the item", () => {
        insertMedia(20, "movie", "Gone From Library");
        insertMediaSource("srv-b", "4711", 20);
        insertRow({ mediaId: 20 });

        const { byPlays } = getTopMediaBoth("movie", { since: 0 });
        expect(byPlays[0].thumb).toEqual({
            path: "/library/metadata/4711/thumb",
            serverId: "srv-b",
        });
    });

    it("orphaned episodes (no linked show) fall back to their own art", () => {
        insertMedia(30, "episode", "Episode #3.1", null);
        insertMediaSource("srv-b", "999", 30);
        insertRow({ mediaId: 30 });

        const { byPlays } = getTopMediaBoth("episode", { since: 0 });
        expect(byPlays[0].thumb).toEqual({
            path: "/library/metadata/999/thumb",
            serverId: "srv-b",
        });
    });

    it("library_items art wins over the media_sources fallback", () => {
        insertMedia(40, "movie", "In Library");
        insertLibraryItem("srv-a", "40", 40, "/thumb/real");
        insertMediaSource("srv-a", "40", 40);
        insertRow({ mediaId: 40 });

        const { byPlays } = getTopMediaBoth("movie", { since: 0 });
        expect(byPlays[0].thumb).toEqual({ path: "/thumb/real", serverId: "srv-a" });
    });
});
