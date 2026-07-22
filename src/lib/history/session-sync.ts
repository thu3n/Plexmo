import { db } from "../db";
import { ensureAccountId } from "../identity";
import type { PlexSession, PlexServerConfig } from "../plex";
import type { ActiveSessionRow } from "../db-types";
import type { HistoryEntry } from "./types";
import { insertHistoryRow, hasHistoryNear } from "./history-write";
import { parseGuidList, resolveMediaId, type MediaGuids } from "./media-resolve";

/** Sessions shorter than this are considered accidental clicks and not logged. */
const MIN_LOGGED_SECONDS = 10;
/** If a session vanished and was last seen longer ago than this, its stop time is lastSeen (not "now"). */
const STOP_GAP_SECONDS = 60;
/** viewOffset above this counts as a resume rather than a fresh start. */
const RESUME_OFFSET_MS = 60 * 1000;
/** Process uptime below this means Plexmo just (re)started mid-stream. */
const STARTUP_GRACE_SECONDS = 120;
/** Window used to guard live flushes against double-logging around restarts. */
const FLUSH_DEDUP_WINDOW_MS = 120 * 1000;

const getActiveByServer = db.prepare<{ serverId: string }, ActiveSessionRow>(`
  SELECT * FROM active_sessions WHERE serverId = @serverId
`);

const insertActive = db.prepare(`
  INSERT OR REPLACE INTO active_sessions (
    serverId, sessionKey, plexSessionId, userId, user, title, subtitle, ratingKey, mediaId,
    startTime, lastSeen, state, platform, device, ip, meta_json, pausedCounter, pausedSince,
    plex_guid, imdb_id, tmdb_id, tvdb_id
  ) VALUES (
    @serverId, @sessionKey, @plexSessionId, @userId, @user, @title, @subtitle, @ratingKey, @mediaId,
    @startTime, @lastSeen, @state, @platform, @device, @ip, @meta_json, @pausedCounter, @pausedSince,
    @plex_guid, @imdb_id, @tmdb_id, @tvdb_id
  )
`);

const updateActive = db.prepare(`
  UPDATE active_sessions
  SET lastSeen = @lastSeen, state = @state, meta_json = @meta_json,
      pausedCounter = @pausedCounter, pausedSince = @pausedSince
  WHERE serverId = @serverId AND sessionKey = @sessionKey
`);

const deleteActive = db.prepare(`
  DELETE FROM active_sessions WHERE serverId = @serverId AND sessionKey = @sessionKey
`);

/** Per-server stream key. Prefer Plex's per-stream sessionKey; never the media ratingKey unless nothing else exists. */
const streamKeyOf = (session: PlexSession): string =>
  String(session.sessionKey || session.sessionId || session.ratingKey || session.id);

/** Resolve GUIDs + canonical media item for a live session at capture time. */
const captureMedia = (
  serverId: string,
  session: PlexSession
): { guids: MediaGuids; mediaId: number | null } => {
  const guids = parseGuidList(session.Guid);
  if (session.guid?.startsWith("plex://")) guids.plexGuid = session.guid;

  const ratingKey = session.ratingKey ? String(session.ratingKey) : undefined;
  if (!ratingKey) return { guids, mediaId: null };

  const isEpisode = session.type === "episode" || (!session.type && Boolean(session.grandparentTitle));
  const mediaId = resolveMediaId({
    serverId,
    ratingKey,
    type: session.type ?? (isEpisode ? "episode" : "movie"),
    title: session.originalTitle || session.title,
    year: session.year ? Number(session.year) : undefined,
    guids,
    show: isEpisode
      ? {
          plexGuid: session.grandparentGuid,
          title: session.grandparentTitle,
          seasonNumber: session.parentIndex !== undefined ? Number(session.parentIndex) : undefined,
          episodeNumber: session.index !== undefined ? Number(session.index) : undefined,
        }
      : undefined,
  });
  return { guids, mediaId };
};

/**
 * Close a stored active row into history. Returns the entry, or null when the
 * session was too short or a duplicate row already exists (restart guard).
 * Does NOT delete the active row — callers do that.
 */
const closeStoredSession = (stored: ActiveSessionRow, now: number): HistoryEntry | null => {
  const timeSinceLastSeen = (now - stored.lastSeen) / 1000;
  const effectiveStopTime = timeSinceLastSeen > STOP_GAP_SECONDS ? stored.lastSeen : now;
  const durationSeconds = Math.round((effectiveStopTime - stored.startTime) / 1000);

  if (durationSeconds <= MIN_LOGGED_SECONDS) return null;

  if (
    hasHistoryNear(
      stored.serverId,
      stored.user,
      stored.ratingKey,
      stored.startTime - FLUSH_DEDUP_WINDOW_MS,
      stored.startTime + FLUSH_DEDUP_WINDOW_MS
    )
  ) {
    return null;
  }

  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    serverId: stored.serverId,
    userId: stored.userId || undefined,
    user: stored.user,
    title: stored.title,
    subtitle: stored.subtitle || undefined,
    ratingKey: stored.ratingKey,
    startTime: stored.startTime,
    stopTime: effectiveStopTime,
    duration: durationSeconds,
    platform: stored.platform || undefined,
    device: stored.device || undefined,
    ip: stored.ip || undefined,
    meta_json: stored.meta_json || undefined,
    pausedCounter: stored.pausedCounter,
    plex_guid: stored.plex_guid || undefined,
    imdb_id: stored.imdb_id || undefined,
    tmdb_id: stored.tmdb_id || undefined,
    tvdb_id: stored.tvdb_id || undefined,
    mediaId: stored.mediaId ?? undefined,
  };
  insertHistoryRow(entry);
  return entry;
};

