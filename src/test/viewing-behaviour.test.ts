import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import {
    MIN_ATTEMPT_SECONDS,
    MIN_TITLE_ATTEMPTS,
    getCompletionStats,
} from "@/lib/stats/viewing-behaviour-completion";
import {
    BINGE_GAP_MS,
    MIN_BINGE_EPISODES,
    detectBinges,
    getBingeStats,
    type EpisodePlay,
} from "@/lib/stats/viewing-behaviour-binge";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 6, 20, 12, 0, 0).getTime();
const SINCE = NOW - 30 * DAY;
const IN_WINDOW = NOW - 5 * DAY;
const EPISODE_SECONDS = 1800;

let seq = 0;
type PlayOpts = { userId?: string; serverId?: string; pct?: number | null; seconds?: number; start?: number };
const insertPlay = (mediaId: number, opts: PlayOpts = {}) => {
    const userId = opts.userId ?? "u1";
    const seconds = opts.seconds ?? EPISODE_SECONDS;
    const start = opts.start ?? IN_WINDOW;
    db.prepare(
        `INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime,
            duration, pausedCounter, play_duration, percent_complete, mediaId
        ) VALUES (?, ?, ?, ?, 'T', '1', ?, ?, ?, 0, ?, ?, ?)`
    ).run(
        `vb-${seq++}`, opts.serverId ?? "srv-a", userId, userId, start, start + seconds * 1000,
        seconds, seconds, opts.pct === undefined ? 95 : opts.pct, mediaId,
    );
};

const insertMedia = (id: number, type: string, title: string, showMediaId: number | null = null, episode = 1) => {
    db.prepare(
        `INSERT INTO media_items (id, type, title, year, showMediaId, seasonNumber, episodeNumber, createdAt, updatedAt)
         VALUES (?, ?, ?, 2026, ?, ?, ?, '2026-01-01', '2026-01-01')`
    ).run(id, type, title, showMediaId, showMediaId ? 1 : null, showMediaId ? episode : null);
};

const params = (extra: { serverId?: string; allowedServerIds?: string[]; limit?: number } = {}) => ({
    since: SINCE,
    until: NOW,
    ...extra,
});

beforeEach(() => {
    seq = 0;
    db.prepare("DELETE FROM activity_history").run();
    db.prepare("DELETE FROM media_items").run();
    db.prepare("DELETE FROM library_items").run();
});

describe("getCompletionStats", () => {
    it("buckets each user×item attempt at its furthest point, resumes finishing the attempt", () => {
        insertMedia(1, "movie", "Resumed");
        insertPlay(1, { pct: 40 });
        insertPlay(1, { pct: 97, start: IN_WINDOW + DAY }); // same user resumes -> one finished attempt
        insertPlay(1, { userId: "u2", pct: 12 });
        insertPlay(1, { userId: "u3", pct: 100 });

        const stats = getCompletionStats("movie", params());
        expect(stats.attempts).toBe(3);
        expect(stats.finished).toBe(2);
        expect(stats.completionRate).toBe(67);
        expect(stats.histogram).toHaveLength(20);
        expect(stats.histogram[2]).toMatchObject({ from: 10, to: 15, attempts: 1, finished: false });
        expect(stats.histogram[19]).toMatchObject({ from: 95, attempts: 2, finished: true });
        expect(stats.histogram[17].finished).toBe(true); // 85% = the watched line
        expect(stats.histogram[16].finished).toBe(false);
    });

    it("skips unknown positions and misclick attempts", () => {
        insertMedia(1, "movie", "M");
        insertPlay(1, { pct: null });
        insertPlay(1, { userId: "u2", pct: 3, seconds: MIN_ATTEMPT_SECONDS - 1 });
        expect(getCompletionStats("movie", params()).attempts).toBe(0);
    });

    it("ranks titles by attempts and lists the ones people give up on", () => {
        insertMedia(1, "movie", "Loved");
        insertMedia(2, "movie", "Dropped");
        insertMedia(3, "movie", "Too Few");
        for (const u of ["a", "b", "c", "d"]) insertPlay(1, { userId: u, pct: 100 });
        insertPlay(2, { userId: "a", pct: 20 });
        insertPlay(2, { userId: "b", pct: 30 });
        insertPlay(2, { userId: "c", pct: 100 });
        for (let i = 0; i < MIN_TITLE_ATTEMPTS - 1; i++) insertPlay(3, { userId: `x${i}`, pct: 5 });

        const stats = getCompletionStats("movie", params());
        expect(stats.titles.map((t) => t.mediaId)).toEqual([1, 2]);
        expect(stats.titles[0]).toMatchObject({ completionRate: 100, avgStopPercent: null, users: 4 });
        expect(stats.givenUp).toEqual([
            expect.objectContaining({ mediaId: 2, attempts: 3, finished: 1, completionRate: 33, avgStopPercent: 25 }),
        ]);
    });

    it("rolls episodes up to the show, one attempt per episode", () => {
        insertMedia(10, "show", "Show");
        insertMedia(11, "episode", "E1", 10, 1);
        insertMedia(12, "episode", "E2", 10, 2);
        insertPlay(11, { pct: 100 });
        insertPlay(12, { pct: 100 });
        insertPlay(12, { userId: "u2", pct: 50 });

        const stats = getCompletionStats("show", params());
        expect(stats.titles).toEqual([expect.objectContaining({ mediaId: 10, attempts: 3, finished: 2 })]);
        expect(getCompletionStats("movie", params()).attempts).toBe(0);
    });

    it("honours window, server filter and scope", () => {
        insertMedia(1, "movie", "M");
        insertPlay(1, { serverId: "srv-a" });
        insertPlay(1, { serverId: "srv-b", userId: "u2" });
        insertPlay(1, { userId: "u3", start: SINCE - DAY });

        expect(getCompletionStats("movie", params()).attempts).toBe(2);
        expect(getCompletionStats("movie", params({ serverId: "srv-b" })).attempts).toBe(1);
        expect(getCompletionStats("movie", params({ allowedServerIds: ["srv-a"] })).attempts).toBe(1);
    });
});

