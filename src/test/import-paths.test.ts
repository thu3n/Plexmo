import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Containment for the Tautulli DB import path. CONFIG_DIR has to be set before
 * the module loads, since resolveImportRoot() reads it through resolveConfigDir().
 */
let configDir: string;
let importRoot: string;
let resolveImportPath: typeof import("@/lib/import-paths").resolveImportPath;
let resolveImportDir: typeof import("@/lib/import-paths").resolveImportDir;

beforeAll(async () => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), "plexmo-import-test-"));
    process.env.CONFIG_DIR = configDir;

    importRoot = path.join(configDir, "import");
    fs.mkdirSync(path.join(importRoot, "Tautulli"), { recursive: true });
    fs.writeFileSync(path.join(importRoot, "Tautulli", "tautulli.db"), "not-really-sqlite");

    // A sibling whose name shares the root's string prefix — the case a
    // startsWith() check lets through.
    fs.mkdirSync(path.join(configDir, "importsecrets"), { recursive: true });
    fs.writeFileSync(path.join(configDir, "importsecrets", "leak.db"), "secret");

    fs.writeFileSync(path.join(configDir, "outside.db"), "secret");

    ({ resolveImportPath, resolveImportDir } = await import("@/lib/import-paths"));
});

afterAll(() => {
    delete process.env.CONFIG_DIR;
    fs.rmSync(configDir, { recursive: true, force: true });
});

describe("resolveImportPath", () => {
    it("accepts a file inside the import root", () => {
        const resolved = resolveImportPath(path.join(importRoot, "Tautulli", "tautulli.db"));
        expect(resolved).toBe(fs.realpathSync(path.join(importRoot, "Tautulli", "tautulli.db")));
    });

    it("accepts a path relative to the import root", () => {
        expect(resolveImportPath("Tautulli/tautulli.db")).not.toBeNull();
    });

    it("rejects traversal out of the root", () => {
        expect(resolveImportPath(path.join(importRoot, "..", "outside.db"))).toBeNull();
        expect(resolveImportPath("../outside.db")).toBeNull();
    });

    it("rejects a sibling directory sharing the root's string prefix", () => {
        expect(resolveImportPath(path.join(configDir, "importsecrets", "leak.db"))).toBeNull();
    });

    it("rejects absolute paths elsewhere on the filesystem", () => {
        expect(resolveImportPath("/etc/passwd.db")).toBeNull();
    });

    it("rejects missing files, directories and non-strings", () => {
        expect(resolveImportPath(path.join(importRoot, "nope.db"))).toBeNull();
        expect(resolveImportPath(importRoot)).toBeNull();
        expect(resolveImportPath("")).toBeNull();
        expect(resolveImportPath(null)).toBeNull();
        expect(resolveImportPath(42)).toBeNull();
    });

    it("follows symlinks and rejects ones pointing out of the root", () => {
        const link = path.join(importRoot, "escape.db");
        try {
            fs.symlinkSync(path.join(configDir, "outside.db"), link);
        } catch {
            return; // Windows without developer mode cannot create symlinks
        }
        expect(resolveImportPath(link)).toBeNull();
        fs.rmSync(link, { force: true });
    });
});

describe("resolveImportDir", () => {
    it("defaults to the import root", () => {
        expect(resolveImportDir(null)).toBe(fs.realpathSync(importRoot));
    });

    it("accepts a directory inside the root", () => {
        expect(resolveImportDir(path.join(importRoot, "Tautulli"))).not.toBeNull();
    });

    it("rejects escapes and files", () => {
        expect(resolveImportDir(configDir)).toBeNull();
        expect(resolveImportDir(path.join(configDir, "importsecrets"))).toBeNull();
        expect(resolveImportDir(path.join(importRoot, "Tautulli", "tautulli.db"))).toBeNull();
    });
});
