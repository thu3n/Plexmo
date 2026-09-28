/**
 * Retention windows shared by the daily sweep (retention.ts), the settings API
 * validation and the Settings → General card. Kept free of DB imports so the
 * client bundle can use the same defaults and bounds the server enforces.
 */

export const RETENTION_DEFAULTS = {
  concurrentSnapshotsDays: 90,
  ruleEventsDays: 180,
  finishedJobsDays: 30,
} as const;

export type RetentionWindow = keyof typeof RETENTION_DEFAULTS;

export const RETENTION_SETTING_KEYS: Record<RetentionWindow, string> = {
  concurrentSnapshotsDays: "retention_concurrent_snapshots_days",
  ruleEventsDays: "retention_rule_events_days",
  finishedJobsDays: "retention_finished_jobs_days",
};

/** Local date (YYYY-MM-DD) of the last sweep; written by the sweep, read-only to clients. */
export const RETENTION_LAST_RUN_KEY = "retention_last_run_date";

export const RETENTION_MIN_DAYS = 1;
/** Ten years — anything longer is effectively "keep forever" and only bloats the DB. */
export const RETENTION_MAX_DAYS = 3650;

export type RetentionDaysResult = { ok: true; days: number } | { ok: false; error: string };

/** Accepts a whole number of days within [RETENTION_MIN_DAYS, RETENTION_MAX_DAYS]. */
export const parseRetentionDays = (raw: unknown): RetentionDaysResult => {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d+$/.test(text)) {
    return { ok: false, error: "Retention must be a whole number of days" };
  }
  const days = Number(text);
  if (days < RETENTION_MIN_DAYS || days > RETENTION_MAX_DAYS) {
    return { ok: false, error: `Retention must be between ${RETENTION_MIN_DAYS} and ${RETENTION_MAX_DAYS} days` };
  }
  return { ok: true, days };
};
