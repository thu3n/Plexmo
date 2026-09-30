import { describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, migrateTo } from "./db-helper";
import { LATEST_SCHEMA_VERSION } from "@/lib/migrations";

const tableExists = (db: Database.Database, name: string): boolean =>
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined;

describe("migration v18: library_item_genres", () => {
    it("creates library_item_genres on a fresh database", () => {
        const db = createTestDb();
        const columns = (db.prepare("PRAGMA table_info(library_item_genres)").all() as { name: string }[])
            .map((c) => c.name);
        expect(columns).toEqual(["serverId", "ratingKey", "genre"]);
        db.close();
    });

    it("upgrades a v17 database without touching existing library rows", () => {
        const db = createTestDb(17);
        expect(tableExists(db, "library_item_genres")).toBe(false);
        db.prepare(
            `INSERT INTO library_items (serverId, ratingKey, sectionKey, type, title, syncedAt)
             VALUES ('srv-a', '1', '1', 'movie', 'Heat', 0)`
        ).run();

        migrateTo(db, 18);

        expect(tableExists(db, "library_item_genres")).toBe(true);
        expect((db.prepare("SELECT COUNT(*) AS n FROM library_items").get() as { n: number }).n).toBe(1);
        db.close();
    });

    it("keys genres per (server, item, genre) — duplicates are rejected", () => {
        const db = createTestDb();
        const insert = db.prepare("INSERT INTO library_item_genres (serverId, ratingKey, genre) VALUES (?, ?, ?)");
        insert.run("srv-a", "1", "Drama");
        insert.run("srv-b", "1", "Drama");
        expect(() => insert.run("srv-a", "1", "Drama")).toThrow();
        db.close();
    });

    it("is recorded in schema_migrations", () => {
        const db = createTestDb();
        const row = db.prepare("SELECT name FROM schema_migrations WHERE version = 18").get() as { name: string };
        expect(row.name).toBe("library_item_genres");
        expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(18);
        db.close();
    });
});
