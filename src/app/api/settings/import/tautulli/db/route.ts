import { NextResponse } from "next/server";
import { createJob } from "@/lib/jobs";
import { Logger } from "@/lib/logger";
import { inspectTautulliDb, runTautulliDbImport } from "@/lib/tautulli-db-import";

/**
 * Tautulli database-file import.
 * POST { path, checkOnly: true }            -> validate + servers + suggested mapping
 * POST { path, serverMapping: {srcId: id} } -> start background import job
 * Single-server (original Tautulli) files use serverMapping key "0".
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { path, checkOnly, serverMapping } = body as {
            path?: string;
            checkOnly?: boolean;
            serverMapping?: Record<string, string>;
        };

        if (!path || typeof path !== "string" || !path.endsWith(".db")) {
            return NextResponse.json({ error: "A .db file path is required" }, { status: 400 });
        }

        if (checkOnly) {
            const info = inspectTautulliDb(path);
            return NextResponse.json({ success: true, ...info });
        }

        if (!serverMapping || Object.keys(serverMapping).length === 0) {
            return NextResponse.json({ error: "Missing server mapping" }, { status: 400 });
        }

        const firstTargetId = Object.values(serverMapping).find((v) => v !== "ignore");
        if (!firstTargetId) {
            return NextResponse.json({ error: "All source servers are set to ignore" }, { status: 400 });
        }

        const job = createJob("import_tautulli_db", firstTargetId);
        void runTautulliDbImport(job.id, { path, serverMapping });

        return NextResponse.json({ success: true, jobId: job.id });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        Logger.error("Tautulli DB Import Error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
