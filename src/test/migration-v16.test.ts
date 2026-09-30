import { describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, migrateTo } from "./db-helper";
import { LATEST_SCHEMA_VERSION } from "@/lib/migrations";

const serverColumns = (db: Database.Database): string[] =>
    (db.prepare("PRAGMA table_info(servers)").all() as { name: string }[]).map((c) => c.name);

describe("migration v16: server_disabled_flag", () => {
    it("adds servers.disabledAt on a fresh database", () => {
        const db = createTestDb();
        expect(serverColumns(db)).toContain("disabledAt");
        db.close();
    });

    it("upgrades a v15 database, leaving existing servers monitored", () => {
        const db = createTestDb(15);
        expect(serverColumns(db)).not.toContain("disabledAt");
        db.prepare(
            `INSERT INTO servers (id, name, baseUrl, token, createdAt, updatedAt)
             VALUES ('srv-a', 'A', 'http://x', 't', '2026-01-01', '2026-01-01')`
        ).run();

        migrateTo(db);

        const row = db.prepare("SELECT disabledAt FROM servers WHERE id = 'srv-a'").get() as {
            disabledAt: string | null;
        };
        expect(row.disabledAt).toBeNull();
        db.close();
    });

    it("records version 16 as applied", () => {
        const db = createTestDb();
        const row = db
            .prepare("SELECT version FROM schema_migrations WHERE version = 16")
            .get() as { version: number } | undefined;
        expect(row?.version).toBe(16);
        expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(16);
        db.close();
    });
});
