import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { getTopGenres, hasGenreData } from "@/lib/stats/user-insights-genres";
import { insertLibraryItem, insertMedia, insertPlay, resetPeopleTables } from "./user-insights-test-utils";

const UNTIL = new Date(2026, 6, 20, 12, 0, 0).getTime();
const SINCE = UNTIL - 30 * 24 * 3600_000;
const IN_WINDOW = UNTIL - 2 * 24 * 3600_000;

const genres = (params: { userId?: string; serverId?: string; allowedServerIds?: string[]; limit?: number } = {}) =>
    getTopGenres({ since: SINCE, until: UNTIL, ...params });

beforeEach(() => {
    resetPeopleTables();
    insertMedia(1, "movie", "Heat");
    insertMedia(10, "show", "The Wire");
    insertMedia(11, "episode", "Ep 1", 10);
    // Same movie on two servers — must not double count.
    insertLibraryItem("srv-a", "m1", 1, ["Crime", "Drama"]);
    insertLibraryItem("srv-b", "m1b", 1, ["Crime", "Thriller"]);
    insertLibraryItem("srv-a", "s10", 10, ["Crime"]);
});

describe("getTopGenres", () => {
    it("rolls episodes up to their show and dedupes titles held by several servers", () => {
        insertPlay({ userId: "u1", startTime: IN_WINDOW, mediaId: 1 });
        insertPlay({ userId: "u2", startTime: IN_WINDOW, mediaId: 11 });

        expect(genres()).toEqual([
            { genre: "Crime", plays: 2, users: 2, seconds: 1200 },
            { genre: "Drama", plays: 1, users: 1, seconds: 600 },
            { genre: "Thriller", plays: 1, users: 1, seconds: 600 },
        ]);
    });

    it("filters by user, applies the qualified-play gate and the limit", () => {
        insertPlay({ userId: "u1", startTime: IN_WINDOW, mediaId: 11 });
        insertPlay({ userId: "u2", startTime: IN_WINDOW, mediaId: 1 });
        // A 5% restart is not a play.
        insertPlay({ userId: "u1", startTime: IN_WINDOW, mediaId: 1, percent: 5 });

        expect(genres({ userId: "u1" }).map((g) => g.genre)).toEqual(["Crime"]);
        expect(genres({ limit: 1 })).toHaveLength(1);
    });

    it("takes library tags only from servers in the viewer's scope", () => {
        insertPlay({ userId: "u1", startTime: IN_WINDOW, mediaId: 1, serverId: "srv-a" });
        expect(genres({ allowedServerIds: ["srv-a"] }).map((g) => g.genre)).toEqual(["Crime", "Drama"]);
        expect(genres({ allowedServerIds: ["srv-b"] })).toEqual([]);
    });

    it("ignores plays outside the window or without a canonical media id", () => {
        insertPlay({ userId: "u1", startTime: SINCE - 1000, mediaId: 1 });
        insertPlay({ userId: "u1", startTime: IN_WINDOW, mediaId: null });
        expect(genres()).toEqual([]);
    });
});

describe("hasGenreData", () => {
    it("reflects whether any library genres were synced", () => {
        expect(hasGenreData()).toBe(true);
        resetPeopleTables();
        expect(hasGenreData()).toBe(false);
    });
});
