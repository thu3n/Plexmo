import { HistoryEntry } from "./history";
import { decodePlexString } from "./plex";

export type TautulliSessionRow = {
    id: number;
    reference_id: number;
    started: number;
    stopped: number;
    server_id: number; // Tautulli server ID
    rating_key: number;
    user_id: number;
    user: string;
    ip_address: string;
    paused_counter: number;
    player: string;
    product: string;
    platform: string;
    media_type: string;
    view_offset: number;
    // Present in DB-file imports (and some newer APIs); absent in the fork's API.
    bandwidth?: number;
    location?: string;
    quality_profile?: string;
    // ... other columns
};

export type TautulliMediaInfoRow = {
    id: number;
    duration: number;
    // ...
    // Add other needed fields from session_history_media_info
    video_decision: string;
    audio_decision: string;
    transcode_decision: string;
    container: string;
    transcode_container: string;
    video_codec: string;
    audio_codec: string;
    transcode_video_codec: string;
    transcode_audio_codec: string;
    width: number;
    height: number;
    transcode_width: number;
    transcode_height: number;
    transcode_audio_channels: number;
    audio_channels: number;
    stream_container: string;
    stream_video_codec: string;
    stream_audio_codec: string;
    stream_video_decision: string;
    stream_audio_decision: string;
    bitrate?: number;
    stream_bitrate?: number;
    video_resolution?: string;
    stream_video_resolution?: string;
};

export type TautulliMetadataRow = {
    id: number;
    title: string;
    parent_title: string;
    grandparent_title: string;
    original_title: string;
    year: number;
    thumb: string;
    parent_thumb: string;
    grandparent_thumb: string;
    parent_media_index: number; // Season
    media_index: number; // Episode
    rating_key: number;
    parent_rating_key?: number;
    grandparent_rating_key?: number;
    duration: number;
    imdb_id?: string;
    tmdb_id?: string;
    tvdb_id?: string;
    guid?: string; // Plex GUID
    grandparent_guid?: string;
    grandparent_year?: number;
};

// Combine all sources into one for mapping
export type TautulliFullEntry = TautulliSessionRow & Partial<TautulliMediaInfoRow> & Partial<TautulliMetadataRow> & {
    plex_guid?: string; // New explicit field we might populate
};

/** Tautulli transcode_decision -> app decision vocabulary. */
const mapDecision = (decision?: string): string => {
    const d = (decision || "").toLowerCase();
    if (d === "transcode") return "transcode";
    if (d === "copy") return "direct stream";
    return "direct play";
};

/** Tautulli resolution ("1080", "4k", "sd") or raw height -> app label ("1080p", "4k", "SD"). */
const toResolutionLabel = (resolution?: string | number, height?: number): string | undefined => {
    if (resolution !== undefined && resolution !== null && resolution !== "") {
        const s = String(resolution).toLowerCase();
        if (s === "4k") return "4k";
        if (s === "sd") return "SD";
        if (/^\d+$/.test(s)) return `${s}p`;
        return s;
    }
    if (!height) return undefined;
    if (height >= 2000) return "4k";
    if (height > 1000) return "1080p";
    if (height >= 700) return "720p";
    if (height >= 480) return "480p";
    return "SD";
};

