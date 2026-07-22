import { db } from "../db";
import { Logger } from "../logger";
import type { MediaItemRow } from "../db-types";

export type MediaGuids = {
  plexGuid?: string;
  imdbId?: string;
  tmdbId?: string;
  tvdbId?: string;
};

/** Parse a Plex Guid child array (imdb://, tmdb://, tvdb://, plex://) into ids. */
export const parseGuidList = (guids: { id: string }[] | undefined): MediaGuids => {
  const out: MediaGuids = {};
  for (const g of guids ?? []) {
    if (!g?.id) continue;
    if (g.id.startsWith("plex://")) out.plexGuid = g.id;
    else if (g.id.startsWith("imdb://")) out.imdbId = g.id.slice("imdb://".length);
    else if (g.id.startsWith("tmdb://")) out.tmdbId = g.id.slice("tmdb://".length);
    else if (g.id.startsWith("tvdb://")) out.tvdbId = g.id.slice("tvdb://".length);
  }
  return out;
};

export type MediaDescriptor = {
  serverId: string;
  ratingKey: string;
  /** Plex metadata type: movie | episode | show | track | ... */
  type: string;
  title: string;
  year?: number;
  guids: MediaGuids;
  /** Episode context: identifies/creates the parent show item. */
  show?: {
    plexGuid?: string;
    /** Show-level external ids (e.g. from legacy imports where the episode
     *  row's ids are the show's). Only used to MATCH an existing show item —
     *  never to create one — so an episode-level id can't mislink. */
    imdbId?: string;
    tmdbId?: string;
    tvdbId?: string;
    title?: string;
    seasonNumber?: number;
    episodeNumber?: number;
  };
};

const findByPlexGuid = db.prepare<[string], MediaItemRow>(
  "SELECT * FROM media_items WHERE plex_guid = ?"
);
const findByExternalId = db.prepare<[string, string, string, string], MediaItemRow>(
  `SELECT * FROM media_items
   WHERE type = ? AND (
     (tmdb_id IS NOT NULL AND tmdb_id = ?) OR
     (imdb_id IS NOT NULL AND imdb_id = ?) OR
     (tvdb_id IS NOT NULL AND tvdb_id = ?)
   ) LIMIT 1`
);
const findEpisodeByNumber = db.prepare<[number, number, number], MediaItemRow>(
  `SELECT * FROM media_items
   WHERE showMediaId = ? AND seasonNumber = ? AND episodeNumber = ? LIMIT 1`
);
const findSource = db.prepare<[string, string], { mediaId: number }>(
  "SELECT mediaId FROM media_sources WHERE serverId = ? AND ratingKey = ?"
);
const upsertSource = db.prepare(`
  INSERT INTO media_sources (serverId, ratingKey, mediaId, updatedAt)
  VALUES (@serverId, @ratingKey, @mediaId, @updatedAt)
  ON CONFLICT(serverId, ratingKey) DO UPDATE SET
    mediaId = excluded.mediaId,
    updatedAt = excluded.updatedAt
`);
const insertItem = db.prepare(`
  INSERT INTO media_items (type, plex_guid, imdb_id, tmdb_id, tvdb_id, title, year,
    showMediaId, seasonNumber, episodeNumber, createdAt, updatedAt)
  VALUES (@type, @plex_guid, @imdb_id, @tmdb_id, @tvdb_id, @title, @year,
    @showMediaId, @seasonNumber, @episodeNumber, @now, @now)
`);

const createItem = (item: {
  type: string;
  title: string;
  year?: number;
  guids: MediaGuids;
  showMediaId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
}): number => {
  const result = insertItem.run({
    type: item.type,
    plex_guid: item.guids.plexGuid ?? null,
    imdb_id: item.guids.imdbId ?? null,
    tmdb_id: item.guids.tmdbId ?? null,
    tvdb_id: item.guids.tvdbId ?? null,
    title: item.title,
    year: item.year ?? null,
    showMediaId: item.showMediaId ?? null,
    seasonNumber: item.seasonNumber ?? null,
    episodeNumber: item.episodeNumber ?? null,
    now: new Date().toISOString(),
  });
  return Number(result.lastInsertRowid);
};

