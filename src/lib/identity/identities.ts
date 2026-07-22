import { db } from "../db";
import type { UserIdentityRow } from "../db-types";

export type UserIdentity = UserIdentityRow;

const upsertIdentityStmt = db.prepare(`
  INSERT INTO user_identities (accountId, username, title, email, thumb, createdAt, updatedAt)
  VALUES (@accountId, @username, @title, @email, @thumb, @now, @now)
  ON CONFLICT(accountId) DO UPDATE SET
    username = excluded.username,
    title = excluded.title,
    email = COALESCE(excluded.email, email),
    thumb = COALESCE(excluded.thumb, thumb),
    updatedAt = excluded.updatedAt
`);

const getIdentityStmt = db.prepare<[string], UserIdentityRow>(
  "SELECT * FROM user_identities WHERE accountId = ?"
);

const findByNameStmt = db.prepare<[string, string], UserIdentityRow>(
  `SELECT * FROM user_identities
   WHERE username = ? COLLATE NOCASE OR title = ? COLLATE NOCASE
   LIMIT 1`
);

export const upsertIdentity = (identity: {
  accountId: string;
  username: string;
  title: string;
  email?: string | null;
  thumb?: string | null;
}): void => {
  upsertIdentityStmt.run({
    accountId: identity.accountId,
    username: identity.username,
    title: identity.title,
    email: identity.email ?? null,
    thumb: identity.thumb ?? null,
    now: new Date().toISOString(),
  });
};

export const getIdentity = (accountId: string): UserIdentity | undefined =>
  getIdentityStmt.get(accountId);

/** Resolve a username or display title (case-insensitive) to an identity. */
export const findIdentityByName = (name: string): UserIdentity | undefined =>
  findByNameStmt.get(name, name);

/**
 * Canonical accountId for a history/session write. Uses the provided plex.tv
 * id when present; otherwise resolves by name; otherwise mints a synthetic
 * `legacy:<name>` identity so the "userId is always a valid accountId"
 * invariant holds even for sessions where Plex omits User.id.
 */
export const ensureAccountId = (user: string, accountId?: string | null): string => {
  if (accountId) {
    if (!getIdentityStmt.get(accountId)) {
      upsertIdentity({ accountId, username: user, title: user });
    }
    return accountId;
  }
  const match = findByNameStmt.get(user, user);
  if (match) return match.accountId;

  const legacyId = `legacy:${user.toLowerCase()}`;
  db.prepare(
    `INSERT OR IGNORE INTO user_identities (accountId, username, title, email, thumb, createdAt, updatedAt)
     VALUES (?, ?, ?, NULL, NULL, ?, ?)`
  ).run(legacyId, user, user, new Date().toISOString(), new Date().toISOString());
  return legacyId;
};