export function mapTautulliToPlexmo(
    entry: TautulliFullEntry,
    serverMap: Record<number, string>, // Tautulli ID -> Plexmo Server ID (machineId/uuid)
    importSource: string = "tautulli",
    defaultServerId: string = "imported-tautulli"
): HistoryEntry {

    // Construct Meta JSON (PlexSession format)
    // We need to approximate PlexSession from Tautulli data
    const meta: any = {
        // Basic
        title: decodePlexString(entry.title),
        originalTitle: decodePlexString(entry.original_title),
        year: entry.year,
        type: entry.media_type,
        thumb: entry.thumb,
        art: entry.grandparent_thumb || entry.parent_thumb || entry.thumb, // approximated

        // Relation
        grandparentTitle: decodePlexString(entry.grandparent_title),
        parentTitle: decodePlexString(entry.parent_title),
        grandparentThumb: entry.grandparent_thumb,
        parentThumb: entry.parent_thumb,
        parentIndex: entry.parent_media_index,
        index: entry.media_index,

        // Technical
        duration: entry.duration || 0, // Tautulli stores media duration in MS

        viewOffset: entry.view_offset, // MS usually?

        // Stream Decisions — Tautulli's transcode_decision is
        // 'transcode' | 'copy' | 'direct play'; 'copy' IS direct stream.
        // Values must match the app convention exactly ('direct play' with a
        // space) or fact columns and graphs miscategorize the rows.
        decision: mapDecision(entry.transcode_decision),
        videoDecision: entry.video_decision || entry.stream_video_decision || mapDecision(entry.transcode_decision),
        audioDecision: entry.audio_decision || entry.stream_audio_decision || mapDecision(entry.transcode_decision),

        // Codecs
        container: entry.container, // "mkv"
        videoCodec: entry.video_codec,
        audioCodec: entry.audio_codec,

        // Transcode info - Tautulli separates these differently.
        // Transcode info - Tautulli separates these differently.
        transcodeVideoCodec: (entry.transcode_decision === 'transcode' ? (entry.transcode_video_codec || entry.stream_video_codec) : undefined),
        transcodeAudioCodec: (entry.transcode_decision === 'transcode' ? (entry.transcode_audio_codec || entry.stream_audio_codec) : undefined),
        transcodeContainer: (entry.transcode_decision === 'transcode' ? (entry.transcode_container || entry.stream_container) : undefined),
        transcodeHeight: (entry.transcode_decision === 'transcode'
            ? toResolutionLabel(entry.stream_video_resolution, entry.transcode_height || entry.height)
            : undefined),
        transcodeAudioChannels: (entry.transcode_decision === 'transcode' ? entry.transcode_audio_channels : undefined),

        // Original info
        originalContainer: entry.container,
        originalVideoCodec: entry.video_codec,
        originalAudioCodec: entry.audio_codec,
        originalHeight: toResolutionLabel(entry.video_resolution, entry.height) ?? entry.height,
        originalAudioChannels: entry.audio_channels,

        // Delivered stream label + facts feed (DB-file imports carry these)
        resolution: toResolutionLabel(
            entry.transcode_decision === 'transcode' ? entry.stream_video_resolution : entry.video_resolution,
            entry.transcode_decision === 'transcode' ? entry.transcode_height : entry.height
        ),
        bitrateKbps: entry.stream_bitrate || entry.bitrate || undefined,
        bandwidth: entry.bandwidth || undefined,
        location: entry.location || undefined,

        // Player
        player: entry.player,
        platform: entry.platform,
        product: entry.product,
        device: entry.product, // approximation
        ip: entry.ip_address,

        // User
        user: entry.user,
        // userThumb? Tautulli doesn't seem to have it in the main tables easily.

        // Server
        serverId: serverMap[entry.server_id] || defaultServerId,
    };

    // Construct GUIDs
    const guids = [];
    if (entry.imdb_id) guids.push({ id: `imdb://${entry.imdb_id}` });
    if (entry.tmdb_id) guids.push({ id: `tmdb://${entry.tmdb_id}` });
    if (entry.tvdb_id) guids.push({ id: `tvdb://${entry.tvdb_id}` });
    // If Tautulli gives us the raw Plex GUID, use it too (often contains agents)
    if (entry.guid) guids.push({ id: entry.guid });

    if (guids.length > 0) meta.Guid = guids;
    if (entry.grandparent_guid) meta.grandparentGuid = entry.grandparent_guid;
    if (entry.grandparent_rating_key) meta.grandparentRatingKey = entry.grandparent_rating_key;
    if (entry.grandparent_year) meta.grandparentYear = entry.grandparent_year;
    if (entry.parent_rating_key) meta.parentRatingKey = entry.parent_rating_key;

    // Plexmo History uses seconds for start/stop/duration.
    // Tautulli uses Seconds for start/stop, but MS for duration?
    // Let's double check Plexmo history.ts.
    // In lib/history.ts:
    // duration: durationSeconds,
    // startTime: stored.startTime (MS? active session uses Date.now()).
    // In active session insert: startTime: now (MS).
    // In history insert: startTime: stored.startTime (MS).
    // In history insert: stopTime: effectiveStopTime (MS).
    // duration: (stop - start) / 1000 -> Seconds.

    // So Plexmo DB:
    // startTime: MS
    // stopTime: MS
    // duration: Seconds

    // Tautulli DB:
    // started: Seconds (Unix)
    // stopped: Seconds (Unix)
    // duration: MS

    // Conversion needed:
    const startTimeMS = entry.started * 1000;
    let stopTimeMS = entry.stopped * 1000;

    // Plexmo HistoryEntry.duration should be the WATCHED duration (session duration) in Seconds
    // This allows the frontend to show "watched for X minutes" in the duration column.

    // Tautulli's "duration" field in export is usually Media Duration (MS).
    // Tautulli's "stopped" - "started" is Wall Clock Time.
    // Tautulli's "paused_counter" is in seconds.
    // So Active Duration = (Stopped - Started) - Paused.
    const wallClockSeconds = entry.stopped - entry.started;
    let durationSeconds = wallClockSeconds - (entry.paused_counter || 0);
    let finalPausedCounter = entry.paused_counter || 0;

    // Safety check: specific handling for cumulative pauses
    // If calculated duration is negative, it means paused_counter is cumulative (larger than segment wall time).
    // In this case, we can't determine the local pause without previous row context.
    // Fallback: Use Wall Clock as Duration, and set Pause to 0 to avoid misleading huge numbers.
    if (durationSeconds < 0) {
        durationSeconds = Math.max(0, wallClockSeconds);
        finalPausedCounter = 0;
    }

    // CAP DURATION: Prevent stuck sessions > 24 hours (86400 seconds)
    // This ensures statistics remain realistic even with bad imported data.
    if (durationSeconds > 86400) {
        durationSeconds = 86400;
        stopTimeMS = startTimeMS + (86400 * 1000);
    }

    return {
        // Row identity is a fresh UUID; provenance lives in importSource/importRef,
        // where UNIQUE(serverId, importSource, importRef) makes re-imports
        // idempotent and keeps two Tautulli instances from colliding.
        id: crypto.randomUUID(),
        importSource,
        importRef: String(entry.id),
        serverId: serverMap[entry.server_id] || defaultServerId, // Tautulli Server ID -> mapped
        user: entry.user,
        title: decodePlexString(entry.title) || "Unknown Title", // Decoded title
        subtitle: entry.media_type === 'episode'
            ? `S${entry.parent_media_index || '?'} E${entry.media_index || '?'}` // Fallback subtitle if needed
            : undefined,
        ratingKey: String(entry.rating_key || 0),
        startTime: startTimeMS,
        stopTime: stopTimeMS,
        duration: durationSeconds,
        platform: entry.platform,
        device: entry.player, // or product
        ip: entry.ip_address,
        serverName: "Tautulli Import", // Can be updated if we find name in server map
        meta_json: JSON.stringify(meta),
        pausedCounter: finalPausedCounter, // seconds

        // External IDs. plex_guid is the ITEM's own guid — for episodes that is
        // the episode guid, never the show's (the show link lives in
        // meta.grandparentGuid and, canonically, in media_items.showMediaId).
        plex_guid: entry.plex_guid || entry.guid,

        imdb_id: entry.imdb_id,
        tmdb_id: entry.tmdb_id,
        tvdb_id: entry.tvdb_id
    };
}
