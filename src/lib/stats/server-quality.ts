import { db } from "../db";
import { buildQualityFilter, WAN_LOCATION, type QualityParams } from "./server-quality-filter";
import {
    REASON_LABELS,
    TRANSCODE_REASONS,
    formatDetail,
    reasonHint,
    type TranscodeReasonKey,
} from "./server-quality-hints";

/**
 * Why streams transcode, and which clients trigger it. Every transcoded play
 * gets ONE primary reason so the breakdown sums to 100%, in causal priority:
 * burned-in subtitles force a video transcode on their own, so they win; a
 * WAN stream delivered below source bitrate is a quality/bandwidth cap, not a
 * codec problem; then resolution downscale, video codec, audio-only.
 * Rows from before v17 lack subtitle/source facts and land in "unknown"
 * only when nothing else explains them.
 */

/** Delivered below this share of the source bitrate counts as quality-limited (encoder overhead tolerance). */
export const BANDWIDTH_LIMITED_RATIO = 0.9;
const DEFAULT_CLIENT_LIMIT = 10;

const BURN_IN_DECISIONS = "('burn', 'transcode')";

/** SQL for a transcoded row's primary reason; binds one parameter (the ratio). */
const PRIMARY_REASON_SQL = `
  CASE
    WHEN h.subtitle_decision IN ${BURN_IN_DECISIONS} THEN 'subtitle'
    WHEN h.location = '${WAN_LOCATION}' AND h.video_decision = 'transcode'
         AND h.source_bitrate > 0 AND h.bitrate > 0
         AND h.bitrate < h.source_bitrate * ? THEN 'bandwidth'
    WHEN h.video_decision = 'transcode' AND h.video_resolution IS NOT NULL
         AND h.stream_video_resolution IS NOT NULL
         AND h.video_resolution != h.stream_video_resolution THEN 'video_resolution'
    WHEN h.video_decision = 'transcode' THEN 'video_codec'
    WHEN h.audio_decision = 'transcode' THEN 'audio'
    ELSE 'unknown'
  END`;

export type TranscodeReason = {
    key: TranscodeReasonKey;
    label: string;
    count: number;
    /** Share of all transcodes, 0..100. */
    share: number;
    /** Most common detail (codec label or "4k → 1080p"), null when none recorded. */
    topDetail: string | null;
    /** Share of this reason's transcodes that have the top detail, 0..100. */
    topDetailShare: number;
    hint: string;
};

export type TranscodeReasonsResult = {
    totalPlays: number;
    transcodes: number;
    reasons: TranscodeReason[];
};

type ReasonDetailRow = { reason: TranscodeReasonKey; detail: string | null; total: number; ratio: number | null };

const percent = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);

