import { db } from "../db";
import { Logger } from "../logger";
import { isGenericEpisodeTitle } from "../history/media-resolve";
import { getSetting, setSetting } from "../settings";

/**
 * Merges duplicate show items created by the legacy grandparent-guid bug:
 * pre-v2 imports stored an EPISODE guid as a show's identity, so the same
 * series exists several times (fragmenting stats and breaking posters — the
 * bogus shows are never in library_items, so their poster falls back to a
 * stale ratingKey that Plex may have reassigned to unrelated media).
 *
 * Only provably-correct merges happen:
 * - A dupe (type='show', plex_guid LIKE 'plex://episode/%') merges only when
 *   EXACTLY ONE properly-identified show shares its title.
 * - An episode folds into the target's same-(S,E) episode only when the titles
 *   are compatible (equal, or one side generic) — chimera episodes that ended
 *   up under the wrong show (e.g. "Missing People" under "Solsidan") stay put
 *   rather than being guessed into the wrong series.
 * The dupe show is deleted only when it ends up empty; its media_sources rows
 * are dropped (legacy stale pointers — repointing them would poison the
 * target's poster fallback).
 */
const RESWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SWEPT_AT_KEY = "SHOW_DEDUP_SWEPT_AT";

type ShowRow = { id: number; title: string };
type EpisodeRow = {
    id: number;
    title: string;
    seasonNumber: number | null;
    episodeNumber: number | null;
};

const selectDupeShows = db.prepare<[], ShowRow>(`
    SELECT id, title FROM media_items
    WHERE type = 'show' AND plex_guid LIKE 'plex://episode/%'
`);
const selectProperShowsByTitle = db.prepare<[string], ShowRow>(`
    SELECT id, title FROM media_items
    WHERE type = 'show'
      AND title = ? COLLATE NOCASE
      AND (plex_guid IS NULL OR plex_guid NOT LIKE 'plex://episode/%')
    LIMIT 2
`);
const selectEpisodesOfShow = db.prepare<[number], EpisodeRow>(`
    SELECT id, title, seasonNumber, episodeNumber FROM media_items WHERE showMediaId = ?
`);
const selectTargetEpisode = db.prepare<[number, number, number], EpisodeRow>(`
    SELECT id, title, seasonNumber, episodeNumber FROM media_items
    WHERE showMediaId = ? AND seasonNumber = ? AND episodeNumber = ?
    LIMIT 1
`);

const repointHistory = db.prepare("UPDATE activity_history SET mediaId = @to WHERE mediaId = @from");
const repointSources = db.prepare("UPDATE media_sources SET mediaId = @to WHERE mediaId = @from");
const rehomeEpisode = db.prepare("UPDATE media_items SET showMediaId = @to, updatedAt = @now WHERE id = @id");
const upgradeTitle = db.prepare("UPDATE media_items SET title = @title, updatedAt = @now WHERE id = @id");
const deleteItem = db.prepare("DELETE FROM media_items WHERE id = ?");
const deleteSourcesOf = db.prepare("DELETE FROM media_sources WHERE mediaId = ?");
const countEpisodesOf = db.prepare<[number], { c: number }>(
    "SELECT COUNT(*) c FROM media_items WHERE showMediaId = ?"
);

const titlesCompatible = (a: string, b: string): boolean =>
    a.trim().toLowerCase() === b.trim().toLowerCase() ||
    isGenericEpisodeTitle(a) ||
    isGenericEpisodeTitle(b);

export type ShowDedupResult = {
    dupesScanned: number;
    showsMerged: number;
    episodesMerged: number;
    episodesRehomed: number;
    episodesSkipped: number;
};

export const runShowDedup = (): ShowDedupResult => {
    const result: ShowDedupResult = {
        dupesScanned: 0,
        showsMerged: 0,
        episodesMerged: 0,
        episodesRehomed: 0,
        episodesSkipped: 0,
    };

    const sweptAt = Number(getSetting(SWEPT_AT_KEY) ?? "0");
    if (sweptAt > 0 && Date.now() - sweptAt < RESWEEP_INTERVAL_MS) return result;

    const dupes = selectDupeShows.all();
    const now = new Date().toISOString();

    for (const dupe of dupes) {
        result.dupesScanned += 1;
        const targets = selectProperShowsByTitle.all(dupe.title).filter((t) => t.id !== dupe.id);
        if (targets.length !== 1) continue;
        const target = targets[0];

        const mergeShow = db.transaction(() => {
            for (const episode of selectEpisodesOfShow.all(dupe.id)) {
                if (episode.seasonNumber === null || episode.episodeNumber === null) {
                    result.episodesSkipped += 1;
                    continue;
                }
                const counterpart = selectTargetEpisode.get(
                    target.id,
                    episode.seasonNumber,
                    episode.episodeNumber
                );
                if (!counterpart) {
                    rehomeEpisode.run({ id: episode.id, to: target.id, now });
                    result.episodesRehomed += 1;
                    continue;
                }
                if (!titlesCompatible(episode.title, counterpart.title)) {
                    result.episodesSkipped += 1;
                    continue;
                }
                repointHistory.run({ from: episode.id, to: counterpart.id });
                repointSources.run({ from: episode.id, to: counterpart.id });
                if (isGenericEpisodeTitle(counterpart.title) && !isGenericEpisodeTitle(episode.title)) {
                    upgradeTitle.run({ id: counterpart.id, title: episode.title, now });
                }
                deleteItem.run(episode.id);
                result.episodesMerged += 1;
            }

            if (countEpisodesOf.get(dupe.id)!.c === 0) {
                repointHistory.run({ from: dupe.id, to: target.id });
                deleteSourcesOf.run(dupe.id);
                deleteItem.run(dupe.id);
                result.showsMerged += 1;
            }
        });

        try {
            mergeShow();
        } catch (e) {
            Logger.error(`[ShowDedup] Merge failed for show ${dupe.id} ("${dupe.title}"):`, e);
        }
    }

    setSetting(SWEPT_AT_KEY, String(Date.now()));
    if (result.dupesScanned > 0) {
        Logger.info(
            `[ShowDedup] dupes=${result.dupesScanned} merged=${result.showsMerged} epMerged=${result.episodesMerged} rehomed=${result.episodesRehomed} skipped=${result.episodesSkipped}`
        );
    }
    return result;
};
