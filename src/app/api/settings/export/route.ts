import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export async function GET() {
    const token = cookies().get("token")?.value;
    const user = token ? await verifyToken(token) : null;

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Determine database path (same logic as in db.ts)
        let dbPath: string;

        if (process.env.CONFIG_DIR) {
            dbPath = path.join(process.env.CONFIG_DIR, "plex-monitor.db");
        } else if (process.env.NODE_ENV === "production" && fs.existsSync(path.join(process.cwd(), "config"))) {
            dbPath = path.join(process.cwd(), "config", "plex-monitor.db");
        } else if (fs.existsSync("/app/config")) {
            dbPath = path.join("/app/config", "plex-monitor.db");
        } else {
            const raw = process.env.DATABASE_URL || "file:./prisma/dev.db";
            const normalized = raw.startsWith("file:") ? raw.replace(/^file:/, "") : raw;
            dbPath = path.isAbsolute(normalized) ? normalized : path.join(process.cwd(), normalized);
        }

        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ error: "Database file not found" }, { status: 404 });
        }

        // Read the database file
        const dbBuffer = fs.readFileSync(dbPath);
        const filename = `plexmo-backup-${new Date().toISOString().slice(0, 10)}.db`;

        // Create response with proper headers
        const response = new NextResponse(dbBuffer);

        response.headers.set("Content-Type", "application/octet-stream");
        response.headers.set("Content-Disposition", `attachment; filename="${filename}"`);
        response.headers.set("Content-Length", dbBuffer.length.toString());
        response.headers.set("Cache-Control", "no-cache");

        return response;

    } catch (error) {
        console.error("[Export Error]", error);
        return NextResponse.json({ error: "Internal Export Error" }, { status: 500 });
    }
}
