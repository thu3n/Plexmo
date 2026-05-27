import { Logger } from "@/lib/logger";

// Stateless Tautulli API v2 fetch helpers extracted from the import orchestrator.
// Each takes the resolved `${url}/api/v2` base + apiKey and returns parsed data;
// none touch the import's mutable counters. Failures are logged and swallowed
// (returning empty/partial data) to match the original best-effort behavior.

export type SeriesMeta = { year?: number; guid?: string; imdb?: string; tmdb?: string; tvdb?: string };
export type MovieMeta = { guid?: string; imdb?: string; tmdb?: string };

/**
 * Build the Plexmo-compatible entry from a raw Tautulli history row, applying
 * any cached series/movie metadata. Pure (no counters, no DB writes) so it can
 * live outside the import orchestrator. Returns the entry ready for
 * mapTautulliToPlexmo; the caller still applies duration/user-resolution checks.
 */
export function buildCompatibleEntry(
    row: any,
    sourceId: string,
    seriesMetaCache: Map<string, SeriesMeta>,
    movieMetaCache: Map<string, MovieMeta>,
): any {
    const compatibleEntry: any = {
        ...row,
        id: row.row_id || row.id,
        reference_id: row.reference_id,
        server_id: parseInt(sourceId),
        started: row.date,
        stopped: row.stopped || (row.date + row.duration) || 0,
        duration: row.duration * 1000,
        title: row.title,
        parent_title: row.parent_title,
        grandparent_title: row.grandparent_title,
        year: row.year,
        media_type: row.media_type,
        thumb: row.thumb,
        parent_thumb: row.parent_thumb,
        grandparent_thumb: row.grandparent_thumb,
        player: row.player,
        user: row.user,
        ip_address: row.ip_address,
        platform: row.platform,
        transcode_decision: row.transcode_decision,
        imdb_id: row.imdb_id,
        tmdb_id: row.tmdb_id,
        tvdb_id: row.tvdb_id,
        grandparent_rating_key: row.grandparent_rating_key,
        parent_rating_key: row.parent_rating_key,
        guid: row.guid, // Sometimes available


        grandparent_guid: row.grandparent_guid, // Rare but possible
    };

    // Apply cached Series Metadata if available
    if (row.grandparent_rating_key) {
        const sMeta = seriesMetaCache.get(String(row.grandparent_rating_key));
        if (sMeta) {
            if (sMeta.year) compatibleEntry.grandparent_year = sMeta.year;
            if (sMeta.guid) compatibleEntry.grandparent_guid = sMeta.guid;
            // sMeta also has imdb/tmdb/tvdb for the SERIES
            if (sMeta.tmdb) compatibleEntry.tmdb_id = sMeta.tmdb; // Tautulli entry usually lacks these
            if (sMeta.imdb) compatibleEntry.imdb_id = sMeta.imdb;
            if (sMeta.tvdb) compatibleEntry.tvdb_id = sMeta.tvdb;
        }
    }

    // Apply cached Movie Metadata if available
    if (row.media_type === 'movie' && row.rating_key) {
        const mMeta = movieMetaCache.get(String(row.rating_key));
        if (mMeta) {
            if (mMeta.guid) compatibleEntry.plex_guid = mMeta.guid; // Use specific field to be safe
            if (mMeta.imdb) compatibleEntry.imdb_id = mMeta.imdb;
            if (mMeta.tmdb) compatibleEntry.tmdb_id = mMeta.tmdb;
        }
    }

    if (!compatibleEntry.stopped && compatibleEntry.started && row.duration) {
        compatibleEntry.stopped = compatibleEntry.started + row.duration;
    }

    return compatibleEntry;
}

/** A. Resolve Tautulli source server ids -> display names (fork + standard fallback). */
export async function resolveServerNames(apiUrl: string, apiKey: string): Promise<Record<string, string>> {
    const serverNames: Record<string, string> = {};
    try {
        // Try Fork First
        const nameRes = await fetch(`${apiUrl}?apikey=${apiKey}&cmd=get_server_names`);
        if (nameRes.ok) {
            const nameJson = await nameRes.json();
            if (nameJson.response?.result === 'success' && Array.isArray(nameJson.response.data)) {
                nameJson.response.data.forEach((s: any) => {
                    serverNames[s.server_id?.toString()] = s.pms_name;
                });
            }
        }

        // Try Standard Fallback (augment, don't overwrite if fork succeeded)
        const infoRes = await fetch(`${apiUrl}?apikey=${apiKey}&cmd=get_servers_info`);
        if (infoRes.ok) {
            const infoJson = await infoRes.json();
            if (infoJson.response?.result === 'success') {
                const data = infoJson.response.data;
                const list = Array.isArray(data) ? data : [data];
                list.forEach((s: any) => {
                    // Standard uses machine_identifier often as key
                    if (s.machine_identifier) serverNames[s.machine_identifier] = s.name;
                    if (s.id) serverNames[s.id.toString()] = s.name;
                });
            }
        }
    } catch (e) {
        Logger.warn("Failed to resolve server names", e);
    }
    return serverNames;
}

