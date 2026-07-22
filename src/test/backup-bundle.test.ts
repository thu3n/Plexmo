// @vitest-environment node
// adm-zip's buffer handling breaks under the default jsdom environment.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import AdmZip from "adm-zip";
import { runMigrations, LATEST_SCHEMA_VERSION } from "@/lib/migrations";
import {
    createBackupZip,
    getCurrentSchemaVersion,
    BACKUP_DB_ENTRY,
    BACKUP_MANIFEST_ENTRY,
    BACKUP_SECRET_ENTRY,
    type BackupManifest,
} from "@/lib/backup/backup-bundle";

let tempDir: string;
let db: Database.Database;

beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plexmo-backup-"));
    db = new Database(path.join(tempDir, "source.db"));
    runMigrations(db);
});

afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("createBackupZip", () => {
    it("bundles a consistent db snapshot + manifest, round-trips with integrity ok", () => {
        db.prepare(
            "INSERT INTO servers (id, name, baseUrl, token, createdAt, updatedAt) VALUES ('s1', 'Alpha', 'http://a', 'tok', '2026-01-01', '2026-01-01')"
        ).run();

        const buffer = createBackupZip(db, tempDir, "1.0.0");
        const zip = new AdmZip(buffer);

        const manifest = JSON.parse(zip.getEntry(BACKUP_MANIFEST_ENTRY)!.getData().toString()) as BackupManifest;
        expect(manifest).toMatchObject({ format: 1, appVersion: "1.0.0", schemaVersion: LATEST_SCHEMA_VERSION });
        expect(manifest.dbSizeBytes).toBeGreaterThan(0);

        // Round-trip: the snapshot opens cleanly and carries the data.
        const restoredPath = path.join(tempDir, "restored.db");
        fs.writeFileSync(restoredPath, zip.getEntry(BACKUP_DB_ENTRY)!.getData());
        const restored = new Database(restoredPath, { readonly: true });
        expect(restored.pragma("integrity_check", { simple: true })).toBe("ok");
        expect(
            (restored.prepare("SELECT COUNT(*) as c FROM servers").get() as { c: number }).c
        ).toBe(1);
        expect(getCurrentSchemaVersion(restored)).toBe(LATEST_SCHEMA_VERSION);
        restored.close();

        // No jwt-secret in the config dir -> no secret entry, and no temp leftovers.
        expect(zip.getEntry(BACKUP_SECRET_ENTRY)).toBeNull();
        expect(fs.readdirSync(tempDir).filter((f) => f.startsWith("backup-tmp-"))).toHaveLength(0);
    });

    it("includes the .jwt-secret file when present", () => {
        fs.writeFileSync(path.join(tempDir, ".jwt-secret"), "super-secret");
        const zip = new AdmZip(createBackupZip(db, tempDir, "1.0.0"));
        expect(zip.getEntry(BACKUP_SECRET_ENTRY)!.getData().toString()).toBe("super-secret");
    });
});
