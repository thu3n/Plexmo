import { db } from "./db";
import { Logger } from "./logger";

/**
 * Hard-delete a server and EVERY row that references it. This is the
 * destructive counterpart to the soft archive in servers.ts — the single
 * place that knows the full cascade, so no table is ever missed.
 */
export const purgeServerData = db.transaction((serverId: string) => {
  db.prepare("DELETE FROM activity_history WHERE serverId = ?").run(serverId);
  db.prepare("DELETE FROM active_sessions WHERE serverId = ?").run(serverId);
  db.prepare("DELETE FROM server_users WHERE serverId = ?").run(serverId);
  db.prepare("DELETE FROM server_rules WHERE serverId = ?").run(serverId);
  db.prepare("DELETE FROM media_sources WHERE serverId = ?").run(serverId);
  db.prepare("DELETE FROM rule_events WHERE serverId = ?").run(serverId);
  db.prepare("DELETE FROM user_activity_summary WHERE serverId = ?").run(serverId);
  db.prepare("DELETE FROM concurrent_snapshots WHERE serverId = ?").run(serverId);
  // The 'global' peak row survives on purpose — it is a deployment-level
  // historical fact, not a property of any one server.
  db.prepare("DELETE FROM stream_peaks WHERE scope = ?").run(serverId);
  db.prepare("DELETE FROM servers WHERE id = ?").run(serverId);

  // Identities that only existed on this server would otherwise linger with
  // no memberships and no history.
  db.prepare(
    `DELETE FROM user_identities
     WHERE NOT EXISTS (SELECT 1 FROM server_users su WHERE su.accountId = user_identities.accountId)
       AND NOT EXISTS (SELECT 1 FROM activity_history h WHERE h.userId = user_identities.accountId)`
  ).run();

  Logger.info(`[Servers] Purged all data for server ${serverId}.`);
});
