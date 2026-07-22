import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveConfigDir, resolveDbPath } from "@/lib/config-dir";

let tempDir: string;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plexmo-configdir-"));
    for (const key of ["CONFIG_DIR", "DATABASE_URL"]) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
    }
});

afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("resolveConfigDir", () => {
    it("prefers CONFIG_DIR when set", () => {
        process.env.CONFIG_DIR = tempDir;
        expect(resolveConfigDir()).toBe(tempDir);
    });

    it("falls back to the ./prisma dev directory when nothing else applies", () => {
        // Repo has a prisma/ dir; NODE_ENV is not production under vitest.
        expect(resolveConfigDir()).toBe(path.join(process.cwd(), "prisma"));
    });
});

describe("resolveDbPath", () => {
    it("creates and uses CONFIG_DIR/plex-monitor.db", () => {
        const nested = path.join(tempDir, "cfg");
        process.env.CONFIG_DIR = nested;
        expect(resolveDbPath()).toBe(path.join(nested, "plex-monitor.db"));
        expect(fs.existsSync(nested)).toBe(true);
    });

    it("honours DATABASE_URL (file: prefix, relative and absolute) in the dev fallback", () => {
        const absolute = path.join(tempDir, "custom.db");
        process.env.DATABASE_URL = `file:${absolute}`;
        expect(resolveDbPath()).toBe(absolute);

        process.env.DATABASE_URL = "file:./prisma/dev.db";
        expect(resolveDbPath()).toBe(path.join(process.cwd(), "prisma", "dev.db"));
    });
});
