import fs from "node:fs";
import path from "node:path";

/**
 * Backup-file pruning: pre-migration `VACUUM INTO` copies
 * (plex-monitor.db.v{N}-backup-{ts}.db) and pre-restore copies used to
 * accumulate forever in the config dir. Keeps the newest `keep` files per
 * pattern. Pure fs; returns the deleted file names for logging.
 */
export function pruneBackups(dir: string, pattern: RegExp, keep: number): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const matches = entries
        .filter((name) => pattern.test(name))
        .map((name) => {
            const full = path.join(dir, name);
            let mtime = 0;
            try {
                mtime = fs.statSync(full).mtimeMs;
            } catch {
                // Vanished between readdir and stat — treat as oldest.
            }
            return { name, full, mtime };
        })
        .sort((a, b) => b.mtime - a.mtime);

    const removed: string[] = [];
    for (const stale of matches.slice(Math.max(0, keep))) {
        try {
            fs.rmSync(stale.full, { force: true });
            removed.push(stale.name);
        } catch {
            // Locked/permission issue — best effort, try again next boot.
        }
    }
    return removed;
}

export const PRE_MIGRATION_BACKUP_PATTERN = /\.v\d+-backup-\d+\.db$/;
export const PRE_RESTORE_BACKUP_PATTERN = /^pre-restore-backup-\d+\.db$/;
export const BACKUPS_TO_KEEP = 3;
