import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { ABANDON_AFTER_DAYS, getAbandonedSeries } from "@/lib/stats/viewing-behaviour-abandoned";
import {
    MIN_CLIENT_SESSIONS,
    PAUSE_CAP_SECONDS,
    getPauseStats,
    isLikelyBuffering,
} from "@/lib/stats/viewing-behaviour-pauses";

const DAY = 24 * 3600_000;
const NOW = new Date(2026, 6, 20, 12, 0, 0).getTime();
const WINDOW_DAYS = 30;
const SINCE = NOW - WINDOW_DAYS * DAY;

let seq = 0;
type Row = {
    mediaId: number;
    userId?: string;
    serverId?: string;
    start?: number;
    pct?: number | null;
    duration?: number;
    paused?: number;
    platform?: string | null;
    player?: string | null;
};
const insertRow = (r: Row) => {
    const duration = r.duration ?? 1800;
    const paused = r.paused ?? 0;
    const start = r.start ?? NOW - DAY;
    db.prepare(
        `INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration,
            pausedCounter, play_duration, percent_complete, mediaId, platform, player
        ) VALUES (?, ?, ?, ?, 'T', '1', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        `vbs-${seq++}`, r.serverId ?? "srv-a", r.userId ?? "u1", r.userId ?? "u1", start, start + duration * 1000,
        duration, paused, Math.max(0, duration - paused), r.pct === undefined ? 100 : r.pct, r.mediaId,
        r.platform === undefined ? "Roku" : r.platform, r.player === undefined ? null : r.player,
    );
};

const insertMedia = (id: number, type: string, title: string, showMediaId: number | null = null, episode: number | null = null) => {
    db.prepare(
        `INSERT INTO media_items (id, type, title, year, showMediaId, seasonNumber, episodeNumber, createdAt, updatedAt)
         VALUES (?, ?, ?, 2026, ?, ?, ?, '2026-01-01', '2026-01-01')`
    ).run(id, type, title, showMediaId, showMediaId ? 1 : null, episode);
};

/** Show 10 with season-1 episodes 11..14 (episode numbers 1..4). */
const seedShow = () => {
    insertMedia(10, "show", "Show");
    for (let ep = 1; ep <= 4; ep++) insertMedia(10 + ep, "episode", `E${ep}`, 10, ep);
};

const params = (extra: { serverId?: string; allowedServerIds?: string[]; limit?: number; since?: number } = {}) => ({
    since: SINCE,
    until: NOW,
    ...extra,
});

beforeEach(() => {
    seq = 0;
    db.prepare("DELETE FROM activity_history").run();
    db.prepare("DELETE FROM media_items").run();
});

describe("getAbandonedSeries", () => {
    const stalled = NOW - (ABANDON_AFTER_DAYS + 10) * DAY;

    it("lists users who stopped mid-season and never came back, most recent first", () => {
        seedShow();
        // a: E1, E2 of 4 -> abandoned
        insertRow({ mediaId: 11, userId: "a", start: stalled - DAY });
        insertRow({ mediaId: 12, userId: "a", start: stalled });
        // b: watched the whole known season -> between seasons, not abandoned
        for (let ep = 1; ep <= 4; ep++) insertRow({ mediaId: 10 + ep, userId: "b", start: stalled + ep * 1000 });
        // c: left the season finale half-watched -> abandoned (more recent than a)
        insertRow({ mediaId: 13, userId: "c", start: stalled + DAY });
        insertRow({ mediaId: 14, userId: "c", start: stalled + DAY + 1000, pct: 50 });
        // d: came back recently -> not abandoned
        insertRow({ mediaId: 11, userId: "d", start: stalled });
        insertRow({ mediaId: 12, userId: "d", start: stalled });
        insertRow({ mediaId: 13, userId: "d", start: NOW - 5 * DAY });
        // e: only sampled the pilot
        insertRow({ mediaId: 11, userId: "e", start: stalled });

        const stats = getAbandonedSeries(params());
        expect(stats.total).toBe(2);
        expect(stats.items.map((i) => i.userId)).toEqual(["c", "a"]);
        expect(stats.items[1]).toMatchObject({
            showTitle: "Show", seasonNumber: 1, episodeNumber: 2, episodesWatched: 2, lastPercent: 100,
        });
        expect(stats.items[0]).toMatchObject({ episodeNumber: 4, lastPercent: 50 });
        expect(stats.shows).toEqual([{ mediaId: 10, title: "Show", users: 2, thumb: null }]);
    });

    it("windows on when the abandonment became visible, counting episodes from before the window", () => {
        seedShow();
        const longAgo = NOW - 200 * DAY;
        insertRow({ mediaId: 11, userId: "a", start: longAgo - 400 * DAY }); // episode from long before
        insertRow({ mediaId: 12, userId: "a", start: longAgo });

        expect(getAbandonedSeries(params()).total).toBe(0);
        const wide = getAbandonedSeries(params({ since: NOW - 365 * DAY }));
        expect(wide.items).toEqual([expect.objectContaining({ userId: "a", episodesWatched: 2 })]);
    });

    it("respects server filter and scope", () => {
        seedShow();
        insertRow({ mediaId: 11, userId: "a", start: stalled, serverId: "srv-b" });
        insertRow({ mediaId: 12, userId: "a", start: stalled, serverId: "srv-b" });

        expect(getAbandonedSeries(params()).total).toBe(1);
        expect(getAbandonedSeries(params({ serverId: "srv-a" })).total).toBe(0);
        expect(getAbandonedSeries(params({ allowedServerIds: ["srv-a"] })).total).toBe(0);
    });
});

describe("isLikelyBuffering", () => {
    it("needs enough sessions, an absolute floor and a multiple of the baseline", () => {
        expect(isLikelyBuffering(12, 3, MIN_CLIENT_SESSIONS)).toBe(true);
        expect(isLikelyBuffering(12, 3, MIN_CLIENT_SESSIONS - 1)).toBe(false);
        expect(isLikelyBuffering(2, 0.5, MIN_CLIENT_SESSIONS)).toBe(false);
        expect(isLikelyBuffering(5, 3, MIN_CLIENT_SESSIONS)).toBe(false);
    });
});

describe("getPauseStats", () => {
    it("computes paused minutes per playback hour and flags outlier clients", () => {
        insertMedia(1, "movie", "Film");
        for (let i = 0; i < 10; i++) {
            insertRow({ mediaId: 1, userId: `r${i}`, platform: "Roku", player: "Roku Ultra", duration: 3600, paused: 600 });
        }
        for (let i = 0; i < 30; i++) {
            insertRow({ mediaId: 1, userId: `c${i}`, platform: "Chrome", player: "Chrome", duration: 3600, paused: 60 });
        }
        insertRow({ mediaId: 1, platform: "Chrome", player: "Chrome", duration: 120, paused: 100 }); // too short

        const stats = getPauseStats(params());
        expect(stats.sessions).toBe(40);
        expect(stats.minutesPerHour).toBeCloseTo(3.4, 1);
        expect(stats.clients).toEqual([
            expect.objectContaining({ label: "Roku Ultra", sub: "Roku", sessions: 10, minutesPerHour: 12, flagged: true, pausedSessionShare: 100 }),
            expect.objectContaining({ label: "Chrome", sessions: 30, minutesPerHour: 1, flagged: false }),
        ]);
        expect(stats.titles).toEqual([expect.objectContaining({ key: "1", label: "Film", sessions: 40, flagged: false })]);
    });

    it("caps a session left paused for hours and rolls episodes up to the show", () => {
        insertMedia(10, "show", "Show");
        insertMedia(11, "episode", "E1", 10, 1);
        insertMedia(12, "episode", "E2", 10, 2);
        insertRow({ mediaId: 11, duration: 3600 + 20_000, paused: 20_000 });
        insertRow({ mediaId: 12, duration: 3600 });
        insertRow({ mediaId: 12, userId: "u2", duration: 3600 });

        const stats = getPauseStats(params());
        const [title] = stats.titles;
        expect(title).toMatchObject({ key: "10", label: "Show", sessions: 3, pausedSessionShare: 33 });
        expect(title.minutesPerHour).toBeCloseTo(PAUSE_CAP_SECONDS / 60 / 3, 1);
        expect(stats.clients).toEqual([]); // under MIN_CLIENT_SESSIONS
    });
});
