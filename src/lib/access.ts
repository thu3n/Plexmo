import { randomUUID } from "node:crypto";
import { db } from "./db";

export type AllowedUser = {
    id: string;
    email: string;
    username: string | null;
    createdAt: string;
    removeAfterLogin: number; // 0 or 1
    expiresAt: string | null;
};

const listStmt = db.prepare<[], AllowedUser>("SELECT * FROM allowed_users ORDER BY datetime(createdAt) DESC");
const insertStmt = db.prepare<
    { id: string; email: string; username: string | null; createdAt: string; removeAfterLogin: number; expiresAt: string | null }
>("INSERT INTO allowed_users (id, email, username, createdAt, removeAfterLogin, expiresAt) VALUES (@id, @email, @username, @createdAt, @removeAfterLogin, @expiresAt)");
const deleteStmt = db.prepare<[string]>("DELETE FROM allowed_users WHERE id = ?");

const cleanupStmt = db.prepare("DELETE FROM allowed_users WHERE expiresAt IS NOT NULL AND expiresAt < ?");

export const listAllowedUsers = async (): Promise<AllowedUser[]> => {
    cleanupStmt.run(new Date().toISOString());
    return listStmt.all();
};

export const addAllowedUser = async (email: string, username?: string, removeAfterLogin: boolean = true, expiresAt: string | null = null): Promise<AllowedUser> => {
    const now = new Date().toISOString();
    const newUser = {
        id: randomUUID(),
        email: email.toLowerCase().trim(),
        username: username || null,
        createdAt: now,
        removeAfterLogin: removeAfterLogin ? 1 : 0,
        expiresAt: expiresAt || null,
    };

    insertStmt.run(newUser);
    return newUser;
};

export const removeAllowedUser = async (id: string): Promise<void> => {
    deleteStmt.run(id);
};
