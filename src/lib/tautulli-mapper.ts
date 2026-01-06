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
    duration: number;
};

// Combine all sources into one for mapping
export type TautulliFullEntry = TautulliSessionRow & Partial<TautulliMediaInfoRow> & Partial<TautulliMetadataRow>;

export function mapTautulliToPlexmo(
    entry: TautulliFullEntry,
    serverMap: Record<number, string>, // Tautulli ID -> Plexmo Server ID (machineId/uuid)
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

        // Stream Decisions
        decision: entry.transcode_decision == 'transcode' ? 'transcode' : 'directplay',
        videoDecision: entry.video_decision || entry.stream_video_decision || (entry.transcode_decision === 'direct play' ? 'direct play' : ''),
        audioDecision: entry.audio_decision || entry.stream_audio_decision || (entry.transcode_decision === 'direct play' ? 'direct play' : ''),

        // Codecs
        container: entry.container, // "mkv"
        videoCodec: entry.video_codec,
        audioCodec: entry.audio_codec,

        // Transcode info - Tautulli separates these differently.
        // Transcode info - Tautulli separates these differently.
        transcodeVideoCodec: (entry.transcode_decision === 'transcode' ? (entry.transcode_video_codec || entry.stream_video_codec) : undefined),
        transcodeAudioCodec: (entry.transcode_decision === 'transcode' ? (entry.transcode_audio_codec || entry.stream_audio_codec) : undefined),
        transcodeContainer: (entry.transcode_decision === 'transcode' ? (entry.transcode_container || entry.stream_container) : undefined),
        transcodeHeight: (entry.transcode_decision === 'transcode' ? (entry.transcode_height || entry.height) : undefined),
        transcodeAudioChannels: (entry.transcode_decision === 'transcode' ? entry.transcode_audio_channels : undefined),

        // Original info
        originalContainer: entry.container,
        originalVideoCodec: entry.video_codec,
        originalAudioCodec: entry.audio_codec,
        originalHeight: entry.height,
        originalAudioChannels: entry.audio_channels,

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
    let wallClockSeconds = entry.stopped - entry.started;
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
        id: `tautulli-${entry.id}`,
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
        pausedCounter: finalPausedCounter // seconds
    };
}
