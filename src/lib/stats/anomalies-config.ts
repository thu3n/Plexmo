/**
 * Scan cadence, split out so Settings → Jobs (scheduled-tasks.ts) can read it
 * without importing the scan and its notification dependencies.
 */

/** settings key holding the last scan time (epoch ms). */
export const ANOMALY_SCAN_LAST_RUN_KEY = "ANOMALY_SCAN_LAST_RUN";
export const ANOMALY_SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000;
