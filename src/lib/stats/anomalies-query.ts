import { db } from "../db";
import {
    BASELINE_DAYS,
    CURRENT_WINDOW_MS,
    DAY_MS,
    NEW_CLIENT_MIN_TRANSCODES,
    SILENT_WINDOW_MS,
    type NewClientMetrics,
    type ServerWindowMetrics,
} from "./anomalies-detect";

/**
 * Window aggregates for the anomaly rules. One conditional-aggregation pass
 * over the last ~16 days of history per scan (daily), bounded by the
 * startTime index — never a full-history scan except the per-candidate
 * "seen before?" probe for new clients, which only runs for the handful of
 * clients that already crossed the transcode threshold.
 */

type MetricsRow = Omit<ServerWindowMetrics, "serverId"> & { serverId: string };

const emptyMetrics = (serverId: string): ServerWindowMetrics => ({
    serverId,
    currentPlays: 0,
    currentKnownDecisions: 0,
    currentTranscodes: 0,
    baselinePlays: 0,
    baselineKnownDecisions: 0,
    baselineTranscodes: 0,
    silentWindowPlays: 0,
    silentBaselineActiveDays: 0,
});

export const windowBounds = (now: number) => {
    const current = now - CURRENT_WINDOW_MS;
    const silent = now - SILENT_WINDOW_MS;
    return {
        now,
        current,
        baseline: current - BASELINE_DAYS * DAY_MS,
        silent,
        silentBaseline: silent - BASELINE_DAYS * DAY_MS,
    };
};

/** Metrics for every given server; servers with no history get all-zero rows. */
export const collectServerMetrics = (serverIds: string[], now: number): ServerWindowMetrics[] => {
    if (serverIds.length === 0) return [];
    const b = windowBounds(now);
    const earliest = Math.min(b.baseline, b.silentBaseline);
    const rows = db.prepare(`
        SELECT
          h.serverId AS serverId,
          SUM(CASE WHEN h.startTime >= @current THEN 1 ELSE 0 END) AS currentPlays,
          SUM(CASE WHEN h.startTime >= @current AND h.transcode_decision IS NOT NULL THEN 1 ELSE 0 END) AS currentKnownDecisions,
          SUM(CASE WHEN h.startTime >= @current AND h.transcode_decision = 'transcode' THEN 1 ELSE 0 END) AS currentTranscodes,
          SUM(CASE WHEN h.startTime >= @baseline AND h.startTime < @current THEN 1 ELSE 0 END) AS baselinePlays,
          SUM(CASE WHEN h.startTime >= @baseline AND h.startTime < @current
                    AND h.transcode_decision IS NOT NULL THEN 1 ELSE 0 END) AS baselineKnownDecisions,
          SUM(CASE WHEN h.startTime >= @baseline AND h.startTime < @current
                    AND h.transcode_decision = 'transcode' THEN 1 ELSE 0 END) AS baselineTranscodes,
          SUM(CASE WHEN h.startTime >= @silent THEN 1 ELSE 0 END) AS silentWindowPlays,
          COUNT(DISTINCT CASE WHEN h.startTime >= @silentBaseline AND h.startTime < @silent
                THEN strftime('%Y-%m-%d', h.startTime / 1000, 'unixepoch', 'localtime') END) AS silentBaselineActiveDays
        FROM activity_history h
        WHERE h.startTime >= @earliest AND h.startTime < @now
        GROUP BY h.serverId
    `).all({ ...b, earliest }) as MetricsRow[];

    const byServer = new Map(rows.map((r) => [r.serverId, r]));
    return serverIds.map((id) => {
        const row = byServer.get(id);
        return row ? { ...emptyMetrics(id), ...row } : emptyMetrics(id);
    });
};

type ClientRow = {
    serverId: string;
    platform: string | null;
    client: string | null;
    plays: number;
    transcodes: number;
    users: string | null;
};

/**
 * Clients (platform + player/device name) on the given servers that
 * transcoded at least NEW_CLIENT_MIN_TRANSCODES times in the current window
 * and have no history on that server before it.
 */
export const collectNewClients = (serverIds: string[], now: number): NewClientMetrics[] => {
    if (serverIds.length === 0) return [];
    const b = windowBounds(now);
    const candidates = db.prepare(`
        SELECT
          h.serverId AS serverId,
          h.platform AS platform,
          COALESCE(h.player, h.device) AS client,
          COUNT(*) AS plays,
          SUM(CASE WHEN h.transcode_decision = 'transcode' THEN 1 ELSE 0 END) AS transcodes,
          GROUP_CONCAT(DISTINCT h.user) AS users
        FROM activity_history h
        WHERE h.startTime >= ? AND h.startTime < ?
          AND h.serverId IN (${serverIds.map(() => "?").join(",")})
        GROUP BY h.serverId, h.platform, COALESCE(h.player, h.device)
        HAVING transcodes >= ?
    `).all(b.current, b.now, ...serverIds, NEW_CLIENT_MIN_TRANSCODES) as ClientRow[];

    const seenBefore = db.prepare(`
        SELECT 1 FROM activity_history
        WHERE serverId = ? AND platform IS ? AND COALESCE(player, device) IS ? AND startTime < ?
        LIMIT 1
    `);

    return candidates
        .filter((c) => !seenBefore.get(c.serverId, c.platform, c.client, b.current))
        .map((c) => ({
            serverId: c.serverId,
            platform: c.platform,
            client: c.client,
            plays: c.plays,
            transcodes: c.transcodes,
            users: c.users ? c.users.split(",") : [],
        }));
};