/** Plex names unmatched episodes "Episode #S.E" (or "Avsnitt N" in Swedish
 * libraries). Such a title must never win over a real one — used both by the
 * live upgrade path below and the batch repair job. */
export const isGenericEpisodeTitle = (title: string | null | undefined): boolean =>
  !!title && /^(episode #\d+\.\d+|avsnitt \d+)$/i.test(title.trim());

export const findOrCreateShow = (show: NonNullable<MediaDescriptor["show"]>): number | null => {
  if (show.plexGuid) {
    const existing = findByPlexGuid.get(show.plexGuid);
    if (existing) return existing.id;
    return createItem({
      type: "show",
      title: show.title || "Unknown Show",
      guids: { plexGuid: show.plexGuid },
    });
  }
  // No plex guid: match (never create) via show-level external ids. Only an
  // id that already belongs to a known show item can match, so ids of unknown
  // level (legacy imports) are safe here.
  if (show.tmdbId || show.imdbId || show.tvdbId) {
    const existing = findByExternalId.get("show", show.tmdbId ?? "", show.imdbId ?? "", show.tvdbId ?? "");
    if (existing) return existing.id;
  }
  // Last resort: exact title, and ONLY when exactly one show carries it —
  // ambiguity (e.g. a remake sharing its title) stays unresolved rather than
  // guessed. Needed for legacy imports whose Guid entries are EPISODE-level
  // ids that can never match a show.
  if (show.title) {
    const matches = findShowsByTitle.all(show.title);
    if (matches.length === 1) return matches[0].id;
  }
  return null;
};

const findShowsByTitle = db.prepare<[string], { id: number }>(
  "SELECT id FROM media_items WHERE type = 'show' AND title = ? COLLATE NOCASE LIMIT 2"
);

/** Add external ids to an existing canonical item without overwriting known ones. */
const enrichStmt = db.prepare(`
  UPDATE media_items SET
    imdb_id = COALESCE(imdb_id, @imdbId),
    tmdb_id = COALESCE(tmdb_id, @tmdbId),
    tvdb_id = COALESCE(tvdb_id, @tvdbId),
    updatedAt = @now
  WHERE id = @id AND (
    (imdb_id IS NULL AND @imdbId IS NOT NULL) OR
    (tmdb_id IS NULL AND @tmdbId IS NOT NULL) OR
    (tvdb_id IS NULL AND @tvdbId IS NOT NULL)
  )
`);

const findItemById = db.prepare<[number], MediaItemRow>(
  "SELECT * FROM media_items WHERE id = ?"
);
const upgradeTitleStmt = db.prepare(
  "UPDATE media_items SET title = @title, updatedAt = @now WHERE id = @id"
);
const linkShowStmt = db.prepare(`
  UPDATE media_items SET
    showMediaId = @showMediaId,
    seasonNumber = COALESCE(seasonNumber, @seasonNumber),
    episodeNumber = COALESCE(episodeNumber, @episodeNumber),
    updatedAt = @now
  WHERE id = @id AND showMediaId IS NULL
`);

/**
 * Self-healing on match: createItem froze whatever title the FIRST server
 * reported — if that server's metadata was unmatched at the time, the canonical
 * item keeps a generic "Episode #3.1" forever even though every later play
 * carries the real title. Upgrade the title (and a missing show link) whenever
 * a better descriptor arrives.
 */
const maybeUpgradeEpisode = (item: MediaItemRow, descriptor: MediaDescriptor): void => {
  if (item.type !== "episode") return;
  const now = new Date().toISOString();
  if (
    isGenericEpisodeTitle(item.title) &&
    descriptor.title &&
    !isGenericEpisodeTitle(descriptor.title)
  ) {
    upgradeTitleStmt.run({ id: item.id, title: descriptor.title, now });
  }
  if (item.showMediaId === null && descriptor.show) {
    const showMediaId = findOrCreateShow(descriptor.show);
    if (showMediaId !== null && showMediaId !== item.id) {
      linkShowStmt.run({
        id: item.id,
        showMediaId,
        seasonNumber: descriptor.show.seasonNumber ?? null,
        episodeNumber: descriptor.show.episodeNumber ?? null,
        now,
      });
    }
  }
};

export const enrichMediaItemGuids = (mediaId: number, guids: MediaGuids): void => {
  if (!guids.imdbId && !guids.tmdbId && !guids.tvdbId) return;
  enrichStmt.run({
    id: mediaId,
    imdbId: guids.imdbId ?? null,
    tmdbId: guids.tmdbId ?? null,
    tvdbId: guids.tvdbId ?? null,
    now: new Date().toISOString(),
  });
};

/**
 * Resolve a canonical media item for a (serverId, ratingKey) source and keep
 * the media_sources mapping fresh. Identity resolution order:
 *   plex_guid -> (episodes) show + S/E number -> external ids -> create new.
 * Returns null when no identity can be established (no GUIDs at all — e.g.
 * Live TV) or on storage errors; callers treat null as "no canonical id yet".
 */
export const resolveMediaId = (descriptor: MediaDescriptor): number | null => {
  try {
    const { serverId, ratingKey, type, guids } = descriptor;

    const source = findSource.get(serverId, ratingKey);
    if (source) {
      const existing = findItemById.get(source.mediaId);
      if (existing) maybeUpgradeEpisode(existing, descriptor);
      return source.mediaId;
    }

    let item: MediaItemRow | undefined;

    if (guids.plexGuid) {
      item = findByPlexGuid.get(guids.plexGuid);
    }

    const isEpisode = type === "episode";
    let showMediaId: number | null = null;
    const season = descriptor.show?.seasonNumber;
    const episode = descriptor.show?.episodeNumber;
    if (!item && isEpisode && descriptor.show) {
      showMediaId = findOrCreateShow(descriptor.show);
      if (showMediaId !== null && season !== undefined && episode !== undefined) {
        item = findEpisodeByNumber.get(showMediaId, season, episode);
      }
    }

    // External ids identify movies/shows, but for episodes they are usually
    // the SHOW's ids — matching on them would merge every episode of a show
    // into one item. Episodes resolve only via their own guid or (show, S, E).
    if (!item && !isEpisode && (guids.tmdbId || guids.imdbId || guids.tvdbId)) {
      item = findByExternalId.get(type, guids.tmdbId ?? "", guids.imdbId ?? "", guids.tvdbId ?? "");
    }

    if (!item) {
      if (isEpisode) {
        const canIdentify =
          Boolean(guids.plexGuid) ||
          (showMediaId !== null && season !== undefined && episode !== undefined);
        if (!canIdentify) return null;
      } else if (!guids.plexGuid && !guids.imdbId && !guids.tmdbId && !guids.tvdbId) {
        return null;
      }
      const id = createItem({
        type,
        title: descriptor.title,
        year: descriptor.year,
        guids,
        showMediaId: isEpisode ? showMediaId ?? undefined : undefined,
        seasonNumber: isEpisode ? descriptor.show?.seasonNumber : undefined,
        episodeNumber: isEpisode ? descriptor.show?.episodeNumber : undefined,
      });
      upsertSource.run({ serverId, ratingKey, mediaId: id, updatedAt: new Date().toISOString() });
      return id;
    }

    upsertSource.run({
      serverId,
      ratingKey,
      mediaId: item.id,
      updatedAt: new Date().toISOString(),
    });
    maybeUpgradeEpisode(item, descriptor);
    return item.id;
  } catch (e) {
    Logger.error("[Media] Failed to resolve canonical media item:", e);
    return null;
  }
};
