// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { isGenericEpisodeTitle, resolveMediaId } from "@/lib/history/media-resolve";
import { runEpisodeRepairBatch } from "@/lib/media/repair-episode-titles";

let seq = 0;
const insertItem = (opts: {
    type: string;
    title: string;
    plexGuid?: string;
    showMediaId?: number | null;
    season?: number | null;
    episode?: number | null;
}): number => {
    const result = db.prepare(
        `INSERT INTO media_items (type, plex_guid, title, year, showMediaId, seasonNumber, episodeNumber, createdAt, updatedAt)
         VALUES (?, ?, ?, 2026, ?, ?, ?, '2026-01-01', '2026-01-01')`
    ).run(
        opts.type,
        opts.plexGuid ?? null,
        opts.title,
        opts.showMediaId ?? null,
        opts.season ?? null,
        opts.episode ?? null
    );
    return Number(result.lastInsertRowid);
};

const insertPlay = (mediaId: number, meta: object | null) => {
    db.prepare(
        `INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime,
            duration, pausedCounter, mediaId, meta_json
        ) VALUES (?, 'srv-a', '100', 'u', 'T', '1', ?, ?, 600, 0, ?, ?)`
    ).run(`rep-${seq}`, 1000 + seq, 2000 + seq++, mediaId, meta ? JSON.stringify(meta) : null);
};

beforeEach(() => {
    seq = 0;
    db.prepare("DELETE FROM activity_history").run();
    db.prepare("DELETE FROM media_items").run();
    db.prepare("DELETE FROM media_sources").run();
    db.prepare("DELETE FROM settings WHERE key LIKE 'EPISODE_REPAIR%'").run();
});

describe("isGenericEpisodeTitle", () => {
    it("matches Plex's unmatched-episode names", () => {
        expect(isGenericEpisodeTitle("Episode #3.1")).toBe(true);
        expect(isGenericEpisodeTitle("episode #12.10")).toBe(true);
        expect(isGenericEpisodeTitle("Avsnitt 1")).toBe(true);
        expect(isGenericEpisodeTitle(" Avsnitt 7 ")).toBe(true);
    });

    it("does not match real titles", () => {
        expect(isGenericEpisodeTitle("The Book of Doubt")).toBe(false);
        expect(isGenericEpisodeTitle("Episode 3 Special")).toBe(false);
        expect(isGenericEpisodeTitle(null)).toBe(false);
    });
});

describe("resolveMediaId self-healing", () => {
    it("upgrades a generic stored title when a real one arrives", () => {
        const showId = insertItem({ type: "show", title: "Mormon Wives", plexGuid: "plex://show/s1" });
        const epId = insertItem({ type: "episode", title: "Episode #3.1", showMediaId: showId, season: 3, episode: 1 });
        db.prepare(
            "INSERT INTO media_sources (serverId, ratingKey, mediaId, updatedAt) VALUES ('srv-a', 'rk1', ?, '2026-01-01')"
        ).run(epId);

        const resolved = resolveMediaId({
            serverId: "srv-a",
            ratingKey: "rk1",
            type: "episode",
            title: "The Book of Doubt",
            guids: {},
        });

        expect(resolved).toBe(epId);
        const row = db.prepare("SELECT title FROM media_items WHERE id = ?").get(epId) as { title: string };
        expect(row.title).toBe("The Book of Doubt");
    });

    it("never downgrades a real title to a generic one", () => {
        const epId = insertItem({ type: "episode", title: "The Book of Doubt" });
        db.prepare(
            "INSERT INTO media_sources (serverId, ratingKey, mediaId, updatedAt) VALUES ('srv-a', 'rk2', ?, '2026-01-01')"
        ).run(epId);

        resolveMediaId({
            serverId: "srv-a",
            ratingKey: "rk2",
            type: "episode",
            title: "Episode #3.1",
            guids: {},
        });

        const row = db.prepare("SELECT title FROM media_items WHERE id = ?").get(epId) as { title: string };
        expect(row.title).toBe("The Book of Doubt");
    });

    it("links an orphaned episode to its show when the descriptor can resolve one", () => {
        const epId = insertItem({ type: "episode", title: "Episode #1.1" });
        db.prepare(
            "INSERT INTO media_sources (serverId, ratingKey, mediaId, updatedAt) VALUES ('srv-a', 'rk3', ?, '2026-01-01')"
        ).run(epId);

        resolveMediaId({
            serverId: "srv-a",
            ratingKey: "rk3",
            type: "episode",
            title: "Pilot",
            guids: {},
            show: { plexGuid: "plex://show/new", title: "New Show", seasonNumber: 1, episodeNumber: 1 },
        });

        const row = db.prepare("SELECT title, showMediaId, seasonNumber, episodeNumber FROM media_items WHERE id = ?").get(epId) as {
            title: string; showMediaId: number | null; seasonNumber: number | null; episodeNumber: number | null;
        };
        expect(row.title).toBe("Pilot");
        expect(row.showMediaId).not.toBeNull();
        expect(row.seasonNumber).toBe(1);
        expect(row.episodeNumber).toBe(1);
    });
});

describe("runEpisodeRepairBatch", () => {
    it("repairs generic titles from linked history meta snapshots", () => {
        const showId = insertItem({ type: "show", title: "Mormon Wives", plexGuid: "plex://show/s1" });
        const epId = insertItem({ type: "episode", title: "Episode #3.1", showMediaId: showId, season: 3, episode: 1 });
        insertPlay(epId, { title: "The Book of Doubt", grandparentTitle: "Mormon Wives" });
        insertPlay(epId, { title: "The Book of Doubt" });
        insertPlay(epId, { title: "Episode #3.1" });

        const result = runEpisodeRepairBatch();

        expect(result.titlesRepaired).toBe(1);
        const row = db.prepare("SELECT title FROM media_items WHERE id = ?").get(epId) as { title: string };
        expect(row.title).toBe("The Book of Doubt");
    });

    it("links orphans to shows via grandparent identity in meta snapshots", () => {
        const epId = insertItem({ type: "episode", title: "Episode #1.1" });
        insertPlay(epId, {
            title: "Pilot",
            grandparentGuid: "plex://show/gp1",
            grandparentTitle: "Orphan Show",
            parentIndex: 1,
            index: 1,
        });

        const result = runEpisodeRepairBatch();

        expect(result.showsLinked).toBe(1);
        const row = db.prepare("SELECT title, showMediaId FROM media_items WHERE id = ?").get(epId) as {
            title: string; showMediaId: number | null;
        };
        expect(row.title).toBe("Pilot");
        expect(row.showMediaId).not.toBeNull();
        const show = db.prepare("SELECT title FROM media_items WHERE id = ?").get(row.showMediaId!) as { title: string };
        expect(show.title).toBe("Orphan Show");
    });

    it("sleeps after a completed sweep instead of rescanning", () => {
        const epId = insertItem({ type: "episode", title: "Episode #9.9" });
        insertPlay(epId, null);

        const first = runEpisodeRepairBatch();
        expect(first.sweepComplete).toBe(true);
        expect(first.scanned).toBe(1);

        const second = runEpisodeRepairBatch();
        expect(second.scanned).toBe(0);
    });
});
