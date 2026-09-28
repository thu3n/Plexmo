import { db } from "./db";
import { getSetting, setSetting } from "./settings";
import { Logger } from "./logger";
import {
  RETENTION_DEFAULTS,
  RETENTION_LAST_RUN_KEY,
  RETENTION_SETTING_KEYS,
  parseRetentionDays,
} from "./retention-config";

// Daily retention sweep. Called from cron.ts on every 60s tick; gates itself
// on the local date so the actual DELETEs run at most once per day. Windows
// are exposed as settings so they can be tuned without a code change; the
// defaults are conservative (anything user-visible stays, only ops noise is
// pruned).

// Defaults, keys and bounds live in retention-config.ts so the settings API and
// the General settings card share them without importing the DB.
const DEFAULTS = RETENTION_DEFAULTS;
const LAST_RUN_KEY = RETENTION_LAST_RUN_KEY;
export const SETTING_KEYS = RETENTION_SETTING_KEYS;

const todayLocalKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const readWindow = (key: string, defaultDays: number): number => {
  const raw = getSetting(key);
  if (!raw) return defaultDays;
  // Out-of-range values predating API validation fall back to the default.
  const parsed = parseRetentionDays(raw);
  return parsed.ok ? parsed.days : defaultDays;
};

const deleteOldConcurrent = db.prepare(
  "DELETE FROM concurrent_snapshots WHERE timestamp < ?"
);
const deleteOldRuleEvents = db.prepare(
  "DELETE FROM rule_events WHERE triggeredAt < ?"
);
// Non-terminal rows are included deliberately: a job that has not been touched
// in weeks belongs to a process that is long gone, and startup reclamation only
// helps instances that actually restart.
const deleteOldJobs = db.prepare(
  "DELETE FROM jobs WHERE updatedAt < ?"
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
    const j = deleteOldJobs.run(jobsCutoff).changes;
    return { c, r, j };
  });

  const result = txn();
  setSetting(LAST_RUN_KEY, today);
  Logger.info(
    `[Retention] Pruned ${result.c} concurrent_snapshots, ${result.r} rule_events, ${result.j} jobs (cutoff anchor ${nowIso}).`
  );
};
