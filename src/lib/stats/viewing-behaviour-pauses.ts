import { db } from "../db";
import {
    DEFAULT_BEHAVIOUR_LIMIT,
    behaviourFilter,
    type BehaviourParams,
} from "./viewing-behaviour";

/**
 * Pause intensity. `pausedCounter` is accumulated SECONDS in the paused state
 * (not a pause count), so the comparable metric is paused minutes per hour of
 * actual playback. A single session left paused overnight would swamp every
 * average, so each session's pause time is capped first.
 *
 * Plexmo can't tell a user pressing pause from a client stalling, but people
 * pause about the same everywhere — a client pausing far more than the
 * instance as a whole, across many sessions, points at playback trouble
 * (buffering, network, a struggling device).
 */

/** Sessions shorter than this are trailers, previews and misclicks. */
export const MIN_PAUSE_SESSION_SECONDS = 300;
/** Per-session pause cap: beyond this the viewer walked away, it says nothing about the client. */
export const PAUSE_CAP_SECONDS = 30 * 60;
export const MIN_CLIENT_SESSIONS = 10;
export const MIN_TITLE_SESSIONS = 3;
/** Flag a client pausing at least this multiple of the instance-wide rate… */
export const BUFFERING_FLAG_RATIO = 2;
/** …and at least this many minutes per hour (2× a near-zero baseline is still nothing). */
export const BUFFERING_FLAG_MIN_RATE = 3;

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

export type PauseRow = {
    key: string;
    label: string;
    /** Platform for clients; year for titles. */
    sub: string | null;
    sessions: number;
    /** Share (0–100) of sessions with any pause at all. */
    pausedSessionShare: number;
    /** Paused minutes per hour of playback, one decimal. */
    minutesPerHour: number;
    /** Client flag: pauses far above the instance baseline — likely buffering. */
    flagged: boolean;
};

export type PauseStats = {
    sessions: number;
    /** Instance-wide paused minutes per playback hour — the flag baseline. */
    minutesPerHour: number;
    clients: PauseRow[];
    titles: PauseRow[];
};

type AggregateRow = {
    key: string;
    label: string;
    sub: string | number | null;
    sessions: number;
    pausedSessions: number;
    pauseSeconds: number;
    playSeconds: number;
};

const AGGREGATES = `
    COUNT(*) AS sessions,
    SUM(CASE WHEN COALESCE(h.pausedCounter, 0) > 0 THEN 1 ELSE 0 END) AS pausedSessions,
    SUM(MIN(COALESCE(h.pausedCounter, 0), ?)) AS pauseSeconds,
    SUM(COALESCE(h.play_duration, MAX(0, h.duration - COALESCE(h.pausedCounter, 0)))) AS playSeconds`;

const rateOf = (pauseSeconds: number, playSeconds: number): number =>
    playSeconds > 0
        ? Math.round(((pauseSeconds / SECONDS_PER_MINUTE) / (playSeconds / SECONDS_PER_HOUR)) * 10) / 10
        : 0;

const toPauseRow = (row: AggregateRow, flagged: boolean): PauseRow => ({
    key: row.key,
    label: row.label,
    sub: row.sub === null ? null : String(row.sub),
    sessions: row.sessions,
    pausedSessionShare: row.sessions > 0 ? Math.round((row.pausedSessions / row.sessions) * 100) : 0,
    minutesPerHour: rateOf(row.pauseSeconds, row.playSeconds),
    flagged,
});

/** Pure flag rule, shared by the query and tests. */
export const isLikelyBuffering = (rate: number, baseline: number, sessions: number): boolean =>
    sessions >= MIN_CLIENT_SESSIONS && rate >= BUFFERING_FLAG_MIN_RATE && rate >= baseline * BUFFERING_FLAG_RATIO;

export const getPauseStats = (params: BehaviourParams): PauseStats => {
    const { where, args } = behaviourFilter(params);
    const limit = params.limit ?? DEFAULT_BEHAVIOUR_LIMIT;
    const scope = `${where} AND h.duration >= ?`;
    const scopeArgs = [...args, MIN_PAUSE_SESSION_SECONDS];

    const overall = db.prepare(`
        SELECT ${AGGREGATES} FROM activity_history h WHERE ${scope}
    `).get(PAUSE_CAP_SECONDS, ...scopeArgs) as Omit<AggregateRow, "key" | "label" | "sub">;
    const baseline = rateOf(overall.pauseSeconds ?? 0, overall.playSeconds ?? 0);

    const clientRows = db.prepare(`
        SELECT
            COALESCE(h.platform, '') || '|' || COALESCE(h.player, h.device, '') AS key,
            COALESCE(h.player, h.device, h.platform, 'Unknown') AS label,
            h.platform AS sub,
            ${AGGREGATES}
        FROM activity_history h
        WHERE ${scope}
        GROUP BY h.platform, COALESCE(h.player, h.device)
        HAVING COUNT(*) >= ?
    `).all(PAUSE_CAP_SECONDS, ...scopeArgs, MIN_CLIENT_SESSIONS) as AggregateRow[];

    const titleRows = db.prepare(`
        SELECT
            CAST(t.id AS TEXT) AS key,
            t.title AS label,
            t.year AS sub,
            ${AGGREGATES}
        FROM activity_history h
        JOIN media_items e ON h.mediaId = e.id
        JOIN media_items t ON t.id = COALESCE(e.showMediaId, e.id)
        WHERE ${scope}
        GROUP BY t.id
        HAVING COUNT(*) >= ?
    `).all(PAUSE_CAP_SECONDS, ...scopeArgs, MIN_TITLE_SESSIONS) as AggregateRow[];

    const byRate = (a: PauseRow, b: PauseRow) => b.minutesPerHour - a.minutesPerHour || b.sessions - a.sessions;

    return {
        sessions: overall.sessions,
        minutesPerHour: baseline,
        clients: clientRows
            .map((row) => {
                const rate = rateOf(row.pauseSeconds, row.playSeconds);
                return toPauseRow(row, isLikelyBuffering(rate, baseline, row.sessions));
            })
            .sort(byRate)
            .slice(0, limit),
        titles: titleRows.map((row) => toPauseRow(row, false)).sort(byRate).slice(0, limit),
    };
};
