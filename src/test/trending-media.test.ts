import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { getTrendingMedia, MIN_TRENDING_PLAYS } from "@/lib/stats/trending-media";

const HOUR = 3600000;
const DAY = 24 * HOUR;
const WINDOW_DAYS = 10;
const NOW = new Date(2026, 6, 20, 12, 0, 0).getTime();
const SINCE = NOW - WINDOW_DAYS * DAY;
/** A timestamp safely inside the current window. */
const CURRENT = NOW - 2 * DAY;
/** A timestamp safely inside the previous window. */
const PREVIOUS = SINCE - 2 * DAY;

let seq = 0;
const insertPlay = (mediaId: number, startTime: number, opts: { userId?: string; serverId?: string } = {}) => {
    // Unique user per play by default so the (user, day) dedupe never merges seeds.
    const userId = opts.userId ?? `u-${seq}`;
    db.prepare(
        `INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime,
            duration, pausedCounter, play_duration, percent_complete, mediaId
        ) VALUES (?, ?, ?, ?, 'Test', '1', ?, ?, 600, 0, 600, 90, ?)`
    ).run(`trd-${seq++}`, opts.serverId ?? "srv-a", userId, userId, startTime, startTime + 600 * 1000, mediaId);
};

const insertPlays = (mediaId: number, count: number, startTime: number, serverId?: string) => {
    for (let i = 0; i < count; i++) insertPlay(mediaId, startTime, { serverId });
};

const insertMedia = (id: number, type: string, title: string, showMediaId: number | null = null) => {
    db.prepare(
        `INSERT INTO media_items (id, type, title, year, showMediaId, seasonNumber, episodeNumber, createdAt, updatedAt)
         VALUES (?, ?, ?, 2026, ?, ?, ?, '2026-01-01', '2026-01-01')`
    ).run(id, type, title, showMediaId, showMediaId ? 1 : null, showMediaId ? id : null);
};

const trending = (params: { serverId?: string; allowedServerIds?: string[]; limit?: number } = {}) =>
    getTrendingMedia("movie", { since: SINCE, until: NOW, ...params });

beforeEach(() => {
    seq = 0;
    db.prepare("DELETE FROM activity_history").run();
    db.prepare("DELETE FROM media_items").run();
    db.prepare("DELETE FROM library_items").run();
    db.prepare("DELETE FROM media_sources").run();
});

describe("getTrendingMedia", () => {
    it("ranks by growth delta, then current plays", () => {
        insertMedia(1, "movie", "Small Growth");
        insertMedia(2, "movie", "Big Growth");
        insertMedia(3, "movie", "Tie Fewer Plays");
        insertMedia(4, "movie", "Tie More Plays");
        insertPlays(1, 3, CURRENT); // +1 (3 vs 2)
        insertPlays(1, 2, PREVIOUS);
        insertPlays(2, 5, CURRENT); // +5 (new)
        insertPlays(3, 3, CURRENT); // +3 (3 vs 0)
        insertPlays(4, 4, CURRENT); // +3 (4 vs 1)
        insertPlays(4, 1, PREVIOUS);

        const items = trending();
        expect(items.map((i) => i.mediaId)).toEqual([2, 4, 3, 1]);
        expect(items[1]).toMatchObject({ plays: 4, previousPlays: 1, delta: 3, uniqueUsers: 4, thumb: null });
    });

    it("excludes flat and declining titles", () => {
        insertMedia(1, "movie", "Flat");
        insertMedia(2, "movie", "Declining");
        insertMedia(3, "movie", "Rising");
        insertPlays(1, 3, CURRENT);
        insertPlays(1, 3, PREVIOUS);
        insertPlays(2, 2, CURRENT);
        insertPlays(2, 5, PREVIOUS);
        insertPlays(3, 2, CURRENT);

        expect(trending().map((i) => i.mediaId)).toEqual([3]);
    });

    it(`requires at least MIN_TRENDING_PLAYS (${MIN_TRENDING_PLAYS}) current plays`, () => {
        insertMedia(1, "movie", "One Play");
        insertMedia(2, "movie", "Two Plays");
        insertPlays(1, MIN_TRENDING_PLAYS - 1, CURRENT);
        insertPlays(2, MIN_TRENDING_PLAYS, CURRENT);

        expect(trending().map((i) => i.mediaId)).toEqual([2]);
    });

    it("splits windows at `since`: [since-len, since) is previous, [since, until) is current", () => {
        insertMedia(1, "movie", "Boundary");
        insertPlays(1, 3, SINCE); // exactly at since -> current
        insertPlays(1, 1, SINCE - 1); // just before since -> previous
        insertPlays(1, 1, SINCE - WINDOW_DAYS * DAY); // previous window start (inclusive)
        insertPlays(1, 4, SINCE - WINDOW_DAYS * DAY - 1); // before previous window -> ignored
        insertPlays(1, 4, NOW); // until is exclusive -> ignored

        const [item] = trending();
        expect(item).toMatchObject({ plays: 3, previousPlays: 2, delta: 1 });
    });

    it("honours the server filter and the authorization scope", () => {
        insertMedia(1, "movie", "On A");
        insertMedia(2, "movie", "On B");
        insertPlays(1, 2, CURRENT, "srv-a");
        insertPlays(2, 3, CURRENT, "srv-b");
        // Growth on srv-a is offset by a previous-window spike on srv-b.
        insertPlays(1, 2, PREVIOUS, "srv-b");

        expect(trending().map((i) => i.mediaId)).toEqual([2]);
        expect(trending({ serverId: "srv-a" }).map((i) => i.mediaId)).toEqual([1]);
        expect(trending({ allowedServerIds: ["srv-a"] }).map((i) => i.mediaId)).toEqual([1]);
        expect(trending({ allowedServerIds: ["srv-a"], serverId: "srv-b" })).toEqual([]);
    });

    it("truncates to the limit and resolves thumbs", () => {
        insertMedia(1, "movie", "A");
        insertMedia(2, "movie", "B");
        db.prepare(
            `INSERT INTO library_items (serverId, ratingKey, sectionKey, mediaId, type, title, syncedAt, thumb)
             VALUES ('srv-a', '2', '1', 2, 'movie', 'B', 0, '/thumb/b')`
        ).run();
        insertPlays(1, 2, CURRENT);
        insertPlays(2, 3, CURRENT);

        const items = trending({ limit: 1 });
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ mediaId: 2, thumb: { path: "/thumb/b", serverId: "srv-a" } });
    });

    it("aggregates show plays through episodes", () => {
        insertMedia(10, "show", "Show");
        insertMedia(11, "episode", "Ep 1", 10);
        insertMedia(12, "episode", "Ep 2", 10);
        insertPlay(11, CURRENT, { userId: "100" });
        insertPlay(12, CURRENT, { userId: "100" });
        insertPlay(11, PREVIOUS, { userId: "100" });

        const items = getTrendingMedia("show", { since: SINCE, until: NOW });
        expect(items).toEqual([
            expect.objectContaining({ mediaId: 10, plays: 2, previousPlays: 1, delta: 1, uniqueUsers: 1 }),
        ]);
    });
});
