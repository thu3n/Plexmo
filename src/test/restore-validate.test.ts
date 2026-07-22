// @vitest-environment node
// adm-zip's buffer handling breaks under the default jsdom environment.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import AdmZip from "adm-zip";
import { runMigrations, LATEST_SCHEMA_VERSION } from "@/lib/migrations";
import { createBackupZip, BACKUP_DB_ENTRY, BACKUP_MANIFEST_ENTRY } from "@/lib/backup/backup-bundle";
import { validateAndStage } from "@/lib/backup/restore-validate";
import { PENDING_DIR_NAME, READY_MARKER } from "@/lib/backup/restore-swap";

let sourceDir: string;
let targetDir: string;

const buildBackup = (targetVersion?: number): Buffer => {
    const db = new Database(path.join(sourceDir, `src-${Date.now()}-${Math.floor(Math.random() * 1e6)}.db`));
    runMigrations(db, targetVersion);
    const buffer = createBackupZip(db, sourceDir, "1.0.0");
    db.close();
    return buffer;
};

const pendingPath = (...parts: string[]) => path.join(targetDir, PENDING_DIR_NAME, ...parts);

beforeEach(() => {
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), "plexmo-rv-src-"));
    targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "plexmo-rv-dst-"));
});

afterEach(() => {
    fs.rmSync(sourceDir, { recursive: true, force: true });
    fs.rmSync(targetDir, { recursive: true, force: true });
});

describe("validateAndStage", () => {
    it("accepts a valid backup and commits the READY marker last", () => {
        const result = validateAndStage(buildBackup(), targetDir);
        expect(result).toEqual({ ok: true });
        expect(fs.existsSync(pendingPath(BACKUP_DB_ENTRY))).toBe(true);
        expect(fs.existsSync(pendingPath(READY_MARKER))).toBe(true);
        // Temp extraction dirs are cleaned.
        expect(fs.readdirSync(targetDir).filter((f) => f.startsWith("restore-tmp-"))).toHaveLength(0);
    });

    it("accepts an OLDER-schema backup (migrations run at next boot)", () => {
        expect(validateAndStage(buildBackup(10), targetDir)).toEqual({ ok: true });
    });

    it("rejects garbage that is not a zip", () => {
        const result = validateAndStage(Buffer.from("definitely not a zip"), targetDir);
        expect(result.ok).toBe(false);
        expect(fs.existsSync(pendingPath())).toBe(false);
    });

    it("rejects a zip without the Plexmo entries", () => {
        const zip = new AdmZip();
        zip.addFile("random.txt", Buffer.from("hi"));
        const result = validateAndStage(zip.toBuffer(), targetDir);
        expect(result).toMatchObject({ ok: false });
    });

    it("rejects a backup from a NEWER Plexmo with an explicit message", () => {
        const original = new AdmZip(buildBackup());
        const manifest = JSON.parse(original.getEntry(BACKUP_MANIFEST_ENTRY)!.getData().toString());
        manifest.schemaVersion = LATEST_SCHEMA_VERSION + 1;
        const tampered = new AdmZip();
        tampered.addFile(BACKUP_DB_ENTRY, original.getEntry(BACKUP_DB_ENTRY)!.getData());
        tampered.addFile(BACKUP_MANIFEST_ENTRY, Buffer.from(JSON.stringify(manifest)));

        const result = validateAndStage(tampered.toBuffer(), targetDir);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain("newer Plexmo");
        expect(fs.existsSync(pendingPath(READY_MARKER))).toBe(false);
    });

    it("rejects a corrupted database and leaves no READY marker", () => {
        const original = new AdmZip(buildBackup());
        const dbBytes = original.getEntry(BACKUP_DB_ENTRY)!.getData();
        // Corrupt a chunk in the middle of the file.
        for (let i = 4096; i < 4160 && i < dbBytes.length; i++) dbBytes[i] = 0xff;
        const tampered = new AdmZip();
        tampered.addFile(BACKUP_DB_ENTRY, dbBytes);
        tampered.addFile(BACKUP_MANIFEST_ENTRY, original.getEntry(BACKUP_MANIFEST_ENTRY)!.getData());

        const result = validateAndStage(tampered.toBuffer(), targetDir);
        expect(result.ok).toBe(false);
        expect(fs.existsSync(pendingPath(READY_MARKER))).toBe(false);
    });
});