export const getTranscodeReasons = (params: QualityParams): TranscodeReasonsResult => {
    const { where, args } = buildQualityFilter(params);

    const totals = db.prepare(`
        SELECT COUNT(*) AS totalPlays,
               COALESCE(SUM(CASE WHEN h.transcode_decision = 'transcode' THEN 1 ELSE 0 END), 0) AS transcodes
        FROM activity_history h
        WHERE ${where}
    `).get(...args) as { totalPlays: number; transcodes: number };

    const rows = db.prepare(`
        WITH t AS (
          SELECT ${PRIMARY_REASON_SQL} AS reason,
                 h.subtitle_codec, h.video_codec, h.audio_codec,
                 h.video_resolution, h.stream_video_resolution, h.bitrate, h.source_bitrate
          FROM activity_history h
          WHERE ${where} AND h.transcode_decision = 'transcode'
        )
        SELECT reason,
               CASE reason
                 WHEN 'subtitle' THEN subtitle_codec
                 WHEN 'video_resolution' THEN video_resolution || ' → ' || stream_video_resolution
                 WHEN 'video_codec' THEN video_codec
                 WHEN 'audio' THEN audio_codec
               END AS detail,
               COUNT(*) AS total,
               AVG(CASE WHEN reason = 'bandwidth' THEN CAST(bitrate AS REAL) / source_bitrate END) AS ratio
        FROM t
        GROUP BY reason, detail
    `).all(BANDWIDTH_LIMITED_RATIO, ...args) as ReasonDetailRow[];

    const reasons = TRANSCODE_REASONS.map((key): TranscodeReason | null => {
        const group = rows.filter((row) => row.reason === key);
        const count = group.reduce((sum, row) => sum + row.total, 0);
        if (count === 0) return null;
        const top = group
            .filter((row) => row.detail !== null)
            .sort((a, b) => b.total - a.total)[0];
        const weightedRatio = group.reduce((sum, row) => sum + (row.ratio ?? 0) * row.total, 0) / count;
        const topDetail = top?.detail ?? null;
        return {
            key,
            label: REASON_LABELS[key],
            count,
            share: percent(count, totals.transcodes),
            topDetail: formatDetail(key, topDetail),
            topDetailShare: top ? percent(top.total, count) : 0,
            hint: reasonHint({ reason: key, topDetail, bitrateRatio: key === "bandwidth" ? weightedRatio : null }),
        };
    })
        .filter((reason): reason is TranscodeReason => reason !== null)
        .sort((a, b) => b.count - a.count);

    return { totalPlays: totals.totalPlays, transcodes: totals.transcodes, reasons };
};

export type TranscodingClient = {
    platform: string;
    player: string;
    plays: number;
    transcodes: number;
    /** Transcodes / plays, 0..100. */
    share: number;
    /** The client's most common primary transcode reason. */
    topReason: TranscodeReasonKey | null;
};

type ClientRow = { platform: string; player: string; plays: number; transcodes: number };
type ClientReasonRow = { platform: string; player: string; reason: TranscodeReasonKey; total: number };

const UNKNOWN_CLIENT = "Unknown";
const clientKey = (platform: string, player: string) => `${platform}\u0000${player}`;

/** Per platform + player, clients with at least one transcode, most transcodes first. */
export const getTranscodingClients = (
    params: QualityParams & { limit?: number },
): TranscodingClient[] => {
    const { where, args } = buildQualityFilter(params);
    const limit = params.limit ?? DEFAULT_CLIENT_LIMIT;
    const platformExpr = `COALESCE(NULLIF(h.platform, ''), '${UNKNOWN_CLIENT}')`;
    const playerExpr = `COALESCE(NULLIF(h.player, ''), '${UNKNOWN_CLIENT}')`;

    const clients = db.prepare(`
        SELECT ${platformExpr} AS platform, ${playerExpr} AS player,
               COUNT(*) AS plays,
               SUM(CASE WHEN h.transcode_decision = 'transcode' THEN 1 ELSE 0 END) AS transcodes
        FROM activity_history h
        WHERE ${where}
        GROUP BY platform, player
        HAVING transcodes > 0
        ORDER BY transcodes DESC, plays DESC
        LIMIT ?
    `).all(...args, limit) as ClientRow[];
    if (clients.length === 0) return [];

    const reasonRows = db.prepare(`
        SELECT ${platformExpr} AS platform, ${playerExpr} AS player,
               ${PRIMARY_REASON_SQL} AS reason, COUNT(*) AS total
        FROM activity_history h
        WHERE ${where} AND h.transcode_decision = 'transcode'
        GROUP BY platform, player, reason
    `).all(BANDWIDTH_LIMITED_RATIO, ...args) as ClientReasonRow[];

    const topReason = new Map<string, ClientReasonRow>();
    for (const row of reasonRows) {
        const key = clientKey(row.platform, row.player);
        const current = topReason.get(key);
        if (!current || row.total > current.total) topReason.set(key, row);
    }

    return clients.map((client) => ({
        ...client,
        share: percent(client.transcodes, client.plays),
        topReason: topReason.get(clientKey(client.platform, client.player))?.reason ?? null,
    }));
};
