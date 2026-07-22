import { db } from "../db";
import { Logger } from "../logger";

/**
 * Plex reports the server owner as server-local account id "1" in session
 * payloads (/status/sessions and the WebSocket firehose) — never as the
 * owner's plex.tv accountId. Untranslated, every owner play lands under the
 * shared id "1": invisible to stats/history/rules that filter on the real
 * accountId, and colliding across servers (every server's owner is "1").
 * `servers.ownerAccountId` holds the real id, so translation is a lookup.
 */
export const PLEX_LOCAL_OWNER_ID = "1";

const ownerOfServerStmt = db.prepare<[string], { ownerAccountId: string | null }>(
  "SELECT ownerAccountId FROM servers WHERE id = ?"
);

/**
 * Canonicalize a session's account id: the local owner alias becomes the
 * server's real ownerAccountId when known. Every other id passes through.
 */
export const resolveOwnerAlias = (
  serverId: string | undefined,
  userId: string | undefined
): string | undefined => {
  if (userId !== PLEX_LOCAL_OWNER_ID || !serverId) return userId;
  const owner = ownerOfServerStmt.get(serverId)?.ownerAccountId;
  return owner && owner !== PLEX_LOCAL_OWNER_ID ? owner : userId;
};

const latestAliasedUserStmt = db.prepare<[string, string], { user: string }>(
  `SELECT user FROM activity_history
   WHERE serverId = ? AND userId = ? ORDER BY startTime DESC LIMIT 1`
);

const reattributeTableStmts = ["activity_history", "active_sessions", "rule_events"].map((table) =>
  db.prepare(`UPDATE ${table} SET userId = ? WHERE serverId = ? AND userId = ?`)
);

const rebuildOwnerBucketsStmt = db.prepare(`
  INSERT INTO user_activity_summary (accountId, serverId, total_count, total_duration, last_played_at, updated_at)
  SELECT userId, serverId, COUNT(*), SUM(duration), MAX(stopTime), ?
  FROM activity_history WHERE serverId = ? AND userId = ?
  GROUP BY userId, serverId
  ON CONFLICT(accountId, serverId) DO UPDATE SET
    total_count = excluded.total_count,
    total_duration = excluded.total_duration,
    last_played_at = excluded.last_played_at,
    updated_at = excluded.updated_at
`);

/**
 * Re-point rows recorded under the "1" alias to the server's real owner.
 * Called when a server first learns its ownerAccountId (startup backfill,
 * owner login) — rows written before that moment carry the alias. Returns
 * the number of history rows fixed.
 */
export const reattributeOwnerAlias = (serverId: string, ownerAccountId: string): number => {
  if (!ownerAccountId || ownerAccountId === PLEX_LOCAL_OWNER_ID) return 0;

  const run = db.transaction((): number => {
    const aliasedUser = latestAliasedUserStmt.get(serverId, PLEX_LOCAL_OWNER_ID);

    const [historyStmt, ...otherStmts] = reattributeTableStmts;
    const changed = historyStmt.run(ownerAccountId, serverId, PLEX_LOCAL_OWNER_ID).changes;
    for (const stmt of otherStmts) {
      stmt.run(ownerAccountId, serverId, PLEX_LOCAL_OWNER_ID);
    }
    if (changed === 0) return 0;

    // The owner may have no identity row yet (alias rows were their only
    // trace). Name it after the alias rows' user string.
    if (aliasedUser) {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT OR IGNORE INTO user_identities (accountId, username, title, email, thumb, createdAt, updatedAt)
         VALUES (?, ?, ?, NULL, NULL, ?, ?)`
      ).run(ownerAccountId, aliasedUser.user, aliasedUser.user, now, now);
    }

    db.prepare("DELETE FROM user_activity_summary WHERE serverId = ? AND accountId IN (?, ?)").run(
      serverId,
      PLEX_LOCAL_OWNER_ID,
      ownerAccountId
    );
    rebuildOwnerBucketsStmt.run(Date.now(), serverId, ownerAccountId);
    return changed;
  });

  const changed = run();
  if (changed > 0) {
    Logger.info(
      `[Identity] Reattributed ${changed} owner-alias history rows on server ${serverId} to account ${ownerAccountId}.`
    );
  }
  return changed;
};
