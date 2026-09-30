import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { getWrapped } from "@/lib/stats/wrapped";
import { getWrappedPeople, getWrappedYears } from "@/lib/stats/wrapped-people";

const MIN = 60_000;
const EP_SECONDS = 2400;

let seq = 0;
const play = (
    userId: string,
    mediaId: number,
    start: number,
    opts: { seconds?: number; percent?: number; serverId?: string; platform?: string } = {},
) => {
    const seconds = opts.seconds ?? EP_SECONDS;
    db.prepare(
        `INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration,
            play_duration, percent_complete, mediaId, platform
        ) VALUES (?, ?, ?, ?, 'T', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        `wr-${seq++}`, opts.serverId ?? "srv-a", userId, userId, String(mediaId), start, start + seconds * 1000,
        seconds, seconds, opts.percent ?? 95, mediaId, opts.platform ?? "Roku",
    );
};

const media = (id: number, type: string, title: string, showMediaId: number | null = null) =>
    db.prepare(
        `INSERT INTO media_items (id, type, title, year, showMediaId, seasonNumber, episodeNumber, createdAt, updatedAt)
         VALUES (?, ?, ?, 2020, ?, ?, ?, '2026-01-01', '2026-01-01')`
    ).run(id, type, title, showMediaId, showMediaId ? 1 : null, showMediaId ? id : null);

const libraryItem = (mediaId: number, ratingKey: string, genres: string[]) => {
    db.prepare(
        `INSERT INTO library_items (serverId, ratingKey, sectionKey, mediaId, type, title, thumb, syncedAt)
         VALUES ('srv-a', ?, '1', ?, 'show', 'x', ?, 0)`
    ).run(ratingKey, mediaId, `/library/metadata/${ratingKey}/thumb/1`);
    for (const genre of genres) {
        db.prepare("INSERT INTO library_item_genres (serverId, ratingKey, genre) VALUES ('srv-a', ?, ?)").run(ratingKey, genre);
    }
};

/** 2026-03-14 20:00 local — a Saturday evening binge. */
const BINGE_START = new Date(2026, 2, 14, 20, 0).getTime();

beforeEach(() => {
    seq = 0;
    for (const table of ["activity_history", "media_items", "library_items", "media_sources", "user_identities"]) {
        db.prepare(`DELETE FROM ${table}`).run();
    }
    db.exec(`CREATE TABLE IF NOT EXISTS library_item_genres (
        serverId TEXT NOT NULL, ratingKey TEXT NOT NULL, genre TEXT NOT NULL, PRIMARY KEY (serverId, ratingKey, genre))`);
    db.prepare("DELETE FROM library_item_genres").run();

    media(1, "movie", "Dune");
    media(2, "movie", "Heat");
    media(10, "show", "Severance");
    for (let e = 11; e <= 14; e++) media(e, "episode", `Ep ${e}`, 10);
    libraryItem(10, "rk-10", ["Drama", "Sci-Fi"]);
    libraryItem(1, "rk-1", ["Sci-Fi"]);
    db.prepare("INSERT INTO user_identities (accountId, username, title, createdAt, updatedAt) VALUES ('u1', 'alice', 'Alice', '2026-01-01', '2026-01-01')").run();

    // Four episodes back to back on Saturday evening.
    for (let i = 0; i < 4; i++) play("u1", 11 + i, BINGE_START + i * (EP_SECONDS * 1000 + 5 * MIN));
    play("u1", 1, new Date(2026, 5, 2, 21, 0).getTime(), { seconds: 7200, platform: "Apple TV" });
    play("u1", 1, new Date(2026, 5, 3, 21, 0).getTime(), { seconds: 7200, platform: "Apple TV" });
    play("u1", 2, new Date(2026, 6, 1, 21, 0).getTime(), { seconds: 120, percent: 5 }); // not a qualified play
    play("u1", 2, new Date(2025, 11, 31, 21, 0).getTime(), { seconds: 7200 }); // last year
    play("u1", 1, new Date(2026, 7, 1, 9, 0).getTime(), { seconds: 7200, serverId: "srv-b" });
    play("u2", 1, new Date(2026, 4, 1, 21, 0).getTime(), { seconds: 90_000 });
});

describe("getWrapped", () => {
    it("summarises one user's year", () => {
        const w = getWrapped({ userId: "u1", year: 2026, allowedServerIds: ["srv-a"] });
        expect(w.userName).toBe("Alice");
        expect(w.totals).toEqual({
            plays: 6, // 4 episodes + Dune on two days
            seconds: 4 * EP_SECONDS + 2 * 7200 + 120,
            activeDays: 4,
            titles: 5,
        });
        expect(w.topMovies.map((t) => [t.title, t.plays])).toEqual([["Dune", 2]]);
        expect(w.topShows[0]).toMatchObject({ title: "Severance", plays: 4 });
        expect(w.topShows[0].thumb).toEqual({ path: "/library/metadata/rk-10/thumb/1", serverId: "srv-a" });
        expect(w.longestBinge).toMatchObject({ showTitle: "Severance", episodes: 4, startedAt: BINGE_START });
        expect(w.longestBinge?.thumb?.serverId).toBe("srv-a");
        expect(w.busiestDay).toMatchObject({ date: "2026-03-14", plays: 4 });
        expect(w.busiestMonth).toEqual({ month: 6, seconds: 14_400 });
        expect(w.monthlySeconds[2]).toBe(4 * EP_SECONDS);
        expect(w.favouriteHour?.hour).toBe(21);
        expect(w.devices[0]).toMatchObject({ name: "Apple TV", plays: 2 });
        expect(w.genres).toEqual([
            { genre: "Sci-Fi", plays: 6 },
            { genre: "Drama", plays: 4 },
        ]);
        expect(w.rank).toEqual({ position: 2, of: 2 });
    });

    it("keeps other servers out of a scoped view", () => {
        const scoped = getWrapped({ userId: "u1", year: 2026, allowedServerIds: ["srv-a"] });
        const all = getWrapped({ userId: "u1", year: 2026 });
        expect(all.totals.seconds - scoped.totals.seconds).toBe(7200);
        expect(all.devices.find((d) => d.name === "Roku")?.plays).toBe(6);
    });

    it("returns an empty recap for a year without plays", () => {
        const w = getWrapped({ userId: "u1", year: 2024 });
        expect(w.totals).toEqual({ plays: 0, seconds: 0, activeDays: 0, titles: 0 });
        expect(w.longestBinge).toBeNull();
        expect(w.busiestDay).toBeNull();
        expect(w.favouriteHour).toBeNull();
        expect(w.rank).toBeNull();
        expect(w.genres).toBeNull();
    });

    it("skips genres when the genre table does not exist", () => {
        db.exec("DROP TABLE library_item_genres");
        expect(getWrapped({ userId: "u1", year: 2026 }).genres).toBeNull();
    });
});

describe("wrapped people", () => {
    it("lists the years a user has plays in, newest first", () => {
        expect(getWrappedYears("u1")).toEqual([2026, 2025]);
        expect(getWrappedYears("u1", ["srv-b"])).toEqual([2026]);
    });

    it("lists pickable people by watch time", () => {
        const since = new Date(2026, 0, 1).getTime();
        const until = new Date(2027, 0, 1).getTime();
        expect(getWrappedPeople(since, until).map((p) => [p.userId, p.name])).toEqual([
            ["u2", "u2"],
            ["u1", "Alice"],
        ]);
    });
});