export const syncHistory = (server: PlexServerConfig, currentSessions: PlexSession[]) => {
  if (!server.id) return { newSessions: [], endedSessions: [] };

  const serverId = server.id;
  const now = Date.now();
  const storedSessions = getActiveByServer.all({ serverId });
  const storedByKey = new Map(storedSessions.map((s) => [s.sessionKey, s]));

  const newSessions: PlexSession[] = [];
  const endedSessions: HistoryEntry[] = [];

  // 1. Process current sessions: insert new ones, update existing ones.
  for (const session of currentSessions) {
    const sessionKey = streamKeyOf(session);
    let existing = storedByKey.get(sessionKey);
    const isPaused = session.state === "paused";

    // Sequential playback: same stream key, content changed -> close the old
    // item to history and re-enter as a new one.
    if (existing && session.ratingKey && existing.ratingKey !== String(session.ratingKey)) {
      const ended = closeStoredSession(existing, now);
      if (ended) endedSessions.push(ended);
      deleteActive.run({ serverId, sessionKey });
      existing = undefined;
    }

    if (existing) {
      // Update heartbeat
      let pausedCounter = existing.pausedCounter;
      let pausedSince = existing.pausedSince;

      if (isPaused) {
        if (!pausedSince) pausedSince = now;
        const elapsed = (now - existing.lastSeen) / 1000;
        if (elapsed > 0) {
          pausedCounter += Math.round(elapsed);
        }
      } else {
        pausedSince = null;
      }

      updateActive.run({
        serverId,
        sessionKey,
        lastSeen: now,
        state: session.state,
        meta_json: JSON.stringify(session),
        pausedCounter,
        pausedSince,
      });
    } else {
      // New session started
      newSessions.push(session);

      const viewOffset = Number(session.viewOffset || 0);

      // Heuristic to handle "Resumed" vs "Mid-Stream Startup":
      // - If Plexmo just started (< STARTUP_GRACE_SECONDS uptime), assume the
      //   session was already running and backfill its start time.
      // - Otherwise a large viewOffset means a user resume: track from now.
      const uptime = process.uptime();
      const isResume = viewOffset > RESUME_OFFSET_MS;
      const isServerRestart = uptime < STARTUP_GRACE_SECONDS;

      let calculatedStartTime;
      if (isResume) {
        calculatedStartTime = isServerRestart ? now - viewOffset : now;
      } else {
        calculatedStartTime = now - viewOffset;
      }

      const { guids, mediaId } = captureMedia(serverId, session);
      const accountId = ensureAccountId(session.user, session.userId);

      insertActive.run({
        serverId,
        sessionKey,
        plexSessionId: session.sessionId || null,
        userId: accountId,
        user: session.user,
        title: session.title,
        subtitle: session.subtitle ?? null,
        ratingKey: String(session.ratingKey || sessionKey),
        mediaId,
        startTime: calculatedStartTime,
        lastSeen: now,
        state: session.state,
        platform: session.platform ?? null,
        device: session.device ?? null,
        ip: session.ip ?? null,
        meta_json: JSON.stringify(session),
        pausedCounter: 0,
        pausedSince: isPaused ? now : null,
        plex_guid: guids.plexGuid ?? null,
        imdb_id: guids.imdbId ?? null,
        tmdb_id: guids.tmdbId ?? null,
        tvdb_id: guids.tvdbId ?? null,
      });
    }
  }

  // 2. Process ended sessions: stored rows not present in the current list.
  const currentKeys = new Set(currentSessions.map(streamKeyOf));

  for (const stored of storedSessions) {
    if (!currentKeys.has(stored.sessionKey)) {
      const ended = closeStoredSession(stored, now);
      if (ended) endedSessions.push(ended);
      deleteActive.run({ serverId: stored.serverId, sessionKey: stored.sessionKey });
    }
  }

  return { newSessions, endedSessions };
};

const getStaleSessions = db.prepare<[number], ActiveSessionRow>(
  "SELECT * FROM active_sessions WHERE lastSeen < ?"
);

/**
 * Flush sessions that stopped receiving heartbeats (server offline, listener
 * gap) into history instead of silently dropping them — their watch time up
 * to lastSeen is real. Returns the flushed entries.
 */
export const flushStaleSessions = (cutoff: number): HistoryEntry[] => {
  const stale = getStaleSessions.all(cutoff);
  const flushed: HistoryEntry[] = [];
  for (const stored of stale) {
    const ended = closeStoredSession(stored, Date.now());
    if (ended) flushed.push(ended);
    deleteActive.run({ serverId: stored.serverId, sessionKey: stored.sessionKey });
  }
  return flushed;
};
