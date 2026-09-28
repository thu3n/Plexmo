import { db } from "./db";
import type { PlexUser } from "./plex";
import type { UserRow } from "./db-types";
import {
  upsertIdentity,
  upsertMembership,
  listMembershipRows,
  getMembershipRowsByUsername,
  getMembershipRowsByAccountId,
} from "./identity";

/**
 * Compatibility shim over src/lib/identity/. The v1 `users` table is gone;
 * these functions keep the old one-row-per-(user, server) API shape by joining
 * user_identities with server_users. New code should import from
 * "@/lib/identity" directly.
 */

/** Public alias for the legacy joined (identity x membership) row shape. */
export type DbUser = UserRow;

/** The subset of a Plex user an import actually persists. */
export type ImportableUser = Pick<PlexUser, "id" | "title" | "username" | "email" | "thumb" | "serverId" | "isAdmin">;

export const importUsers = (users: ImportableUser[]) => {
  const now = new Date().toISOString();
  const transaction = db.transaction((usersToImport: ImportableUser[]) => {
    for (const user of usersToImport) {
      upsertIdentity({
        accountId: user.id,
        username: user.username,
        title: user.title || user.username,
        email: user.email || null,
        thumb: user.thumb || null,
      });
      upsertMembership({
        serverId: user.serverId,
        accountId: user.id,
        username: user.username,
        title: user.title || user.username,
        thumb: user.thumb || null,
        isAdmin: Boolean(user.isAdmin),
        importedAt: now,
      });
    }
  });

  transaction(users);
};

export const listLocalUsers = (): DbUser[] => {
  return listMembershipRows();
};

/** All membership rows matching a username (a username can exist across servers). */
export const getUsersByUsername = (username: string): DbUser[] => {
  return getMembershipRowsByUsername(username);
};

export const getUserById = (id: string): DbUser | undefined => {
  return getMembershipRowsByAccountId(id)[0];
};

/**
 * Create a placeholder ("ghost") identity + membership discovered during
 * history import, when no matching user exists yet. Idempotent upserts, so a
 * concurrent/duplicate insert is a no-op. Marked non-admin with no email.
 */
export const createGhostUser = (params: {
  id: string;
  title: string;
  username: string;
  serverId: string;
}): void => {
  upsertIdentity({
    accountId: params.id,
    username: params.username,
    title: params.title,
  });
  upsertMembership({
    serverId: params.serverId,
    accountId: params.id,
    username: params.username,
    title: params.title,
    isAdmin: false,
  });
};

/** Membership row enriched with that (account, server) bucket's activity totals. */
export interface DirectoryUserDbRow extends UserRow {
  plays: number;
  /** Seconds — wallclock-built, same caveat as user_stats all-time totals. */
  watchSeconds: number;
  /** Epoch ms of the latest play on this server, null if never played. */
  lastPlayedAt: number | null;
}

/**
 * Directory listing with activity folded in. Reads the materialized
 * user_activity_summary (PK accountId+serverId, so the join is an index
 * lookup per membership) instead of scanning activity_history. Totals stay
 * per server so the client can re-aggregate under its server filter.
 */
export const listDirectoryUsers = (allowedServerIds?: string[]): DirectoryUserDbRow[] => {
  const scopeIds = allowedServerIds ?? [];
  const scopeSql = scopeIds.length > 0
    ? `WHERE su.serverId IN (${scopeIds.map(() => "?").join(",")})`
    : "";
  return db
    .prepare<string[], DirectoryUserDbRow>(
      `SELECT
         ui.accountId as id,
         COALESCE(su.title, ui.title) as title,
         COALESCE(su.username, ui.username) as username,
         ui.email as email,
         COALESCE(su.thumb, ui.thumb) as thumb,
         su.serverId as serverId,
         su.importedAt as importedAt,
         su.isAdmin as isAdmin,
         COALESCE(uas.total_count, 0) as plays,
         COALESCE(uas.total_duration, 0) as watchSeconds,
         uas.last_played_at as lastPlayedAt
       FROM server_users su
       JOIN user_identities ui ON ui.accountId = su.accountId
       LEFT JOIN user_activity_summary uas
         ON uas.accountId = su.accountId AND uas.serverId = su.serverId
       ${scopeSql}
       ORDER BY username ASC`
    )
    .all(...scopeIds);
};
