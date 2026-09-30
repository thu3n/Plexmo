import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { getLibraryItemFacts } from "@/lib/stats/library-value-query";
import { getLibraryValue, staleCutoffFor } from "@/lib/stats/library-value";
import { firstPlayBucket, median } from "@/lib/stats/library-value-timing";

const HOUR = 3600000;
const DAY = 24 * HOUR;
const GB = 1024 ** 3;
const NOW = new Date(2026, 8, 30, 12, 0, 0).getTime();
const LONG_AGO = NOW - 1000 * DAY;
const RECENT = NOW - 10 * DAY;

let seq = 0;

const insertMedia = (id: number, type: string, title: string, showMediaId: number | null = null) => {
    db.prepare(
        `INSERT INTO media_items (id, type, title, year, showMediaId, seasonNumber, episodeNumber, createdAt, updatedAt)
         VALUES (?, ?, ?, 2020, ?, ?, ?, '2026-01-01', '2026-01-01')`
    ).run(id, type, title, showMediaId, showMediaId ? 1 : null, showMediaId ? id : null);
};

const insertItem = (
    mediaId: number | null,
    opts: { type?: string; serverId?: string; sectionKey?: string; addedAt?: number | null; fileSize?: number | null; ratingKey?: string } = {},
) => {
    db.prepare(
        `INSERT INTO library_items (serverId, ratingKey, sectionKey, mediaId, type, title, year, addedAt, fileSize, syncedAt, thumb)
         VALUES (?, ?, ?, ?, ?, ?, 2020, ?, ?, 0, ?)`
    ).run(
        opts.serverId ?? "srv-a",
        opts.ratingKey ?? `rk-${mediaId}-${opts.serverId ?? "srv-a"}`,
        opts.sectionKey ?? (opts.type === "show" ? "2" : "1"),
        mediaId,
        opts.type ?? "movie",
        `Title ${mediaId}`,
        opts.addedAt === undefined ? LONG_AGO : opts.addedAt,
        opts.fileSize === undefined ? 10 * GB : opts.fileSize,
        `/thumb/${mediaId}`,
    );
};

const insertPlay = (
    mediaId: number,
    startTime: number,
    opts: { userId?: string; serverId?: string; percent?: number } = {},
) => {
    const userId = opts.userId ?? `u-${seq}`;
    db.prepare(
        `INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime,
            duration, pausedCounter, play_duration, percent_complete, mediaId
        ) VALUES (?, ?, ?, ?, 'Test', '1', ?, ?, 600, 0, 600, ?, ?)`
    ).run(`lv-${seq++}`, opts.serverId ?? "srv-a", userId, userId, startTime, startTime + 600000, opts.percent ?? 90, mediaId);
};

const value = (params: { serverId?: string; allowedServerIds?: string[]; staleMonths?: number; limit?: number } = {}) =>
    getLibraryValue({ now: NOW, ...params });

beforeEach(() => {
    seq = 0;
    for (const table of ["activity_history", "media_items", "library_items", "library_sections", "servers"]) {
        db.prepare(`DELETE FROM ${table}`).run();
    }
});

