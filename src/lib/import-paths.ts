import fs from "node:fs";
import path from "node:path";
import { resolveConfigDir } from "./config-dir";

/**
 * Containment for caller-supplied filesystem paths. Only the import directory
 * inside the config volume is reachable — without this, a path ending in `.db`
 * was enough to open any SQLite file in the container, and the distinct
 * better-sqlite3 error strings turned the route into a filesystem oracle.
 *
 * Node-only (fs) — never import from middleware or client code.
 */

/** The single directory imports may read from, created on demand. */
export const resolveImportRoot = (): string => {
    const configDir = resolveConfigDir() ?? path.join(process.cwd(), "prisma");
    const importRoot = path.join(configDir, "import");
    if (!fs.existsSync(importRoot)) {
        try {
            fs.mkdirSync(importRoot, { recursive: true });
        } catch {
            // A missing root simply means nothing resolves inside it.
        }
    }
    return importRoot;
};

/**
 * True when `target` is the root itself or sits underneath it. Uses
 * path.relative rather than a string prefix — `<root>secrets` starts with
 * `<root>` as a string but is a sibling directory, not a child.
 */
const isInside = (root: string, target: string): boolean => {
    const relative = path.relative(root, target);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

/**
 * Resolve a caller-supplied path against the import root, following symlinks so
 * a link planted inside the root cannot point out of it. Returns null when the
 * path escapes, does not exist, or is not a regular file.
 */
export const resolveImportPath = (raw: unknown): string | null => {
    if (typeof raw !== "string" || raw.trim() === "") return null;

    const root = resolveImportRoot();
    const resolved = path.resolve(root, raw.trim());
    if (!isInside(root, resolved)) return null;

    let real: string;
    let realRoot: string;
    try {
        real = fs.realpathSync(resolved);
        realRoot = fs.realpathSync(root);
    } catch {
        return null;
    }
    if (!isInside(realRoot, real)) return null;
    if (!fs.statSync(real).isFile()) return null;

    return real;
};

/** Same containment, for directory listing — the target must be a directory. */
export const resolveImportDir = (raw: unknown): string | null => {
    const root = resolveImportRoot();
    const requested = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : root;

    const resolved = path.resolve(root, requested);
    if (!isInside(root, resolved)) return null;

    let real: string;
    let realRoot: string;
    try {
        real = fs.realpathSync(resolved);
        realRoot = fs.realpathSync(root);
    } catch {
        return null;
    }
    if (!isInside(realRoot, real)) return null;
    if (!fs.statSync(real).isDirectory()) return null;

    return real;
};
