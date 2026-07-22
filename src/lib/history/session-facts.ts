/**
 * Derives the queryable fact columns (migration v5) for a history row from the
 * session's final heartbeat meta. Single source of truth for the write path —
 * live session close, stale flush and Tautulli import all funnel through
 * insertHistoryRow, which calls this. The v5 migration backfill mirrors this
 * logic in SQL.
 */

/** A row counts as watched at this share of the media runtime (Tautulli convention). */
export const WATCHED_THRESHOLD_PERCENT = 85;

export type SessionFacts = {
  transcode_decision: string | null;
  video_decision: string | null;
  audio_decision: string | null;
  video_resolution: string | null;
  stream_video_resolution: string | null;
  bitrate: number | null;
  bandwidth: number | null;
  location: string | null;
  relayed: number | null;
  view_offset_ms: number | null;
  percent_complete: number | null;
  watched: number | null;
};

const NULL_FACTS: SessionFacts = {
  transcode_decision: null,
  video_decision: null,
  audio_decision: null,
  video_resolution: null,
  stream_video_resolution: null,
  bitrate: null,
  bandwidth: null,
  location: null,
  relayed: null,
  view_offset_ms: null,
  percent_complete: null,
  watched: null,
};

/** Fields read from the PlexSession-shaped meta blob. */
type SessionMeta = {
  decision?: string;
  videoDecision?: string;
  audioDecision?: string;
  resolution?: string;
  originalHeight?: string;
  transcodeHeight?: string;
  quality?: string;
  bitrateKbps?: number;
  bandwidth?: number;
  location?: string;
  relayed?: boolean;
  viewOffset?: number;
  duration?: number;
};

/** "3.5 Mbps" -> 3500 kbps. */
const bitrateFromQuality = (quality?: string): number | null => {
  if (!quality) return null;
  const mbps = Number.parseFloat(quality.replace(" Mbps", ""));
  return Number.isFinite(mbps) ? Math.round(mbps * 1000) : null;
};

export const extractSessionFacts = (meta_json: string | null | undefined): SessionFacts => {
  if (!meta_json) return NULL_FACTS;

  let meta: SessionMeta;
  try {
    meta = JSON.parse(meta_json) as SessionMeta;
  } catch {
    return NULL_FACTS;
  }

  const decision = meta.decision?.toLowerCase() ?? null;
  const viewOffset = Number(meta.viewOffset);
  const runtime = Number(meta.duration);

  const percentComplete =
    Number.isFinite(viewOffset) && Number.isFinite(runtime) && runtime > 0
      ? Math.min(100, Math.round((100 * viewOffset) / runtime))
      : null;

  return {
    transcode_decision: decision,
    video_decision: meta.videoDecision?.toLowerCase() ?? null,
    audio_decision: meta.audioDecision?.toLowerCase() ?? null,
    video_resolution: meta.originalHeight ?? meta.resolution ?? null,
    stream_video_resolution:
      decision === "transcode"
        ? meta.transcodeHeight ?? meta.resolution ?? null
        : meta.resolution ?? meta.originalHeight ?? null,
    bitrate: Number.isFinite(Number(meta.bitrateKbps)) && meta.bitrateKbps !== undefined
      ? Number(meta.bitrateKbps)
      : bitrateFromQuality(meta.quality),
    bandwidth: Number.isFinite(Number(meta.bandwidth)) && meta.bandwidth !== undefined
      ? Number(meta.bandwidth)
      : null,
    location: meta.location ?? null,
    relayed: meta.relayed === undefined ? null : meta.relayed ? 1 : 0,
    view_offset_ms: Number.isFinite(viewOffset) && meta.viewOffset !== undefined ? viewOffset : null,
    percent_complete: percentComplete,
    watched: percentComplete === null ? null : percentComplete >= WATCHED_THRESHOLD_PERCENT ? 1 : 0,
  };
};

/** Wallclock duration minus accumulated pause time = actual play time (seconds). */
export const playDurationOf = (durationSeconds: number, pausedCounter: number | null | undefined): number =>
  Math.max(0, durationSeconds - (pausedCounter ?? 0));