describe("getLibraryItemFacts", () => {
    it("counts qualified plays per copy on the same server and ignores unmatched copies", () => {
        insertMedia(1, "movie", "M");
        insertItem(1, { serverId: "srv-a" });
        insertItem(1, { serverId: "srv-b" });
        insertItem(null, { ratingKey: "orphan" });
        insertPlay(1, RECENT, { userId: "x" });
        insertPlay(1, RECENT + HOUR, { userId: "x" }); // same user+day -> deduped
        insertPlay(1, RECENT, { userId: "y" });
        insertPlay(1, RECENT, { userId: "z", percent: 5 }); // not qualified

        const facts = getLibraryItemFacts({});
        expect(facts).toHaveLength(2);
        const a = facts.find((f) => f.serverId === "srv-a");
        const b = facts.find((f) => f.serverId === "srv-b");
        expect(a).toMatchObject({ plays: 2, thumb: { path: "/thumb/1", serverId: "srv-a" } });
        expect(b).toMatchObject({ plays: 0, lastPlayed: null });
    });

    it("matches show copies through episodes and ignores plays before addedAt for first play", () => {
        insertMedia(10, "show", "S");
        insertMedia(11, "episode", "E1", 10);
        insertMedia(12, "episode", "E2", 10);
        insertItem(10, { type: "show", fileSize: null, addedAt: NOW - 100 * DAY });
        insertPlay(11, NOW - 200 * DAY, { userId: "x" }); // before (re-)add
        insertPlay(11, NOW - 97 * DAY, { userId: "x" });
        insertPlay(12, NOW - 97 * DAY, { userId: "x" });

        const [show] = getLibraryItemFacts({});
        expect(show).toMatchObject({ plays: 3, firstPlayAfterAdded: NOW - 97 * DAY, lastPlayed: NOW - 97 * DAY });
    });

    it("honours server filter and authorization scope", () => {
        insertMedia(1, "movie", "M");
        insertItem(1, { serverId: "srv-a" });
        insertItem(1, { serverId: "srv-b" });

        expect(getLibraryItemFacts({ serverId: "srv-b" }).map((f) => f.serverId)).toEqual(["srv-b"]);
        expect(getLibraryItemFacts({ allowedServerIds: ["srv-a"] }).map((f) => f.serverId)).toEqual(["srv-a"]);
        expect(getLibraryItemFacts({ allowedServerIds: ["srv-a"], serverId: "srv-b" })).toEqual([]);
    });
});

describe("dead weight", () => {
    it("lists never/stale-played titles added before the cutoff, largest first, with reclaimable total", () => {
        for (const id of [1, 2, 3, 4, 5]) insertMedia(id, "movie", `M${id}`);
        insertItem(1, { fileSize: 5 * GB }); // never played
        insertItem(2, { fileSize: 20 * GB }); // stale play
        insertItem(3, { fileSize: 50 * GB }); // recently played -> alive
        insertItem(4, { fileSize: 80 * GB, addedAt: RECENT }); // new -> grace
        insertItem(5, { fileSize: null }); // unknown size, never played
        insertPlay(2, NOW - 500 * DAY);
        insertPlay(3, RECENT);

        const { deadWeight, staleCutoff } = value();
        expect(staleCutoff).toBe(staleCutoffFor(NOW, 12));
        expect(deadWeight.movie.items.map((i) => i.mediaId)).toEqual([2, 1, 5]);
        expect(deadWeight.movie).toMatchObject({ count: 3, reclaimableBytes: 25 * GB, unknownSizeCount: 1 });
    });

    it("uses the staleMonths knob and totals beyond the list limit", () => {
        for (const id of [1, 2, 3]) {
            insertMedia(id, "movie", `M${id}`);
            insertItem(id, { fileSize: id * GB });
        }
        insertPlay(1, NOW - 200 * DAY); // stale at 6 months, alive at 12

        expect(value({ staleMonths: 12 }).deadWeight.movie.count).toBe(2);
        const six = value({ staleMonths: 6, limit: 1 }).deadWeight.movie;
        expect(six).toMatchObject({ count: 3, reclaimableBytes: 6 * GB });
        expect(six.items.map((i) => i.mediaId)).toEqual([3]);
    });

    it("separates shows and scopes to allowed servers", () => {
        insertMedia(10, "show", "S");
        insertItem(10, { type: "show", fileSize: null, serverId: "srv-a" });
        insertItem(10, { type: "show", fileSize: null, serverId: "srv-b" });

        expect(value().deadWeight.show.count).toBe(2);
        expect(value().deadWeight.movie.count).toBe(0);
        expect(value({ allowedServerIds: ["srv-b"] }).deadWeight.show.items.map((i) => i.serverId)).toEqual(["srv-b"]);
    });
});