/**
 * B. Pre-fetch active sessions to prevent importing "ghost" history of ongoing
 * items. Returns a map of "${user}-${rating_key}" -> started timestamp.
 */
export async function fetchActiveSessions(apiUrl: string, apiKey: string): Promise<Map<string, number>> {
    const activeSessionsMap = new Map<string, number>();
    try {
        const actRes = await fetch(`${apiUrl}?apikey=${apiKey}&cmd=get_activity`);
        if (actRes.ok) {
            const actJson = await actRes.json();
            if (actJson.response?.result === 'success') {
                const sessions = actJson.response.data.sessions || [];
                sessions.forEach((s: any) => {
                    // We use a composite key of User + RatingKey.
                    // Matches what we see in history import.
                    if (s.user && s.rating_key) {
                        const key = `${s.user}-${s.rating_key}`;
                        // Tautulli fields for start time can vary: 'started', 'start_time', or 'date' (all usually seconds)
                        // We need to ensure we parse it as a number.
                        const rawStart = s.started || s.start_time || s.date || 0;
                        const startTs = parseInt(String(rawStart), 10);
                        activeSessionsMap.set(key, startTs);
                    }
                });
                Logger.info(`[Import] Found ${activeSessionsMap.size} active sessions to cross-reference.`);
                if (activeSessionsMap.size > 0) {
                    Logger.debug(`[Import] Active Session Sample Keys: ${Array.from(activeSessionsMap.keys()).slice(0, 3).join(', ')}`);
                }
            }
        }
    } catch (e) {
        Logger.warn("Failed to fetch active sessions", e);
    }
    return activeSessionsMap;
}

/** C. Total history record count for a single source server (0 on failure). */
export async function fetchServerCount(apiUrl: string, apiKey: string, sourceId: string): Promise<number> {
    const baseServerUrl = `${apiUrl}?apikey=${apiKey}&cmd=get_history&server_id=${sourceId}`;
    try {
        const initRes = await fetch(`${baseServerUrl}&length=1&start=0`);
        const initJson = await initRes.json();
        if (initJson.response?.result === 'success') {
            return initJson.response.data.recordsFiltered || 0;
        }
    } catch (e) {
        Logger.error(`Failed to get count for ${sourceId}`, e);
    }
    return 0;
}

/**
 * Populate the series metadata cache for any grandparent rating keys not yet
 * cached. Used to link episodes to their series (year/guid/external ids).
 */
export async function fetchSeriesMeta(apiUrl: string, apiKey: string, keys: Set<string>, cache: Map<string, SeriesMeta>): Promise<void> {
    if (keys.size === 0) return;
    // Fetch in chunks or sequentially? Tautulli might rate limit.
    Logger.info(`[Import] Fetching metadata for ${keys.size} new series...`);
    for (const key of keys) {
        try {
            const metaRes = await fetch(`${apiUrl}?apikey=${apiKey}&cmd=get_metadata&rating_key=${key}`);
            if (metaRes.ok) {
                const metaJson = await metaRes.json();
                const d = metaJson.response?.data;
                if (d) {
                    cache.set(key, {
                        year: d.year,
                        guid: d.guid,
                        imdb: d.imdb_id || d.imdb_id_s,
                        tmdb: d.tmdb_id,
                        tvdb: d.tvdb_id
                    });
                } else {
                    cache.set(key, {});
                }
            }
        } catch (e) {
            Logger.warn(`Failed to fetch metadata for GP Key ${key}`, e);
        }
    }
}

/** Populate the movie metadata cache for any movie rating keys not yet cached. */
export async function fetchMovieMeta(apiUrl: string, apiKey: string, keys: Set<string>, cache: Map<string, MovieMeta>): Promise<void> {
    if (keys.size === 0) return;
    Logger.info(`[Import] Fetching metadata for ${keys.size} movies...`);
    for (const key of keys) {
        try {
            const metaRes = await fetch(`${apiUrl}?apikey=${apiKey}&cmd=get_metadata&rating_key=${key}`);
            if (metaRes.ok) {
                const metaJson = await metaRes.json();
                const d = metaJson.response?.data;
                if (d) {
                    cache.set(key, {
                        guid: d.guid,
                        imdb: d.imdb_id || d.imdb_id_s,
                        tmdb: d.tmdb_id
                    });
                } else {
                    cache.set(key, {});
                }
            }
        } catch (e) {
            Logger.warn(`Failed to fetch metadata for Movie Key ${key}`, e);
        }
    }
}
