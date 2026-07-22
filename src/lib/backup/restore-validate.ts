import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import Database from "better-sqlite3";
import { LATEST_SCHEMA_VERSION } from "@/lib/migrations";
import {
    BACKUP_DB_ENTRY,
    BACKUP_MANIFEST_ENTRY,
    BACKUP_SECRET_ENTRY,
    BACKUP_FORMAT_VERSION,
    type BackupManifest,
} from "./backup-bundle";
import { PENDING_DIR_NAME, READY_MARKER } from "./restore-swap";

export type ValidateResult = { ok: true } | { ok: false; error: string };

/**
 * Validate an uploaded backup zip and stage it for the boot-time swap.
 * Order matters for crash-safety: everything is written to restore-pending/
 * FIRST, and only then is the READY marker created via write→fsync→atomic
 * rename — a boot that finds the dir without the marker deletes it as
 * garbage. Rejects newer-schema backups (from a newer Plexmo) explicitly;
 * older ones are fine, migrations run at next boot.
 */
export function validateAndStage(zipBuffer: Buffer, configDir: string): ValidateResult {
    let zip: AdmZip;
    try {
        zip = new AdmZip(zipBuffer);
    } catch {
        return { ok: false, error: "The uploaded file is not a valid backup zip." };
    }

    const manifestEntry = zip.getEntry(BACKUP_MANIFEST_ENTRY);
    const dbEntry = zip.getEntry(BACKUP_DB_ENTRY);
    if (!manifestEntry || !dbEntry) {
        return { ok: false, error: "The zip is missing manifest.json or plexmo.db - not a Plexmo backup." };
    }

    let manifest: BackupManifest;
    try {
        manifest = JSON.parse(manifestEntry.getData().toString("utf-8"));
    } catch {
        return { ok: false, error: "The backup manifest is unreadable." };
    }
    if (manifest.format !== BACKUP_FORMAT_VERSION) {
        return { ok: false, error: `Unknown backup format ${manifest.format}.` };
    }
    if (typeof manifest.schemaVersion !== "number" || manifest.schemaVersion > LATEST_SCHEMA_VERSION) {
        return {
            ok: false,
            error: "This backup was made by a newer Plexmo version - upgrade this instance first, then restore.",
        };
    }

    // Integrity-check the staged DB before committing anything.
    const tempDir = path.join(configDir, `restore-tmp-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    try {
        const tempDb = path.join(tempDir, BACKUP_DB_ENTRY);
        fs.writeFileSync(tempDb, dbEntry.getData());

        try {
            const staged = new Database(tempDb, { readonly: true, fileMustExist: true });
            try {
                const integrity = staged.pragma("integrity_check", { simple: true });
                if (integrity !== "ok") {
                    return { ok: false, error: "The backup database failed its integrity check." };
                }
                const tables = staged
                    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('servers', 'schema_migrations')")
                    .all() as { name: string }[];
                if (tables.length < 2) {
                    return { ok: false, error: "The backup database does not look like a Plexmo database." };
                }
            } finally {
                staged.close();
            }
        } catch {
            return { ok: false, error: "The backup database could not be opened." };
        }

        // Stage: files first, READY marker last (atomic rename = commit point).
        const pendingDir = path.join(configDir, PENDING_DIR_NAME);
        fs.rmSync(pendingDir, { recursive: true, force: true });
        fs.mkdirSync(pendingDir, { recursive: true });
        fs.renameSync(tempDb, path.join(pendingDir, BACKUP_DB_ENTRY));
        const secretEntry = zip.getEntry(BACKUP_SECRET_ENTRY);
        if (secretEntry) {
            fs.writeFileSync(path.join(pendingDir, BACKUP_SECRET_ENTRY), secretEntry.getData());
        }
        fs.writeFileSync(path.join(pendingDir, BACKUP_MANIFEST_ENTRY), manifestEntry.getData());

        const markerTmp = path.join(pendingDir, `${READY_MARKER}.tmp`);
        const fd = fs.openSync(markerTmp, "w");
        try {
            fs.writeSync(fd, "1");
            fs.fsyncSync(fd);
        } finally {
            fs.closeSync(fd);
        }
        fs.renameSync(markerTmp, path.join(pendingDir, READY_MARKER));
        return { ok: true };
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}
