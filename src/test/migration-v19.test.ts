import { describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, migrateTo } from "./db-helper";
import { LATEST_SCHEMA_VERSION } from "@/lib/migrations";

const tableExists = (db: Database.Database, name: string): boolean =>
    !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);

const insert = (db: Database.Database, severity: string) =>
    db.prepare(
        `INSERT INTO stat_anomalies (kind, serverId, severity, observed, firstDetectedAt, lastSeenAt)
         VALUES ('plays_drop', 'srv-a', ?, 1, 1, 1)`
    ).run(severity);

describe("migration v19: stat_anomalies", () => {
    it("creates the table on a fresh database", () => {
        const db = createTestDb();
        expect(tableExists(db, "stat_anomalies")).toBe(true);
        db.close();
    });

    it("upgrades a v18 database", () => {
        const db = createTestDb(18);
        expect(tableExists(db, "stat_anomalies")).toBe(false);
        migrateTo(db, 19);
        expect(tableExists(db, "stat_anomalies")).toBe(true);
        const applied = db.prepare("SELECT 1 FROM schema_migrations WHERE version = 19").get();
        expect(applied).toBeTruthy();
        expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(19);
        db.close();
    });

    it("defaults subject to '' and rejects unknown severities", () => {
        const db = createTestDb();
        insert(db, "warning");
        const row = db.prepare("SELECT subject, notifiedAt FROM stat_anomalies").get() as {
            subject: string;
            notifiedAt: number | null;
        };
        expect(row).toEqual({ subject: "", notifiedAt: null });
        expect(() => insert(db, "panic")).toThrow();
        db.close();
    });
});
