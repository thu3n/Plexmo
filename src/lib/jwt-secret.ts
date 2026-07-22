import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { resolveConfigDir } from "./config-dir";

/**
 * Resolves the JWT signing secret at RUNTIME and exposes it via
 * process.env.JWT_SECRET before any request is served (called from
 * instrumentation.ts, Node runtime only — the middleware edge sandbox reads
 * the env but cannot touch fs).
 *
 * Priority: explicit JWT_SECRET env → persisted secret in the config volume
 * (survives restarts AND image upgrades) → auto-generate + persist → last
 * resort in-memory secret (sessions reset on restart).
 *
 * Historically the secret was resolved in next.config.ts and INLINED at
 * build time — every CI build baked a fresh random secret into the image,
 * logging everyone out on each deploy. Node-only module: never import from
 * middleware or client code.
 */

const SECRET_FILE = ".jwt-secret";

export const ensureJwtSecret = (): void => {
    if (process.env.JWT_SECRET) return; // explicit env always wins

    const dir = resolveConfigDir();
    if (dir) {
        const file = path.join(dir, SECRET_FILE);
        try {
            const existing = fs.readFileSync(file, "utf8").trim();
            if (existing) {
                process.env.JWT_SECRET = existing;
                return;
            }
        } catch {
            // Not created yet — fall through and generate.
        }
        try {
            const fresh = randomBytes(32).toString("hex");
            fs.writeFileSync(file, fresh, { mode: 0o600 });
            process.env.JWT_SECRET = fresh;
            console.log(`[Auth] Generated persistent JWT secret at ${file} — sessions now survive restarts and upgrades.`);
            return;
        } catch (error) {
            console.error("[Auth] Failed to persist JWT secret:", error);
        }
    }

    console.warn("[Auth] No JWT_SECRET and no writable config dir — using a temporary secret; sessions reset on restart.");
    process.env.JWT_SECRET = randomBytes(32).toString("hex");
};
