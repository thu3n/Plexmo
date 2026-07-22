import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth-guard";
import { resolveConfigDir, resolveDbPath } from "@/lib/config-dir";
import { createBackupZip } from "@/lib/backup/backup-bundle";

export const dynamic = "force-dynamic";

/**
 * Full backup download: zip with a consistent VACUUM INTO snapshot of the DB,
 * the JWT secret (session portability) and a manifest. Replaces the old raw
 * .db download, which copied a hot WAL database without checkpointing.
 * Owner-only — the bundle contains every Plex token in plaintext.
 */
export async function GET(request: Request) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const configDir = resolveConfigDir() ?? path.dirname(resolveDbPath());

        let appVersion = "0.0.0";
        try {
            const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"));
            appVersion = pkg.version || appVersion;
        } catch {
            // Version is informational only.
        }

        const zipBuffer = createBackupZip(db, configDir, appVersion);
        const filename = `plexmo-backup-${new Date().toISOString().slice(0, 10)}.zip`;

        const response = new NextResponse(new Uint8Array(zipBuffer));
        response.headers.set("Content-Type", "application/zip");
        response.headers.set("Content-Disposition", `attachment; filename="${filename}"`);
        response.headers.set("Content-Length", zipBuffer.length.toString());
        response.headers.set("Cache-Control", "no-cache");
        return response;
    } catch (error) {
        Logger.error("[Export Error]", error);
        return NextResponse.json({ error: "Internal Export Error" }, { status: 500 });
    }
}
