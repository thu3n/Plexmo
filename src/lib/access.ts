import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { AllowedUserRow } from "./db-types";
import { parseServerIds } from "./authz";

/** Public alias for the raw `allowed_users` row shape. */
export type AllowedUser = AllowedUserRow;

/** API shape: serverIds parsed; null = every server (default policy). */
export type AllowedUserView = Omit<AllowedUser, "serverIds"> & { serverIds: string[] | null };

const listStmt = db.prepare<[], AllowedUser>("SELECT * FROM allowed_users ORDER BY datetime(createdAt) DESC");
const insertStmt = db.prepare<AllowedUser>(
    "INSERT INTO allowed_users (id, email, username, createdAt, removeAfterLogin, expiresAt, serverIds) VALUES (@id, @email, @username, @createdAt, @removeAfterLogin, @expiresAt, @serverIds)"
);
const deleteStmt = db.prepare<[string]>("DELETE FROM allowed_users WHERE id = ?");

const cleanupStmt = db.prepare("DELETE FROM allowed_users WHERE expiresAt IS NOT NULL AND expiresAt < ?");

export const toAllowedUserView = (user: AllowedUser): AllowedUserView => ({
    ...user,
    serverIds: parseServerIds(user.serverIds),
});

export const listAllowedUsers = async (): Promise<AllowedUser[]> => {
    cleanupStmt.run(new Date().toISOString());
    return listStmt.all();
};

export const addAllowedUser = async (
    email: string,
    username?: string,
    removeAfterLogin: boolean = true,
    expiresAt: string | null = null,
    serverIds: string[] | null = null,
): Promise<AllowedUser> => {
    const now = new Date().toISOString();
    const newUser: AllowedUser = {
        id: randomUUID(),
        email: email.toLowerCase().trim(),
        username: username || null,
        createdAt: now,
        removeAfterLogin: removeAfterLogin ? 1 : 0,
        expiresAt: expiresAt || null,
        // NULL = all servers (the default equal-access policy); a JSON array
        // opt-in scopes this viewer to those servers only.
        serverIds: serverIds && serverIds.length > 0 ? JSON.stringify(serverIds) : null,
    };

    insertStmt.run(newUser);
    return newUser;
};

/**
 * Remove a whitelist entry. Takes effect immediately for open sessions too:
 * the request guard re-resolves every viewer against this table.
 * Returns false when no such entry existed.
 */
export const removeAllowedUser = (id: string): boolean => deleteStmt.run(id).changes > 0;
