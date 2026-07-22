import { db } from "../db";
import type { ServerUserRow, UserRow } from "../db-types";

const upsertMembershipStmt = db.prepare(`
  INSERT INTO server_users (serverId, accountId, username, title, thumb, isAdmin, importedAt)
  VALUES (@serverId, @accountId, @username, @title, @thumb, @isAdmin, @importedAt)
  ON CONFLICT(serverId, accountId) DO UPDATE SET
    username = excluded.username,
    title = excluded.title,
    thumb = excluded.thumb,
    isAdmin = excluded.isAdmin,
    importedAt = excluded.importedAt
`);

export const upsertMembership = (membership: {
  serverId: string;
  accountId: string;
  username?: string | null;
  title?: string | null;
  thumb?: string | null;
  isAdmin?: boolean;
  importedAt?: string;
}): void => {
  upsertMembershipStmt.run({
    serverId: membership.serverId,
    accountId: membership.accountId,
    username: membership.username ?? null,
    title: membership.title ?? null,
    thumb: membership.thumb ?? null,
    isAdmin: membership.isAdmin ? 1 : 0,
    importedAt: membership.importedAt ?? new Date().toISOString(),
  });
};

export const getMemberships = (accountId: string): ServerUserRow[] =>
  db
    .prepare<[string], ServerUserRow>("SELECT * FROM server_users WHERE accountId = ?")
    .all(accountId);

/** True if the account is flagged admin on at least one server. */
export const isAdminAnywhere = (accountId: string): boolean => {
  const row = db
    .prepare<[string], { isAdmin: number }>(
      "SELECT MAX(isAdmin) as isAdmin FROM server_users WHERE accountId = ?"
    )
    .get(accountId);
  return (row?.isAdmin ?? 0) === 1;
};

/**
 * Legacy-shaped listing: one row per (identity, server membership), matching
 * what the v1 `users` table used to return. Per-server username/title win over
 * the identity's (managed users can differ per server).
 */
const membershipRowsSql = `
  SELECT
    ui.accountId as id,
    COALESCE(su.title, ui.title) as title,
    COALESCE(su.username, ui.username) as username,
    ui.email as email,
    COALESCE(su.thumb, ui.thumb) as thumb,
    su.serverId as serverId,
    su.importedAt as importedAt,
    su.isAdmin as isAdmin
  FROM server_users su
  JOIN user_identities ui ON ui.accountId = su.accountId
`;

export const listMembershipRows = (): UserRow[] =>
  db.prepare<[], UserRow>(`${membershipRowsSql} ORDER BY username ASC`).all();

export const getMembershipRowsByUsername = (username: string): UserRow[] =>
  db
    .prepare<[string, string], UserRow>(
      `${membershipRowsSql}
       WHERE COALESCE(su.username, ui.username) = ? COLLATE NOCASE
          OR COALESCE(su.title, ui.title) = ? COLLATE NOCASE`
    )
    .all(username, username);

export const getMembershipRowsByAccountId = (accountId: string): UserRow[] =>
  db.prepare<[string], UserRow>(`${membershipRowsSql} WHERE ui.accountId = ?`).all(accountId);
