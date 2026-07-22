import { db } from "@/lib/db";
import type { ConcurrentSnapshotRow, StreamPeakRow } from "@/lib/db-types";
import type { PlexSession } from "@/lib/plex";

/**
 * Concurrent-stream tracking: snapshot history + persistent peaks.
 *
 * concurrent_snapshots rows are written per scope on state changes only —
 * one cross-server aggregate row (serverId NULL, the pre-v13 format) plus one
 * row per server with active sessions. Snapshots answer windowed peaks but
 * are retention-pruned (90d default), so all-time records live in
 * stream_peaks, keyed 'global' or by serverId, and never pruned.
 */

export const GLOBAL_PEAK_SCOPE = "global";

export type PeakInfo = { count: number; timestamp: number | null };
export type PeakScope = { serverId?: string; allowedServerIds?: string[] };

/** Stored sessions blob — only ever read back for set-equality dedup, so keep it slim. */
type SlimSession = { id: string; user: string; title: string };

const lastGlobalSnapshot = db.prepare<[], Pick<ConcurrentSnapshotRow, "count" | "sessions">>(
    "SELECT count, sessions FROM concurrent_snapshots WHERE serverId IS NULL ORDER BY timestamp DESC LIMIT 1"
);
const lastServerSnapshot = db.prepare<[string], Pick<ConcurrentSnapshotRow, "count" | "sessions">>(
    "SELECT count, sessions FROM concurrent_snapshots WHERE serverId = ? ORDER BY timestamp DESC LIMIT 1"
);
const insertSnapshot = db.prepare(
    "INSERT INTO concurrent_snapshots (count, sessions, timestamp, serverId) VALUES (?, ?, ?, ?)"
);
// Monotonic: only a strictly higher count replaces the row, so ties keep the
// timestamp of the first occurrence ("the moment the record was set").
const upsertPeak = db.prepare(`
    INSERT INTO stream_peaks (scope, count, timestamp, updatedAt) VALUES (?, ?, ?, ?)
    ON CONFLICT(scope) DO UPDATE SET
      count = excluded.count, timestamp = excluded.timestamp, updatedAt = excluded.updatedAt
    WHERE excluded.count > stream_peaks.count
`);

const sessionIdSet = (sessions: { id: string }[]): string =>
    sessions.map((s) => s.id).sort().join(",");

/**
 * Session ids are `${serverId}:${sessionKey}` stream ids, so identical sets
 * really are identical — colliding ratingKeys across servers can't merge.
 * Legacy rows stored full PlexSession objects; they parse the same `id` field.
 */
const isUnchanged = (
    last: Pick<ConcurrentSnapshotRow, "count" | "sessions"> | undefined,
    sessions: PlexSession[]
): boolean => {
    if (!last || last.count !== sessions.length) return false;
    const lastSessions = JSON.parse(last.sessions) as { id: string }[];
    return sessionIdSet(lastSessions) === sessionIdSet(sessions);
};

const recordScope = (serverId: string | null, sessions: PlexSession[], now: number): void => {
    const last = serverId ? lastServerSnapshot.get(serverId) : lastGlobalSnapshot.get();
    if (!isUnchanged(last, sessions)) {
        const slim: SlimSession[] = sessions.map((s) => ({ id: s.id, user: s.user, title: s.title }));
        insertSnapshot.run(sessions.length, JSON.stringify(slim), now, serverId);
    }
    upsertPeak.run(serverId ?? GLOBAL_PEAK_SCOPE, sessions.length, now, now);
};

/**
 * Record the current live-session state: one global scope over all sessions
 * plus one scope per server with sessions. Callers are single-flighted (cron),
 * the transaction adds atomicity across the per-scope statements.
 */
export const recordConcurrent: (sessions: PlexSession[], now?: number) => void = db.transaction(
    (sessions: PlexSession[], now: number = Date.now()) => {
        if (sessions.length === 0) return;
        recordScope(null, sessions, now);

        const byServer = new Map<string, PlexSession[]>();
        for (const session of sessions) {
            if (!session.serverId) continue;
            const group = byServer.get(session.serverId);
            if (group) group.push(session);
            else byServer.set(session.serverId, [session]);
        }
        for (const [serverId, group] of byServer) recordScope(serverId, group, now);
    }
);

/**
 * Snapshot scope resolution: an explicit serverId wins (route has already
 * authz-checked it); a scoped viewer sees the max over their allowed servers'
 * rows (slight under-report of true coincident concurrency, never a leak);
 * unrestricted viewers read the global aggregate rows.
 */
const snapshotScopeSql = (scope: PeakScope): { sql: string; args: string[] } => {
    if (scope.serverId) return { sql: "serverId = ?", args: [scope.serverId] };
    if (scope.allowedServerIds) {
        const marks = scope.allowedServerIds.map(() => "?").join(",");
        return { sql: `serverId IN (${marks})`, args: scope.allowedServerIds };
    }
    return { sql: "serverId IS NULL", args: [] };
};

/** Highest snapshot in the window; exact while retention covers the window. */
export function getWindowPeak(scope: PeakScope, since: number): PeakInfo {
    const { sql, args } = snapshotScopeSql(scope);
    const row = db.prepare<(string | number)[], Pick<ConcurrentSnapshotRow, "count" | "timestamp">>(
        `SELECT count, timestamp FROM concurrent_snapshots
         WHERE ${sql} AND timestamp >= ?
         ORDER BY count DESC, timestamp ASC LIMIT 1`
    ).get(...args, since);
    return row ? { count: row.count, timestamp: row.timestamp } : { count: 0, timestamp: null };
}

/** All-time peak from stream_peaks; falls back to snapshots for rows predating v13 writes. */
export function getAllTimePeak(scope: PeakScope): PeakInfo {
    const scopes = scope.serverId
        ? [scope.serverId]
        : scope.allowedServerIds ?? [GLOBAL_PEAK_SCOPE];
    const marks = scopes.map(() => "?").join(",");
    const row = db.prepare<string[], Pick<StreamPeakRow, "count" | "timestamp">>(
        `SELECT count, timestamp FROM stream_peaks
         WHERE scope IN (${marks})
         ORDER BY count DESC, timestamp ASC LIMIT 1`
    ).get(...scopes);
    if (row) return { count: row.count, timestamp: row.timestamp };
    return getWindowPeak(scope, 0);
}
