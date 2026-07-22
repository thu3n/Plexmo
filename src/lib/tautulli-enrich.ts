import { db } from "@/lib/db";
import { extractSessionFacts, playDurationOf } from "@/lib/history/session-facts";
import type { HistoryEntry } from "@/lib/history";

/**
 * Shared in-place enrichment of already-imported Tautulli rows — used by both
 * the DB-file import and the API import. A row is matched on serverId +
 * importRef (the Tautulli source row id) within a start-time sanity window
 * against ANY tautulli import source, then its meta/fact columns are replaced
 * with the richer data. userId/user stay (identity already resolved);
 * repair_status is cleared so the media backfill re-evaluates the row.
 */

/** Match tolerance between stored startTime and the source row's `started`. */
export const MATCH_WINDOW_MS = 6 * 60 * 60 * 1000;

const findStmt = db.prepare<[string, string, number, number], { id: string }>(`
    SELECT id FROM activity_history
    WHERE serverId = ? AND importRef = ? AND importSource LIKE 'tautulli%'
      AND startTime BETWEEN ? AND ?
    LIMIT 1
`);

export const findExistingImported = (
    serverId: string,
    importRef: string,
    startedMs: number
): { id: string } | undefined =>
    findStmt.get(serverId, importRef, startedMs - MATCH_WINDOW_MS, startedMs + MATCH_WINDOW_MS);

const enrichStmt = db.prepare(`
    UPDATE activity_history SET
        meta_json = @meta_json,
        duration = @duration,
        pausedCounter = @pausedCounter,
        player = @player,
        plex_guid = COALESCE(@plex_guid, plex_guid),
        transcode_decision = @transcode_decision,
        video_decision = @video_decision,
        audio_decision = @audio_decision,
        video_resolution = @video_resolution,
        stream_video_resolution = @stream_video_resolution,
        bitrate = @bitrate,
        bandwidth = @bandwidth,
        location = @location,
        view_offset_ms = @view_offset_ms,
        percent_complete = @percent_complete,
        watched = @watched,
        play_duration = @play_duration,
        repair_status = CASE WHEN mediaId IS NULL THEN NULL ELSE repair_status END
    WHERE id = @id
`);

export const enrichExistingRow = (
    existingId: string,
    mapped: HistoryEntry,
    player?: string | null
): void => {
    const facts = extractSessionFacts(mapped.meta_json);
    enrichStmt.run({
        id: existingId,
        meta_json: mapped.meta_json ?? null,
        duration: mapped.duration,
        pausedCounter: mapped.pausedCounter,
        player: player ?? null,
        plex_guid: mapped.plex_guid ?? null,
        ...facts,
        play_duration: playDurationOf(mapped.duration, mapped.pausedCounter),
    });
};