const play = (over: Partial<EpisodePlay>): EpisodePlay => ({
    userId: "u1",
    user: "U1",
    showId: 10,
    showTitle: "Show",
    episodeId: 1,
    startTime: 0,
    stopTime: 30 * MINUTE,
    ...over,
});

/** `n` consecutive episodes starting at `start`, each 30 min with `gap` between. */
const sequence = (n: number, start: number, gap: number, over: Partial<EpisodePlay> = {}) =>
    Array.from({ length: n }, (_, i) => {
        const s = start + i * (30 * MINUTE + gap);
        return play({ episodeId: i + 1, startTime: s, stopTime: s + 30 * MINUTE, ...over });
    });

describe("detectBinges", () => {
    it(`needs ${MIN_BINGE_EPISODES} distinct episodes within the gap`, () => {
        expect(detectBinges(sequence(MIN_BINGE_EPISODES - 1, 0, 0))).toEqual([]);
        expect(detectBinges(sequence(MIN_BINGE_EPISODES, 0, BINGE_GAP_MS))).toEqual([
            expect.objectContaining({ episodes: MIN_BINGE_EPISODES, startTime: 0 }),
        ]);
    });

    it("breaks on a gap longer than BINGE_GAP_MS", () => {
        expect(detectBinges(sequence(4, 0, BINGE_GAP_MS + 1))).toEqual([]);
    });

    it("breaks on another show and on another user, and ignores repeated episodes", () => {
        const rows = [
            ...sequence(2, 0, 0),
            play({ showId: 99, episodeId: 50, startTime: 60 * MINUTE, stopTime: 90 * MINUTE }),
            play({ episodeId: 3, startTime: 90 * MINUTE, stopTime: 120 * MINUTE }),
            play({ episodeId: 3, startTime: 120 * MINUTE, stopTime: 150 * MINUTE }),
        ];
        expect(detectBinges(rows)).toEqual([]);

        const twoUsers = [...sequence(2, 0, 0), ...sequence(2, 0, 0, { userId: "u2" })];
        expect(detectBinges(twoUsers)).toEqual([]);
    });
});

describe("getBingeStats", () => {
    const seedShow = (showId: number, title: string, episodes: number) => {
        insertMedia(showId, "show", title);
        for (let i = 1; i <= episodes; i++) insertMedia(showId + i, "episode", `E${i}`, showId, i);
    };
    const bingeOf = (showId: number, count: number, userId: string, start: number) => {
        for (let i = 0; i < count; i++) {
            insertPlay(showId + i + 1, { userId, start: start + i * (EPISODE_SECONDS * 1000 + 5 * MINUTE) });
        }
    };

    it("aggregates top shows and the longest binges", () => {
        seedShow(100, "Big", 8);
        seedShow(200, "Small", 4);
        bingeOf(100, 8, "a", IN_WINDOW);
        bingeOf(100, 3, "b", IN_WINDOW);
        bingeOf(200, 4, "a", IN_WINDOW + DAY);
        bingeOf(200, 2, "c", IN_WINDOW); // too short

        const stats = getBingeStats(params());
        expect(stats).toMatchObject({ binges: 3, bingeEpisodes: 15, avgEpisodes: 5, bingers: 2 });
        expect(stats.topShows[0]).toMatchObject({ mediaId: 100, binges: 2, users: 2, longest: 8, avgEpisodes: 5.5 });
        expect(stats.longest.map((r) => [r.showTitle, r.episodes])).toEqual([["Big", 8], ["Small", 4], ["Big", 3]]);
    });

    it("ignores unqualified plays and respects scope", () => {
        seedShow(100, "Show", 3);
        insertPlay(101, { start: IN_WINDOW });
        insertPlay(102, { start: IN_WINDOW + 35 * MINUTE, pct: 5 }); // restart noise breaks nothing, counts nothing
        insertPlay(103, { start: IN_WINDOW + 70 * MINUTE });
        expect(getBingeStats(params()).binges).toBe(0);

        bingeOf(100, 3, "b", IN_WINDOW);
        expect(getBingeStats(params()).binges).toBe(1);
        expect(getBingeStats(params({ allowedServerIds: ["srv-x"] })).binges).toBe(0);
    });
});
