
import { db } from "./db";
import type { PlexUser } from "./plex";
import type { UserRow } from "./db-types";

/** Public alias for the raw `users` row shape. */
export type DbUser = UserRow;

const insertUserStmt = db.prepare<DbUser>(`
  INSERT INTO users (id, title, username, email, thumb, serverId, importedAt, isAdmin)
  VALUES (@id, @title, @username, @email, @thumb, @serverId, @importedAt, @isAdmin)
  ON CONFLICT(id, serverId) DO UPDATE SET
    title=excluded.title,
    username=excluded.username,
    email=excluded.email,
    thumb=excluded.thumb,
    importedAt=excluded.importedAt,
    isAdmin=excluded.isAdmin
`);

const listUsersStmt = db.prepare<[], DbUser>("SELECT * FROM users ORDER BY username ASC");

export const importUsers = (users: PlexUser[]) => {
    const now = new Date().toISOString();
    const transaction = db.transaction((usersToImport: PlexUser[]) => {
        for (const user of usersToImport) {
            insertUserStmt.run({
                id: user.id,
                title: user.title || user.username,
                username: user.username,
                email: user.email || null,
                thumb: user.thumb || null,
                serverId: user.serverId, // Using stable server ID now
                importedAt: now,
                isAdmin: user.isAdmin ? 1 : 0,
            });
        }
    });

    transaction(users);
};

export const listLocalUsers = (): DbUser[] => {
    return listUsersStmt.all();
};

/** All user records matching a username (a username can exist across servers). */
export const getUsersByUsername = (username: string): DbUser[] => {
    return db.prepare<[string], DbUser>("SELECT * FROM users WHERE username = ?").all(username);
};

export const getUserById = (id: string): DbUser | undefined => {
    return db.prepare<[string], DbUser>("SELECT * FROM users WHERE id = ?").get(id);
};

/**
 * Create a placeholder ("ghost") user discovered during history import, when no
 * matching user exists yet. INSERT OR IGNORE so a concurrent/duplicate insert is
 * a no-op. Marked non-admin with no email.
 */
export const createGhostUser = (params: { id: string; title: string; username: string; serverId: string }): void => {
    db.prepare(`
        INSERT OR IGNORE INTO users (id, title, username, email, thumb, serverId, importedAt, isAdmin)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
        params.id,
        params.title,
        params.username,
        null,
        "",
        params.serverId,
        new Date().toISOString()
    );
};
