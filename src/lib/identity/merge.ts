import { db } from "../db";
import { Logger } from "../logger";

/**
 * Fold one identity into another — used when a synthetic `legacy:<name>`
 * identity turns out to be a real plex.tv account. Rewrites every reference,
 * merges memberships, rebuilds the target's aggregates from history, and
 * deletes the source identity.
 */
export const mergeIdentity = (fromAccountId: string, toAccountId: string): void => {
  if (fromAccountId === toAccountId) return;

  const run = db.transaction(() => {
    db.prepare("UPDATE activity_history SET userId = ? WHERE userId = ?").run(
      toAccountId,
      fromAccountId
    );
    db.prepare("UPDATE active_sessions SET userId = ? WHERE userId = ?").run(
      toAccountId,
      fromAccountId
    );
    db.prepare("UPDATE rule_events SET userId = ? WHERE userId = ?").run(
      toAccountId,
      fromAccountId
    );
    db.prepare("UPDATE OR IGNORE user_rules SET userId = ? WHERE userId = ?").run(
      toAccountId,
      fromAccountId
    );
    db.prepare("DELETE FROM user_rules WHERE userId = ?").run(fromAccountId);
    db.prepare("UPDATE OR IGNORE server_users SET accountId = ? WHERE accountId = ?").run(
      toAccountId,
      fromAccountId
    );
    db.prepare("DELETE FROM server_users WHERE accountId = ?").run(fromAccountId);

    db.prepare("DELETE FROM user_activity_summary WHERE accountId IN (?, ?)").run(
      fromAccountId,
      toAccountId
    );
    db.prepare(
      `INSERT INTO user_activity_summary (accountId, serverId, total_count, total_duration, last_played_at, updated_at)
       SELECT userId, serverId, COUNT(*), SUM(duration), MAX(stopTime), ?
       FROM activity_history WHERE userId = ?
       GROUP BY userId, serverId`
    ).run(Date.now(), toAccountId);

    db.prepare("DELETE FROM user_identities WHERE accountId = ?").run(fromAccountId);
  });

  run();
  Logger.info(`[Identity] Merged ${fromAccountId} into ${toAccountId}.`);
};
