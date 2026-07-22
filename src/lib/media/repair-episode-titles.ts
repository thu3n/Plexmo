import { db } from "../db";
import { Logger } from "../logger";
import { findOrCreateShow, isGenericEpisodeTitle } from "../history/media-resolve";
import { getSetting, setSetting } from "../settings";

/**
 * Batch repair for canonical episode items whose data froze in a bad state:
 * generic titles ("Episode #3.1"/"Avsnitt 1" — whatever the FIRST recording
 * server reported) and missing show links. The cure lives in the linked
 * activity_history rows: their meta_json snapshots carry the real episode
 * title and grandparent (show) identity from every later, properly-matched
 * play. Pure DB work, no network. Resumable via a settings-table cursor;
 * after a full sweep it sleeps for RESWEEP_INTERVAL_MS (the live upgrade path
 * in media-resolve keeps new data clean between sweeps).
 */
const DEFAULT_BATCH_SIZE = 200;
const MAX_HISTORY_ROWS_PER_ITEM = 200;
const RESWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CURSOR_KEY = "EPISODE_REPAIR_CURSOR";
const SWEPT_AT_KEY = "EPISODE_REPAIR_SWEPT_AT";

type CandidateRow = {
    id: number;
    title: string;
    showMediaId: number | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
};

type HistoryMetaRow = { meta_json: string | null };

type ParsedMeta = {
    title?: string;
    grandparentTitle?: string;
    grandparentGuid?: string;
    parentIndex?: number | string;
    index?: number | string;
};

const selectCandidates = db.prepare<[number, number], CandidateRow>(`
    SELECT id, title, showMediaId, seasonNumber, episodeNumber
    FROM media_items
    WHERE type = 'episode'
      AND id > ?
      AND (title LIKE 'Episode #%' OR title LIKE 'Avsnitt %' OR showMediaId IS NULL)
    ORDER BY id
    LIMIT ?
`);

const selectHistoryMeta = db.prepare<[number, number], HistoryMetaRow>(`
    SELECT meta_json FROM activity_history
    WHERE mediaId = ? AND meta_json IS NOT NULL
    ORDER BY startTime DESC
    LIMIT ?
`);

const updateTitle = db.prepare(
    "UPDATE media_items SET title = @title, updatedAt = @now WHERE id = @id"
);
const linkShow = db.prepare(`
    UPDATE media_items SET
        showMediaId = @showMediaId,
        seasonNumber = COALESCE(seasonNumber, @seasonNumber),
        episodeNumber = COALESCE(episodeNumber, @episodeNumber),
        updatedAt = @now
    WHERE id = @id AND showMediaId IS NULL
`);

const toNumber = (value: number | string | undefined): number | undefined => {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
};

const parseMetas = (rows: HistoryMetaRow[]): ParsedMeta[] => {
    const metas: ParsedMeta[] = [];
    for (const row of rows) {
        if (!row.meta_json) continue;
        try {
            metas.push(JSON.parse(row.meta_json) as ParsedMeta);
        } catch {
            // Corrupt snapshot — skip the row, the others still carry signal.
        }
    }
    return metas;
};

/** Most frequent non-generic episode title across the linked plays. */
const bestTitle = (metas: ParsedMeta[]): string | null => {
    const counts = new Map<string, number>();
    for (const meta of metas) {
        const title = meta.title?.trim();
        if (!title || isGenericEpisodeTitle(title)) continue;
        counts.set(title, (counts.get(title) ?? 0) + 1);
    }
    let winner: string | null = null;
    let max = 0;
    for (const [title, count] of counts) {
        if (count > max) {
            winner = title;
            max = count;
        }
    }
    return winner;
};

export type EpisodeRepairResult = {
    scanned: number;
    titlesRepaired: number;
    showsLinked: number;
    sweepComplete: boolean;
};

export const runEpisodeRepairBatch = (
    batchSize: number = DEFAULT_BATCH_SIZE
): EpisodeRepairResult => {
    const result: EpisodeRepairResult = {
        scanned: 0,
        titlesRepaired: 0,
        showsLinked: 0,
        sweepComplete: false,
    };

    const cursor = Number(getSetting(CURSOR_KEY) ?? "0");
    const sweptAt = Number(getSetting(SWEPT_AT_KEY) ?? "0");
    if (cursor === 0 && sweptAt > 0 && Date.now() - sweptAt < RESWEEP_INTERVAL_MS) {
        return result;
    }

    const candidates = selectCandidates.all(cursor, batchSize);
    const now = new Date().toISOString();

    const runBatch = db.transaction(() => {
        for (const item of candidates) {
            result.scanned += 1;
            const metas = parseMetas(selectHistoryMeta.all(item.id, MAX_HISTORY_ROWS_PER_ITEM));
            if (metas.length === 0) continue;

            if (isGenericEpisodeTitle(item.title)) {
                const title = bestTitle(metas);
                if (title) {
                    updateTitle.run({ id: item.id, title, now });
                    result.titlesRepaired += 1;
                }
            }

            if (item.showMediaId === null) {
                const meta = metas.find((m) => m.grandparentGuid || m.grandparentTitle);
                if (meta) {
                    const showMediaId = findOrCreateShow({
                        plexGuid: meta.grandparentGuid?.startsWith("plex://")
                            ? meta.grandparentGuid
                            : undefined,
                        title: meta.grandparentTitle,
                        seasonNumber: toNumber(meta.parentIndex),
                        episodeNumber: toNumber(meta.index),
                    });
                    if (showMediaId !== null && showMediaId !== item.id) {
                        linkShow.run({
                            id: item.id,
                            showMediaId,
                            seasonNumber: toNumber(meta.parentIndex) ?? null,
                            episodeNumber: toNumber(meta.index) ?? null,
                            now,
                        });
                        result.showsLinked += 1;
                    }
                }
            }
        }
    });

    try {
        runBatch();
    } catch (e) {
        Logger.error("[EpisodeRepair] Batch failed:", e);
        return result;
    }

    if (candidates.length < batchSize) {
        // Full sweep done — rest until the next interval, then rescan (items
        // that stay generic because no linked play carries a real title yet
        // may have healable data by then).
        setSetting(CURSOR_KEY, "0");
        setSetting(SWEPT_AT_KEY, String(Date.now()));
        result.sweepComplete = true;
    } else {
        setSetting(CURSOR_KEY, String(candidates[candidates.length - 1].id));
    }

    if (result.titlesRepaired > 0 || result.showsLinked > 0) {
        Logger.info(
            `[EpisodeRepair] scanned=${result.scanned} titles=${result.titlesRepaired} shows=${result.showsLinked}`
        );
    }
    return result;
};
