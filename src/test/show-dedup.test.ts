// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { runShowDedup } from "@/lib/media/dedup-shows";

let seq = 0;
const insertShow = (title: string, plexGuid: string | null): number =>
    Number(
        db.prepare(
            `INSERT INTO media_items (type, plex_guid, title, year, createdAt, updatedAt)
             VALUES ('show', ?, ?, 2020, '2026-01-01', '2026-01-01')`
        ).run(plexGuid, title).lastInsertRowid
    );

const insertEpisode = (showId: number, title: string, season: number | null, episode: number | null): number =>
    Number(
        db.prepare(
            `INSERT INTO media_items (type, title, year, showMediaId, seasonNumber, episodeNumber, createdAt, updatedAt)
             VALUES ('episode', ?, 2020, ?, ?, ?, '2026-01-01', '2026-01-01')`
        ).run(title, showId, season, episode).lastInsertRowid
    );

const insertPlay = (mediaId: number) => {
    db.prepare(
        `INSERT INTO activity_history (id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration, pausedCounter, mediaId)
         VALUES (?, 'srv-a', '100', 'u', 'T', '1', ?, ?, 600, 0, ?)`
    ).run(`dd-${seq}`, 1000 + seq, 2000 + seq++, mediaId);
};

beforeEach(() => {
    seq = 0;
    db.prepare("DELETE FROM activity_history").run();
    db.prepare("DELETE FROM media_items").run();
    db.prepare("DELETE FROM media_sources").run();
    db.prepare("DELETE FROM settings WHERE key LIKE 'SHOW_DEDUP%'").run();
});

describe("runShowDedup", () => {
    it("merges an episode-guid dupe show into the single proper show with the same title", () => {
        const real = insertShow("Solsidan", "plex://show/real");
        const realEp = insertEpisode(real, "Avsnitt 5", 4, 5);
        const dupe = insertShow("Solsidan", "plex://episode/legacy");
        const dupeEp = insertEpisode(dupe, "Victors förhållande", 4, 5);
        insertPlay(dupeEp);
        db.prepare(
            "INSERT INTO media_sources (serverId, ratingKey, mediaId, updatedAt) VALUES ('srv-a', 'stale', ?, '2026-01-01')"
        ).run(dupe);

        const result = runShowDedup();

        expect(result.showsMerged).toBe(1);
        expect(result.episodesMerged).toBe(1);
        // Play repointed to the surviving episode, whose generic title upgraded.
        const play = db.prepare("SELECT mediaId FROM activity_history WHERE id = 'dd-0'").get() as { mediaId: number };
        expect(play.mediaId).toBe(realEp);
        const ep = db.prepare("SELECT title FROM media_items WHERE id = ?").get(realEp) as { title: string };
        expect(ep.title).toBe("Victors förhållande");
        // Dupe show, its episode, and its stale sources are gone.
        expect(db.prepare("SELECT COUNT(*) c FROM media_items WHERE id IN (?, ?)").get(dupe, dupeEp)).toEqual({ c: 0 });
        expect(db.prepare("SELECT COUNT(*) c FROM media_sources WHERE mediaId = ?").get(dupe)).toEqual({ c: 0 });
    });

    it("leaves chimera episodes (incompatible titles) untouched and keeps the dupe show", () => {
        const real = insertShow("Solsidan", "plex://show/real");
        insertEpisode(real, "Victors förhållande", 4, 5);
        const dupe = insertShow("Solsidan", "plex://episode/legacy");
        const chimera = insertEpisode(dupe, "Missing People", 4, 5);
        insertPlay(chimera);

        const result = runShowDedup();

        expect(result.episodesSkipped).toBe(1);
        expect(result.showsMerged).toBe(0);
        const row = db.prepare("SELECT showMediaId FROM media_items WHERE id = ?").get(chimera) as { showMediaId: number };
        expect(row.showMediaId).toBe(dupe);
    });

    it("rehomes episodes without a counterpart to the target show", () => {
        const real = insertShow("Solsidan", "plex://show/real");
        const dupe = insertShow("Solsidan", "plex://episode/legacy");
        const ep = insertEpisode(dupe, "Musen", 9, 7);

        const result = runShowDedup();

        expect(result.episodesRehomed).toBe(1);
        expect(result.showsMerged).toBe(1);
        const row = db.prepare("SELECT showMediaId FROM media_items WHERE id = ?").get(ep) as { showMediaId: number };
        expect(row.showMediaId).toBe(real);
    });

    it("does nothing when the target is ambiguous (two proper shows share the title)", () => {
        insertShow("Solsidan", "plex://show/real1");
        insertShow("Solsidan", "plex://show/real2");
        const dupe = insertShow("Solsidan", "plex://episode/legacy");
        const ep = insertEpisode(dupe, "Musen", 9, 7);

        const result = runShowDedup();

        expect(result.showsMerged).toBe(0);
        const row = db.prepare("SELECT showMediaId FROM media_items WHERE id = ?").get(ep) as { showMediaId: number };
        expect(row.showMediaId).toBe(dupe);
    });

    it("sleeps after a sweep instead of rescanning", () => {
        insertShow("Solsidan", "plex://show/real");
        insertShow("Solsidan", "plex://episode/legacy");

        expect(runShowDedup().dupesScanned).toBe(1);
        expect(runShowDedup().dupesScanned).toBe(0);
    });
});
