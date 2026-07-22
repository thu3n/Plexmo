import { describe, it, expect } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "./db-helper";

const insertInvite = (db: Database.Database, overrides: Partial<Record<string, string>> = {}) =>
    db.prepare(
        `INSERT INTO invite_links (id, tokenHash, type, createdByAccountId, createdAt, expiresAt)
         VALUES (@id, @tokenHash, @type, @createdByAccountId, @createdAt, @expiresAt)`
    ).run({
        id: overrides.id ?? "inv-1",
        tokenHash: overrides.tokenHash ?? "hash-1",
        type: overrides.type ?? "onboarding",
        createdByAccountId: "100",
        createdAt: "2026-07-17T00:00:00Z",
        expiresAt: "2026-07-24T00:00:00Z",
    });

describe("migration v14: invite_links", () => {
    it("creates the table on a fresh database and accepts both types", () => {
        const db = createTestDb();
        insertInvite(db, { id: "a", tokenHash: "h1", type: "onboarding" });
        insertInvite(db, { id: "b", tokenHash: "h2", type: "access" });
        expect(
            (db.prepare("SELECT COUNT(*) as count FROM invite_links").get() as { count: number }).count
        ).toBe(2);
        db.close();
    });

    it("rejects unknown invite types via the CHECK constraint", () => {
        const db = createTestDb();
        expect(() => insertInvite(db, { type: "admin" })).toThrow(/CHECK/);
        db.close();
    });

    it("enforces UNIQUE tokenHash", () => {
        const db = createTestDb();
        insertInvite(db, { id: "a", tokenHash: "same" });
        expect(() => insertInvite(db, { id: "b", tokenHash: "same" })).toThrow(/UNIQUE/);
        db.close();
    });
});
