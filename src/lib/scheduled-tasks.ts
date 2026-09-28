import { db } from "./db";
import { getSetting } from "./settings";
import { getTaskLastRun } from "./task-runs";
import { RETENTION_LAST_RUN_KEY } from "./retention-config";
import { localDateKeyToMs, localMidnight, nextAlignedRun, nextLocalMidnight, nextRunAfter } from "./schedule-math";

/**
 * Read model of the recurring background work started by instrumentation.ts
 * and cron.ts, for Settings → Jobs. Cadences mirror those files (they keep
 * their constants local); update both when a schedule changes.
 */

/** instrumentation.ts: setInterval(runCronJob, 60000). */
const SESSION_POLL_INTERVAL_MS = 60_000;
/** instrumentation.ts: LIBRARY_SYNC_INTERVAL_MS. */
const LIBRARY_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** stats-prewarm.ts: PREWARM_INTERVAL_MS. */
const STATS_PREWARM_INTERVAL_MS = 5 * 60_000;
/** dedup-shows.ts / repair-episode-titles.ts: RESWEEP_INTERVAL_MS. */
const MAINTENANCE_RESWEEP_MS = 24 * 60 * 60 * 1000;

const SHOW_DEDUP_SWEPT_AT_KEY = "SHOW_DEDUP_SWEPT_AT";
const EPISODE_REPAIR_SWEPT_AT_KEY = "EPISODE_REPAIR_SWEPT_AT";
const LIBRARY_SYNC_JOB_TYPE = "library_sync";

export type ScheduledTask = {
    id: string;
    name: string;
    description: string;
    cadence: string;
    lastRunAt: string | null;
    /** True when only the calendar date of the last run is recorded. */
    lastRunDateOnly: boolean;
    /** Best estimate; null when it depends on something not yet observed. */
    nextRunAt: string | null;
    /** jobs.type this task records rows under, if any. */
    jobType: string | null;
    /** POST endpoint for "Run now"; only for tasks that are safe to trigger manually. */
    runEndpoint: string | null;
};

const toIso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString());

const msSetting = (key: string): number | null => {
    const n = Number(getSetting(key) ?? "");
    return Number.isFinite(n) && n > 0 ? n : null;
};

const lastJobCreatedAt = (type: string): number | null => {
    const row = db
        .prepare<[string], { createdAt: string }>("SELECT createdAt FROM jobs WHERE type = ? ORDER BY createdAt DESC LIMIT 1")
        .get(type);
    const ms = row ? Date.parse(row.createdAt) : NaN;
    return Number.isFinite(ms) ? ms : null;
};

export const getScheduledTasks = (nowMs: number = Date.now()): ScheduledTask[] => {
    const processStartMs = nowMs - process.uptime() * 1000;
    const statsGlobal = globalThis as typeof globalThis & { __plexmo_stats_prewarm_at?: number };

    const sessionLast = getTaskLastRun("session_poll");
    const sessionNext = nextRunAfter(sessionLast, SESSION_POLL_INTERVAL_MS, nowMs);

    const retentionKey = getSetting(RETENTION_LAST_RUN_KEY) ?? null;
    const retentionLast = localDateKeyToMs(retentionKey);
    const retentionRanToday = retentionLast !== null && retentionLast >= localMidnight(nowMs);

    const statsLast = statsGlobal.__plexmo_stats_prewarm_at ?? null;
    const dedupLast = msSetting(SHOW_DEDUP_SWEPT_AT_KEY);
    const repairLast = msSetting(EPISODE_REPAIR_SWEPT_AT_KEY);

    return [
        {
            id: "session_poll",
            name: "Session sync & rules",
            description:
                "Polls every server for active sessions, writes history, enforces rules, records concurrency and flushes stale sessions. Also triggered in real time by Plex WebSocket events.",
            cadence: "Every minute",
            lastRunAt: toIso(sessionLast),
            lastRunDateOnly: false,
            nextRunAt: toIso(sessionNext),
            jobType: null,
            runEndpoint: null,
        },
        {
            id: "library_sync",
            name: "Library inventory sync",
            description: "Refreshes library and media inventory from every server. Also runs at startup.",
            cadence: "Every 6 hours",
            lastRunAt: toIso(lastJobCreatedAt(LIBRARY_SYNC_JOB_TYPE)),
            lastRunDateOnly: false,
            nextRunAt: toIso(nextAlignedRun(processStartMs, LIBRARY_SYNC_INTERVAL_MS, nowMs)),
            jobType: LIBRARY_SYNC_JOB_TYPE,
            runEndpoint: "/api/libraries/sync",
        },
        {
            id: "retention",
            name: "Data retention cleanup",
            description: "Prunes old concurrency snapshots, rule events and job history (Settings → General).",
            cadence: "Daily",
            lastRunAt: toIso(retentionLast),
            lastRunDateOnly: true,
            // Runs on the first session sync of each local day.
            nextRunAt: toIso(retentionRanToday ? nextLocalMidnight(nowMs) : sessionNext),
            jobType: null,
            runEndpoint: null,
        },
        {
            id: "stats_prewarm",
            name: "Statistics cache prewarm",
            description: "Keeps the default statistics view cached so it opens instantly.",
            cadence: "Every 5 minutes",
            lastRunAt: toIso(statsLast),
            lastRunDateOnly: false,
            nextRunAt: toIso(nextRunAfter(statsLast, STATS_PREWARM_INTERVAL_MS, nowMs)),
            jobType: null,
            runEndpoint: null,
        },
        {
            id: "show_dedup",
            name: "Duplicate show merge",
            description: "Merges legacy duplicate show entries left by older imports.",
            cadence: "Daily",
            lastRunAt: toIso(dedupLast),
            lastRunDateOnly: false,
            nextRunAt: toIso(nextRunAfter(dedupLast, MAINTENANCE_RESWEEP_MS, nowMs)),
            jobType: null,
            runEndpoint: null,
        },
        {
            id: "episode_repair",
            name: "Episode title repair",
            description: "Fixes generic episode titles and missing show links in batches, then rests for a day after a full sweep.",
            cadence: "Daily sweep",
            lastRunAt: toIso(repairLast),
            lastRunDateOnly: false,
            nextRunAt: toIso(nextRunAfter(repairLast, MAINTENANCE_RESWEEP_MS, nowMs)),
            jobType: null,
            runEndpoint: null,
        },
    ];
};
