
import { db } from "./db";
import type { PlexUser } from "./plex";

export type DbUser = {
    id: string;
    title: string;
    username: string;
    email: string | null;
    thumb: string | null;
    serverId: string;
    importedAt: string;
    isAdmin: number;
};

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
