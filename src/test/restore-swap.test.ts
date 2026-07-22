import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyPendingRestore, PENDING_DIR_NAME, READY_MARKER } from "@/lib/backup/restore-swap";
import { pruneBackups, PRE_MIGRATION_BACKUP_PATTERN } from "@/lib/backup/backup-retention";

let configDir: string;
let dbPath: string;

const pendingDir = () => path.join(configDir, PENDING_DIR_NAME);

const stage = (opts: { db?: string; secret?: string; ready?: boolean }) => {
    fs.mkdirSync(pendingDir(), { recursive: true });
    if (opts.db !== undefined) fs.writeFileSync(path.join(pendingDir(), "plexmo.db"), opts.db);
    if (opts.secret !== undefined) fs.writeFileSync(path.join(pendingDir(), "jwt-secret"), opts.secret);
    if (opts.ready) fs.writeFileSync(path.join(pendingDir(), READY_MARKER), "1");
};

beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), "plexmo-swap-"));
    dbPath = path.join(configDir, "plex-monitor.db");
});

afterEach(() => {
    fs.rmSync(configDir, { recursive: true, force: true });
});

describe("applyPendingRestore", () => {
    it("performs a clean swap: db replaced, old kept aside, secret written, staging removed", () => {
        fs.writeFileSync(dbPath, "OLD DATABASE");
        fs.writeFileSync(dbPath + "-wal", "stale wal");
        stage({ db: "NEW DATABASE", secret: "secret123", ready: true });

        expect(applyPendingRestore(configDir, dbPath)).toBe(true);

        expect(fs.readFileSync(dbPath, "utf-8")).toBe("NEW DATABASE");
        expect(fs.existsSync(dbPath + "-wal")).toBe(false);
        expect(fs.readFileSync(path.join(configDir, ".jwt-secret"), "utf-8")).toBe("secret123");
        const preRestore = fs.readdirSync(configDir).filter((f) => f.startsWith("pre-restore-backup-"));
        expect(preRestore).toHaveLength(1);
        expect(fs.readFileSync(path.join(configDir, preRestore[0]), "utf-8")).toBe("OLD DATABASE");
        expect(fs.existsSync(pendingDir())).toBe(false);
    });

    it("treats a staging dir WITHOUT the READY marker as garbage and leaves the db alone", () => {
        fs.writeFileSync(dbPath, "OLD DATABASE");
        stage({ db: "NEW DATABASE", ready: false });

        expect(applyPendingRestore(configDir, dbPath)).toBe(false);
        expect(fs.readFileSync(dbPath, "utf-8")).toBe("OLD DATABASE");
        expect(fs.existsSync(pendingDir())).toBe(false);
    });

    it("converges after a crash mid-swap (READY present, staged db already consumed)", () => {
        fs.writeFileSync(dbPath, "ALREADY SWAPPED");
        stage({ ready: true });

        expect(applyPendingRestore(configDir, dbPath)).toBe(false);
        expect(fs.readFileSync(dbPath, "utf-8")).toBe("ALREADY SWAPPED");
        expect(fs.existsSync(pendingDir())).toBe(false);
    });

    it("handles a fresh instance with no current database", () => {
        stage({ db: "NEW DATABASE", ready: true });

        expect(applyPendingRestore(configDir, dbPath)).toBe(true);
        expect(fs.readFileSync(dbPath, "utf-8")).toBe("NEW DATABASE");
        expect(fs.readdirSync(configDir).filter((f) => f.startsWith("pre-restore-backup-"))).toHaveLength(0);
    });

    it("is a no-op with no staging dir or no config dir", () => {
        expect(applyPendingRestore(configDir, dbPath)).toBe(false);
        expect(applyPendingRestore(null, dbPath)).toBe(false);
    });
});

describe("pruneBackups", () => {
    it("keeps the newest N matching files and ignores non-matching ones", () => {
        const base = Date.now() / 1000;
        for (let i = 0; i < 5; i++) {
            const file = path.join(configDir, `plex-monitor.db.v1${i}-backup-${i}.db`);
            fs.writeFileSync(file, "x");
            fs.utimesSync(file, base - (5 - i) * 60, base - (5 - i) * 60);
        }
        fs.writeFileSync(path.join(configDir, "plex-monitor.db"), "live");

        const removed = pruneBackups(configDir, PRE_MIGRATION_BACKUP_PATTERN, 3);
        expect(removed.sort()).toEqual([
            "plex-monitor.db.v10-backup-0.db",
            "plex-monitor.db.v11-backup-1.db",
        ]);
        expect(fs.existsSync(path.join(configDir, "plex-monitor.db"))).toBe(true);
        expect(
            fs.readdirSync(configDir).filter((f) => PRE_MIGRATION_BACKUP_PATTERN.test(f))
        ).toHaveLength(3);
    });
});
