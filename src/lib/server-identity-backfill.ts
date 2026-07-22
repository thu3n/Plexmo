import { db } from "./db";
import { Logger } from "./logger";
import { fetchMachineIdentifier } from "./servers";
import { parser } from "./plex/plex-client";
import { reattributeOwnerAlias } from "./identity";
import type { ServerRow } from "./db-types";

/**
 * Async backfill for the server natural key and owner cache. Runs at startup
 * and after server create/update — migrations are synchronous and cannot do
 * network I/O, so machineIdentifier/ownerAccountId start as NULL and are
 * filled here. Idempotent and safe to run repeatedly.
 */
export async function backfillServerIdentities(): Promise<void> {
  const pending = db
    .prepare<[], ServerRow>(
      `SELECT * FROM servers
       WHERE archivedAt IS NULL AND (machineIdentifier IS NULL OR ownerAccountId IS NULL)`
    )
    .all();

  for (const server of pending) {
    if (!server.machineIdentifier) {
      const machineIdentifier = await fetchMachineIdentifier(server);
      if (machineIdentifier) {
        const duplicate = db
          .prepare<[string, string], ServerRow>(
            "SELECT * FROM servers WHERE machineIdentifier = ? AND id != ?"
          )
          .get(machineIdentifier, server.id);

        if (duplicate) {
          mergeDuplicateServer(server, duplicate);
          continue;
        }

        db.prepare("UPDATE servers SET machineIdentifier = ? WHERE id = ?").run(
          machineIdentifier,
          server.id
        );
        Logger.info(`[Servers] Backfilled machineIdentifier for ${server.name}.`);
      }
    }

    if (!server.ownerAccountId) {
      const ownerAccountId = await fetchOwnerAccountId(server.token);
      if (ownerAccountId) {
        db.prepare("UPDATE servers SET ownerAccountId = ? WHERE id = ?").run(
          ownerAccountId,
          server.id
        );
        Logger.info(`[Servers] Cached owner account for ${server.name}.`);
        // Rows recorded before the owner id was known carry the "1" alias.
        reattributeOwnerAlias(server.id, ownerAccountId);
      }
    }
  }
}

/** The plex.tv account id behind a server token (the owner). */
export async function fetchOwnerAccountId(token: string): Promise<string | null> {
  try {
    const res = await fetch(`https://plex.tv/users/account?X-Plex-Token=${token}`, {
      headers: { Accept: "application/xml" },
    });
    if (!res.ok) return null;
    const xml = parser.parse(await res.text());
    const userTag = xml.user || xml.User;
    return userTag?.id ? String(userTag.id) : null;
  } catch (e) {
    Logger.error("[Servers] Could not fetch owner account:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Two rows point at the same physical Plex server (added twice pre-v2).
 * Re-point the newer row's data at the older one and archive the newer row.
 */
function mergeDuplicateServer(server: ServerRow, duplicate: ServerRow): void {
  const older = server.createdAt <= duplicate.createdAt ? server : duplicate;
  const newer = older.id === server.id ? duplicate : server;

  Logger.error(
    `[Servers] "${server.name}" and "${duplicate.name}" are the SAME physical Plex server. ` +
      `Merging data into "${older.name}" (${older.id}) and archiving the duplicate.`
  );

  db.transaction(() => {
    db.prepare("UPDATE activity_history SET serverId = ? WHERE serverId = ?").run(older.id, newer.id);
    db.prepare("DELETE FROM active_sessions WHERE serverId = ?").run(newer.id);
    db.prepare("UPDATE OR IGNORE server_users SET serverId = ? WHERE serverId = ?").run(older.id, newer.id);
    db.prepare("DELETE FROM server_users WHERE serverId = ?").run(newer.id);
    db.prepare("UPDATE OR IGNORE server_rules SET serverId = ? WHERE serverId = ?").run(older.id, newer.id);
    db.prepare("DELETE FROM server_rules WHERE serverId = ?").run(newer.id);
    db.prepare("UPDATE OR IGNORE media_sources SET serverId = ? WHERE serverId = ?").run(older.id, newer.id);
    db.prepare("DELETE FROM media_sources WHERE serverId = ?").run(newer.id);
    db.prepare("UPDATE rule_events SET serverId = ? WHERE serverId = ?").run(older.id, newer.id);

    // Aggregates are rebuilt for the merged server rather than summed blindly.
    db.prepare("DELETE FROM user_activity_summary WHERE serverId IN (?, ?)").run(older.id, newer.id);
    db.prepare(
      `INSERT INTO user_activity_summary (accountId, serverId, total_count, total_duration, last_played_at, updated_at)
       SELECT userId, serverId, COUNT(*), SUM(duration), MAX(stopTime), ?
       FROM activity_history WHERE serverId = ?
       GROUP BY userId, serverId`
    ).run(Date.now(), older.id);

    db.prepare("UPDATE servers SET archivedAt = ? WHERE id = ?").run(new Date().toISOString(), newer.id);
  })();
}
