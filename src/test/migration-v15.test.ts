import { describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, migrateTo } from "./db-helper";
import { LATEST_SCHEMA_VERSION } from "@/lib/migrations";

const hasIndex = (db: Database.Database): boolean =>
    db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_history_start_user'")
        .get() !== undefined;

describe("migration v15: history_start_user_index", () => {
    it("creates the index on a fresh database", () => {
        const db = createTestDb();
        expect(hasIndex(db)).toBe(true);
        db.close();
    });

    it("adds the index when upgrading from v14", () => {
        const db = createTestDb(14);
        expect(hasIndex(db)).toBe(false);
        migrateTo(db);
        expect(hasIndex(db)).toBe(true);
        db.close();
    });

    it("records version 15 as the latest applied migration", () => {
        const db = createTestDb();
        const row = db
            .prepare("SELECT MAX(version) as version FROM schema_migrations")
            .get() as { version: number };
        expect(row.version).toBe(15);
        expect(LATEST_SCHEMA_VERSION).toBe(15);
        db.close();
    });
});
