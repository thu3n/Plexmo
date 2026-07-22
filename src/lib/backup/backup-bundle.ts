import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import type Database from "better-sqlite3";

/**
 * Backup bundle: a zip with a CONSISTENT `plexmo.db` snapshot (VACUUM INTO —
 * never a raw copy of the live file, which under WAL can miss un-checkpointed
 * pages), the `.jwt-secret` file (so sessions survive a transfer to a new
 * host) and a manifest for restore-time validation. Entries are buffered in
 * memory; a VACUUMed DB is compacted, and the manifest records dbSizeBytes so
 * this can be revisited if sizes ever demand streaming.
 */

export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_DB_ENTRY = "plexmo.db";
export const BACKUP_SECRET_ENTRY = "jwt-secret";
export const BACKUP_MANIFEST_ENTRY = "manifest.json";

export type BackupManifest = {
    format: number;
    appVersion: string;
    schemaVersion: number;
    createdAt: string;
    dbSizeBytes: number;
};

export const getCurrentSchemaVersion = (db: Database.Database): number =>
    (db.prepare("SELECT MAX(version) as version FROM schema_migrations").get() as { version: number | null })
        .version ?? 0;

export function createBackupZip(db: Database.Database, configDir: string, appVersion: string): Buffer {
    const tempPath = path.join(configDir, `backup-tmp-${Date.now()}.db`);
    try {
        db.exec(`VACUUM INTO '${tempPath.replace(/'/g, "''")}'`);
        const dbBuffer = fs.readFileSync(tempPath);

        const manifest: BackupManifest = {
            format: BACKUP_FORMAT_VERSION,
            appVersion,
            schemaVersion: getCurrentSchemaVersion(db),
            createdAt: new Date().toISOString(),
            dbSizeBytes: dbBuffer.length,
        };

        const zip = new AdmZip();
        zip.addFile(BACKUP_DB_ENTRY, dbBuffer);
        zip.addFile(BACKUP_MANIFEST_ENTRY, Buffer.from(JSON.stringify(manifest, null, 2)));

        const secretPath = path.join(configDir, ".jwt-secret");
        if (fs.existsSync(secretPath)) {
            zip.addFile(BACKUP_SECRET_ENTRY, fs.readFileSync(secretPath));
        }
        return zip.toBuffer();
    } finally {
        fs.rmSync(tempPath, { force: true });
    }
}
