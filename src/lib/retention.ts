import { db } from "./db";
import { getSetting, setSetting } from "./settings";
import { Logger } from "./logger";

// Daily retention sweep. Called from cron.ts on every 60s tick; gates itself
// on the local date so the actual DELETEs run at most once per day. Windows
// are exposed as settings so they can be tuned without a code change; the
// defaults are conservative (anything user-visible stays, only ops noise is
// pruned).

const LAST_RUN_KEY = "retention_last_run_date";

// Default windows in days. The corresponding settings keys can override them.
const DEFAULTS = {
  concurrentSnapshotsDays: 90,
  ruleEventsDays: 180,
  finishedJobsDays: 30,
} as const;

const SETTING_KEYS = {
  concurrentSnapshotsDays: "retention_concurrent_snapshots_days",
  ruleEventsDays: "retention_rule_events_days",
  finishedJobsDays: "retention_finished_jobs_days",
} as const;

const todayLocalKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const readWindow = (key: string, defaultDays: number): number => {
  const raw = getSetting(key);
  if (!raw) return defaultDays;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultDays;
};

const deleteOldConcurrent = db.prepare(
  "DELETE FROM concurrent_snapshots WHERE timestamp < ?"
);
const deleteOldRuleEvents = db.prepare(
  "DELETE FROM rule_events WHERE triggeredAt < ?"
);
const deleteOldFinishedJobs = db.prepare(
  "DELETE FROM jobs WHERE status IN ('completed', 'failed') AND updatedAt < ?"
);

export const runRetentionSweepIfDue = () => {
  const today = todayLocalKey();
  if (getSetting(LAST_RUN_KEY) === today) return;

  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const concurrentCutoff = now - readWindow(SETTING_KEYS.concurrentSnapshotsDays, DEFAULTS.concurrentSnapshotsDays) * dayMs;
  const ruleEventsCutoff = new Date(now - readWindow(SETTING_KEYS.ruleEventsDays, DEFAULTS.ruleEventsDays) * dayMs).toISOString();
  const jobsCutoff = new Date(now - readWindow(SETTING_KEYS.finishedJobsDays, DEFAULTS.finishedJobsDays) * dayMs).toISOString();

  const txn = db.transaction(() => {
    const c = deleteOldConcurrent.run(concurrentCutoff).changes;
    const r = deleteOldRuleEvents.run(ruleEventsCutoff).changes;
    const j = deleteOldFinishedJobs.run(jobsCutoff).changes;
    return { c, r, j };
  });

  const result = txn();
  setSetting(LAST_RUN_KEY, today);
  Logger.info(
    `[Retention] Pruned ${result.c} concurrent_snapshots, ${result.r} rule_events, ${result.j} finished jobs (cutoff anchor ${nowIso}).`
  );
};
