import fs from "node:fs";
import path from "node:path";

/**
 * Boot-time restore swap. A validated upload is staged in
 * `<configDir>/restore-pending/` with an atomically-renamed READY marker as
 * the commit point; this runs at the very top of db.ts, BEFORE the SQLite
 * file is opened and before any prepared statement binds.
 *
 * Crash-safe and idempotent — every interrupted state converges:
 * - no READY marker           → staging never committed: delete the stray dir
 * - READY but no staged db    → crash after the swap: just clean up
 * - crash before the swap     → next boot redoes it from scratch
 * Pure fs functions over paths; must never import the db module.
 */

export const PENDING_DIR_NAME = "restore-pending";
export const READY_MARKER = "READY";
const STAGED_DB_NAME = "plexmo.db";
const STAGED_SECRET_NAME = "jwt-secret";
const SECRET_FILE = ".jwt-secret";

export function applyPendingRestore(configDir: string | null, dbPath: string): boolean {
    if (!configDir) return false;
    const pendingDir = path.join(configDir, PENDING_DIR_NAME);
    if (!fs.existsSync(pendingDir)) return false;

    const readyMarker = path.join(pendingDir, READY_MARKER);
    if (!fs.existsSync(readyMarker)) {
        // Staging was never committed (crash mid-upload/validation) — garbage.
        fs.rmSync(pendingDir, { recursive: true, force: true });
        return false;
    }

    const stagedDb = path.join(pendingDir, STAGED_DB_NAME);
    let swapped = false;
    if (fs.existsSync(stagedDb)) {
        if (fs.existsSync(dbPath)) {
            fs.renameSync(
                dbPath,
                path.join(path.dirname(dbPath), `pre-restore-backup-${Date.now()}.db`)
            );
        }
        // Stale sidecars from the replaced DB must not pollute the restored one.
        for (const suffix of ["-wal", "-shm"]) {
            fs.rmSync(dbPath + suffix, { force: true });
        }
        fs.renameSync(stagedDb, dbPath);
        swapped = true;
    }

    // Copy (not rename) so a crash between here and cleanup can re-run this.
    const stagedSecret = path.join(pendingDir, STAGED_SECRET_NAME);
    if (fs.existsSync(stagedSecret)) {
        const secretPath = path.join(configDir, SECRET_FILE);
        fs.copyFileSync(stagedSecret, secretPath);
        try {
            fs.chmodSync(secretPath, 0o600);
        } catch {
            // Windows dev: chmod is a no-op; the file still works.
        }
    }

    fs.rmSync(readyMarker, { force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
    return swapped;
}