describe("cost per play", () => {
    it("ranks bytes per play both ways without repeating rows", () => {
        for (const id of [1, 2, 3, 4]) insertMedia(id, "movie", `M${id}`);
        insertItem(1, { fileSize: 40 * GB }); // 1 play -> 40 GB/play
        insertItem(2, { fileSize: 10 * GB }); // 5 plays -> 2 GB/play
        insertItem(3, { fileSize: 30 * GB }); // 2 plays -> 15 GB/play
        insertItem(4, { fileSize: 99 * GB }); // never played -> excluded
        insertPlay(1, RECENT);
        for (let i = 0; i < 5; i++) insertPlay(2, RECENT);
        insertPlay(3, RECENT);
        insertPlay(3, RECENT);

        const full = value().costPerPlay;
        expect(full.worst.map((i) => i.mediaId)).toEqual([1, 3, 2]);
        expect(full.worst[0].bytesPerPlay).toBe(40 * GB);
        expect(full.best).toEqual([]);

        const limited = value({ limit: 1 }).costPerPlay;
        expect(limited.worst.map((i) => i.mediaId)).toEqual([1]);
        expect(limited.best.map((i) => i.mediaId)).toEqual([2]);
    });

    it("respects server scope", () => {
        insertMedia(1, "movie", "M");
        insertItem(1, { serverId: "srv-a" });
        insertItem(1, { serverId: "srv-b" });
        insertPlay(1, RECENT, { serverId: "srv-b" });

        expect(value({ allowedServerIds: ["srv-a"] }).costPerPlay.worst).toEqual([]);
        expect(value({ serverId: "srv-b" }).costPerPlay.worst.map((i) => i.serverId)).toEqual(["srv-b"]);
    });
});

describe("time to first play", () => {
    it("buckets delays and takes the median over played copies", () => {
        const added = NOW - 400 * DAY;
        const delays = [2 * HOUR, 3 * DAY, 20 * DAY, 90 * DAY];
        delays.forEach((delay, i) => {
            insertMedia(i + 1, "movie", `M${i}`);
            insertItem(i + 1, { addedAt: added });
            insertPlay(i + 1, added + delay);
        });
        insertMedia(9, "movie", "Never");
        insertItem(9, { addedAt: added });
        insertMedia(8, "movie", "No date");
        insertItem(8, { addedAt: null });

        const stats = value().firstPlay.movie;
        expect(stats).toMatchObject({ total: 5, played: 4, medianMs: (3 * DAY + 20 * DAY) / 2 });
        expect(Object.fromEntries(stats.buckets.map((b) => [b.key, b.count]))).toEqual({
            sameDay: 1, week: 1, month: 1, later: 1, never: 1,
        });
        expect(value().firstPlay.show).toMatchObject({ total: 0, played: 0, medianMs: null });
    });

    it("has boundary-exact buckets and median helpers", () => {
        expect(firstPlayBucket(null)).toBe("never");
        expect(firstPlayBucket(DAY - 1)).toBe("sameDay");
        expect(firstPlayBucket(DAY)).toBe("week");
        expect(firstPlayBucket(7 * DAY)).toBe("month");
        expect(firstPlayBucket(30 * DAY)).toBe("later");
        expect(median([])).toBeNull();
        expect(median([5, 1, 3])).toBe(3);
        expect(median([4, 1, 3, 2])).toBe(2.5);
    });
});

describe("coverage", () => {
    it("reports played share per section and per type, scoped", () => {
        db.prepare(`INSERT INTO servers (id, name, baseUrl, token, createdAt, updatedAt) VALUES ('srv-a', 'Alpha', 'x', 't', '', '')`).run();
        db.prepare(`INSERT INTO library_sections (serverId, sectionKey, title, type) VALUES ('srv-a', '1', 'Films', 'movie')`).run();
        for (const id of [1, 2, 3]) {
            insertMedia(id, "movie", `M${id}`);
            insertItem(id);
        }
        insertMedia(10, "show", "S");
        insertMedia(11, "episode", "E", 10);
        insertItem(10, { type: "show", fileSize: null });
        insertItem(1, { serverId: "srv-b" });
        insertPlay(1, RECENT);
        insertPlay(11, RECENT);

        const coverage = value().coverage;
        expect(coverage.byType).toEqual({ movie: { total: 4, played: 1 }, show: { total: 1, played: 1 } });
        expect(coverage.sections.find((s) => s.serverId === "srv-a" && s.sectionKey === "1")).toMatchObject({
            serverName: "Alpha", sectionTitle: "Films", type: "movie", total: 3, played: 1,
        });

        const scoped = value({ allowedServerIds: ["srv-b"] }).coverage;
        expect(scoped.byType.movie).toEqual({ total: 1, played: 0 });
        expect(scoped.sections).toHaveLength(1);
    });
});
