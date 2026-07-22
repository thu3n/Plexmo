import { db } from "../db";
import { Logger } from "../logger";
import { resolveMediaId, parseGuidList, type MediaGuids } from "../history/media-resolve";

/**
 * Rows per invocation — the job is resumable (keyed on mediaId IS NULL).
 * Pure prepared-statement work, no network: 2000 rows well under a second,
 * so a 76k-row backlog clears in under an hour of cron ticks.
 */
const BATCH_SIZE = 2000;

type BackfillRow = {
  id: string;
  serverId: string;
  ratingKey: string;
  title: string;
  plex_guid: string | null;
  imdb_id: string | null;
  tmdb_id: string | null;
  tvdb_id: string | null;
  meta_json: string | null;
};

type ParsedMeta = {
  type?: string;
  title?: string;
  originalTitle?: string;
  year?: number | string;
  grandparentTitle?: string;
  grandparentGuid?: string;
  parentIndex?: number | string;
  index?: number | string;
  Guid?: { id: string }[];
};

// Deliberately NO guid-column filter: rows can resolve via the promoted
// columns, via GUIDs living only inside meta_json.Guid, or — for rows with no
// GUIDs at all — via the media_sources (serverId, ratingKey) cache that the
// library sync keeps warm. Requiring a promoted column here left tens of
// thousands of resolvable rows permanently unprocessed (neither linked nor
// marked), which surfaced as single-server Top movies/shows.
const selectBatch = db.prepare<[number], BackfillRow>(`
  SELECT id, serverId, ratingKey, title, plex_guid, imdb_id, tmdb_id, tvdb_id, meta_json
  FROM activity_history
  WHERE mediaId IS NULL
    AND repair_status IS NOT 'no_media_identity'
  LIMIT ?
`);

const linkStmt = db.prepare(
  "UPDATE activity_history SET mediaId = @mediaId, plex_guid = @plex_guid WHERE id = @id"
);
const markUnresolvable = db.prepare(
  "UPDATE activity_history SET repair_status = 'no_media_identity' WHERE id = @id"
);

/**
 * Link GUID-carrying history rows to canonical media_items. Pure DB work (no
 * network) — the rows already have external ids from import or live sync.
 * Also corrects the legacy grandparent-guid bug: pre-v2 imports stored the
 * SHOW's plex guid on episode rows; the episode's own guid is recovered from
 * meta_json.Guid where possible.
 */
export const runMediaBackfillBatch = (limit: number = BATCH_SIZE): { processed: number; linked: number } => {
  const rows = selectBatch.all(limit);
  let linked = 0;

  for (const row of rows) {
    let meta: ParsedMeta = {};
    try {
      meta = row.meta_json ? (JSON.parse(row.meta_json) as ParsedMeta) : {};
    } catch {
      meta = {};
    }

    const isEpisode = meta.type === "episode" || Boolean(meta.grandparentTitle);
    const metaGuids = parseGuidList(meta.Guid);

    let plexGuid = row.plex_guid ?? undefined;
    if (isEpisode && plexGuid && meta.grandparentGuid && plexGuid === meta.grandparentGuid) {
      // Legacy bug: the column holds the show guid. Use the episode's own
      // guid from meta_json if it survived; otherwise identify by (show, S, E).
      plexGuid = metaGuids.plexGuid;
    }

    const guids: MediaGuids = {
      plexGuid: plexGuid ?? metaGuids.plexGuid,
      imdbId: row.imdb_id ?? metaGuids.imdbId,
      tmdbId: row.tmdb_id ?? metaGuids.tmdbId,
      tvdbId: row.tvdb_id ?? metaGuids.tvdbId,
    };

    const mediaId = resolveMediaId({
      serverId: row.serverId,
      ratingKey: row.ratingKey,
      type: isEpisode ? "episode" : meta.type || "movie",
      title: meta.originalTitle || meta.title || row.title,
      year: meta.year !== undefined ? Number(meta.year) : undefined,
      guids,
      show: isEpisode
        ? {
            plexGuid: meta.grandparentGuid,
            // The row's external ids are of unknown level (legacy imports
            // carry EPISODE-level ids). As show context they can only MATCH
            // a known show item (never create one), so either level is safe —
            // episode-level ids simply match nothing and the title fallback
            // in findOrCreateShow takes over.
            imdbId: guids.imdbId,
            tmdbId: guids.tmdbId,
            tvdbId: guids.tvdbId,
            title: meta.grandparentTitle,
            seasonNumber: meta.parentIndex !== undefined ? Number(meta.parentIndex) : undefined,
            episodeNumber: meta.index !== undefined ? Number(meta.index) : undefined,
          }
        : undefined,
    });

    if (mediaId !== null) {
      linkStmt.run({ mediaId, plex_guid: guids.plexGuid ?? row.plex_guid, id: row.id });
      linked++;
    } else {
      // No safe canonical identity (e.g. episode with only show-level ids).
      // Marked so the batch query stops re-reading it every run.
      markUnresolvable.run({ id: row.id });
    }
  }

  if (rows.length > 0) {
    Logger.info(`[MediaBackfill] Linked ${linked}/${rows.length} history rows to media items.`);
  }
  return { processed: rows.length, linked };
};
