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

export const importUsers = (users: PlexUser[]) => {
  const now = new Date().toISOString();
  const transaction = db.transaction((usersToImport: PlexUser[]) => {
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
