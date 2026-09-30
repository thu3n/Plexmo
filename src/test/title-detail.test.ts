import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { isTitleVisible, resolveTitle, type TitleRef } from "@/lib/stats/title-detail-query";
import { getTitleDetail } from "@/lib/stats/title-detail";
import { getAlsoWatched } from "@/lib/stats/title-detail-also-watched";

const HOUR = 3600000;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 8, 20, 20, 0, 0).getTime();
const SINCE = NOW - 30 * DAY;

let seq = 0;
type PlayOpts = { serverId?: string; percent?: number | null; seconds?: number; decision?: string; resolution?: string; at?: number };

const insertPlay = (mediaId: number, userId: string, opts: PlayOpts = {}) => {
    const at = opts.at ?? NOW - 2 * DAY;
    const seconds = opts.seconds ?? 3000;
    db.prepare(
        `INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration, pausedCounter,
            play_duration, percent_complete, mediaId, transcode_decision, stream_video_resolution
        ) VALUES (?, ?, ?, ?, 'T', '1', ?, ?, ?, 0, ?, ?, ?, ?, ?)`
    ).run(
        `td-${seq++}`, opts.serverId ?? "srv-a", userId, `name-${userId}`, at, at + seconds * 1000, seconds, seconds,
        opts.percent === undefined ? 90 : opts.percent, mediaId, opts.decision ?? "direct play", opts.resolution ?? "1080",
    );
};

const insertMedia = (id: number, type: string, title: string, show: { showId: number; season: number; episode: number } | null = null) => {
    db.prepare(
        `INSERT INTO media_items (id, type, title, year, showMediaId, seasonNumber, episodeNumber, createdAt, updatedAt)
         VALUES (?, ?, ?, 2020, ?, ?, ?, '2026-01-01', '2026-01-01')`
    ).run(id, type, title, show?.showId ?? null, show?.season ?? null, show?.episode ?? null);
};

const ref = (mediaId: number): TitleRef => {
    const resolved = resolveTitle(mediaId);
    if (!resolved) throw new Error(`media ${mediaId} missing`);
    return resolved;
};

beforeEach(() => {
    seq = 0;
    for (const table of ["activity_history", "media_items", "library_items", "media_sources", "user_identities"]) {
        db.prepare(`DELETE FROM ${table}`).run();
    }
    insertMedia(1, "movie", "Movie One");
    insertMedia(2, "movie", "Movie Two");
    insertMedia(3, "movie", "Movie Three");
    insertMedia(10, "show", "Show");
    insertMedia(11, "episode", "Pilot", { showId: 10, season: 1, episode: 1 });
    insertMedia(12, "episode", "Second", { showId: 10, season: 1, episode: 2 });
    insertMedia(13, "episode", "Premiere", { showId: 10, season: 2, episode: 1 });
});

describe("resolveTitle", () => {
    it("returns the canonical row with the parent show for episodes", () => {
        expect(resolveTitle(12)).toMatchObject({ type: "episode", showMediaId: 10, showTitle: "Show", seasonNumber: 1, episodeNumber: 2 });
        expect(resolveTitle(999)).toBeNull();
    });

    it("rejects non-title media types", () => {
        insertMedia(50, "track", "Song");
        expect(resolveTitle(50)).toBeNull();
    });
});

describe("isTitleVisible", () => {
    it("is unrestricted without a scope", () => {
        expect(isTitleVisible(ref(1))).toBe(true);
    });

    it("requires history, inventory or a source on an allowed server", () => {
        insertPlay(1, "u1", { serverId: "srv-b" });
        expect(isTitleVisible(ref(1), ["srv-a"])).toBe(false);
        expect(isTitleVisible(ref(1), ["srv-b"])).toBe(true);

        db.prepare(`INSERT INTO media_sources (serverId, ratingKey, mediaId, updatedAt) VALUES ('srv-c', '9', 2, '2026')`).run();
        expect(isTitleVisible(ref(2), ["srv-c"])).toBe(true);
        expect(isTitleVisible(ref(2), ["srv-a"])).toBe(false);
    });

    it("sees a show through its episodes", () => {
        insertPlay(11, "u1", { serverId: "srv-a" });
        expect(isTitleVisible(ref(10), ["srv-a"])).toBe(true);
        expect(isTitleVisible(ref(10), ["srv-b"])).toBe(false);
    });
});

