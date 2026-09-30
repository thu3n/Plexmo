import { db } from "../db";
import { getSetting, setSetting } from "../settings";
import { Logger } from "../logger";
import { detectAnomalies } from "./anomalies-detect";
import { ANOMALY_SCAN_INTERVAL_MS, ANOMALY_SCAN_LAST_RUN_KEY } from "./anomalies-config";
import { collectNewClients, collectServerMetrics } from "./anomalies-query";
import { pruneAnomalies, recordAnomalies, type StoredAnomaly } from "./anomalies-store";
import { notifyAnomalies } from "../notifications/anomaly-notify";

/**
 * Daily anomaly scan, driven by the 60s cron tick and self-gated like the
 * retention sweep. The gate stores epoch ms (not a date key) so Settings →
 * Jobs can show an exact last-run time and the windows stay 24h apart.
 */

/** Paused (disabledAt) servers are not polled, so their silence is expected. */
const monitoredServerIds = (): string[] =>
    (db.prepare("SELECT id FROM servers WHERE archivedAt IS NULL AND disabledAt IS NULL").all() as { id: string }[])
        .map((r) => r.id);

/** Run the scan now. Returns the newly opened incidents. */
export const runAnomalyScan = (now: number = Date.now()): StoredAnomaly[] => {
    const serverIds = monitoredServerIds();
    const detected = detectAnomalies(collectServerMetrics(serverIds, now), collectNewClients(serverIds, now));
    const opened = recordAnomalies(detected, now);
    const pruned = pruneAnomalies(now);
    setSetting(ANOMALY_SCAN_LAST_RUN_KEY, String(now));
    Logger.info(
        `[Anomalies] Scanned ${serverIds.length} server(s): ${detected.length} condition(s), ${opened.length} new, ${pruned} pruned.`
    );
    return opened;
};

export const getAnomalyScanLastRun = (): number | null => {
    const ms = Number(getSetting(ANOMALY_SCAN_LAST_RUN_KEY) ?? "");
    return Number.isFinite(ms) && ms > 0 ? ms : null;
};

/**
 * Cron entry point: scan when a day has passed since the last scan, then
 * announce new incidents. Discord posts are fire-and-forget (like start/stop)
 * so a slow webhook never holds up the single-flight cron run.
 */
export const runAnomalyScanIfDue = (now: number = Date.now()): StoredAnomaly[] | null => {
    const last = getAnomalyScanLastRun();
    if (last !== null && now - last < ANOMALY_SCAN_INTERVAL_MS) return null;
    const opened = runAnomalyScan(now);
    if (opened.length > 0) {
        notifyAnomalies(opened, now).catch((e) => Logger.error("[Anomalies] Notification failed:", e));
    }
    return opened;
};