describe("getTitleDetail", () => {
    it("summarises a movie with qualified, (user, day)-deduped plays", () => {
        insertPlay(1, "u1", { percent: 50 });
        insertPlay(1, "u1", { percent: 95, at: NOW - 2 * DAY + HOUR }); // same day → same play
        insertPlay(1, "u2", { percent: 80, decision: "transcode", resolution: "720" });
        insertPlay(1, "u3", { percent: 5, seconds: 60 }); // not a qualified play

        const detail = getTitleDetail(ref(1), { since: SINCE }, "day");
        expect(detail.summary).toMatchObject({ plays: 2, sessions: 4, uniqueUsers: 2 });
        // Furthest per viewer: u1 95, u2 80, u3 5 → mean 60.
        expect(detail.summary.avgCompletion).toBe(60);
        expect(detail.viewers.map((v) => v.accountId)).toEqual(["u1", "u2", "u3"]);
        expect(detail.viewers[0]).toMatchObject({ plays: 1, completion: 95, episodes: null, user: "name-u1" });
        expect(detail.decisions).toEqual(expect.arrayContaining([
            { bucket: "direct play", total: 3 },
            { bucket: "transcode", total: 1 },
        ]));
        expect(detail.series).toHaveLength(1);
        expect(detail.series[0]).toMatchObject({ plays: 2, users: 3 });
        expect(detail.episodes).toBeNull();
    });

    it("rolls a show up over its episodes with an episode breakdown", () => {
        insertPlay(11, "u1");
        insertPlay(12, "u1");
        insertPlay(13, "u2");
        insertPlay(2, "u1"); // another title — must not count

        const detail = getTitleDetail(ref(10), { since: SINCE }, "day");
        expect(detail.summary).toMatchObject({ plays: 3, uniqueUsers: 2 });
        expect(detail.viewers[0]).toMatchObject({ accountId: "u1", plays: 2, episodes: 2, completion: null });
        expect(detail.episodes?.map((e) => [e.seasonNumber, e.episodeNumber, e.plays])).toEqual([
            [1, 1, 1],
            [1, 2, 1],
            [2, 1, 1],
        ]);
    });

    it("never counts rows outside the scope, the server filter or the window", () => {
        insertPlay(1, "u1", { serverId: "srv-a" });
        insertPlay(1, "u2", { serverId: "srv-b" });
        insertPlay(1, "u3", { serverId: "srv-a", at: SINCE - DAY });

        expect(getTitleDetail(ref(1), { since: SINCE, allowedServerIds: ["srv-a"] }, "day").summary.sessions).toBe(1);
        expect(getTitleDetail(ref(1), { since: SINCE, serverId: "srv-b" }, "day").servers.map((s) => s.serverId)).toEqual(["srv-b"]);
        expect(getTitleDetail(ref(1), { since: SINCE }, "day").servers).toHaveLength(2);
    });
});

describe("getAlsoWatched", () => {
    it("ranks other titles by viewers shared with the source title", () => {
        insertPlay(1, "u1");
        insertPlay(1, "u2");
        insertPlay(1, "u3");
        insertPlay(2, "u1"); // 1 shared viewer
        insertPlay(11, "u1"); // show via episodes: 2 shared viewers
        insertPlay(12, "u2");
        insertPlay(3, "u9"); // no overlap
        insertPlay(3, "u1", { percent: 5, seconds: 60 }); // unqualified — ignored

        const items = getAlsoWatched(ref(1), { since: SINCE });
        expect(items.map((i) => [i.mediaId, i.sharedUsers])).toEqual([[10, 2], [2, 1]]);
        expect(items[0]).toMatchObject({ type: "show", title: "Show" });
    });

    it("excludes an episode's own show and respects the scope", () => {
        insertPlay(11, "u1", { serverId: "srv-a" });
        insertPlay(12, "u1", { serverId: "srv-a" });
        insertPlay(2, "u1", { serverId: "srv-a" });
        insertPlay(3, "u1", { serverId: "srv-b" });

        // Ties (one shared viewer, one play each) fall back to title order: "Movie Three" < "Movie Two".
        expect(getAlsoWatched(ref(11), { since: SINCE }).map((i) => i.mediaId)).toEqual([3, 2]);
        expect(getAlsoWatched(ref(11), { since: SINCE, allowedServerIds: ["srv-a"] }).map((i) => i.mediaId)).toEqual([2]);
    });
});
