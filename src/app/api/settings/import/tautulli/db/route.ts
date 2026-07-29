import { NextResponse } from "next/server";
import { createJob } from "@/lib/jobs";
import { requireOwner } from "@/lib/auth-guard";
import { resolveImportPath } from "@/lib/import-paths";
import { Logger } from "@/lib/logger";
import { inspectTautulliDb, runTautulliDbImport, NOT_TAUTULLI_PREFIX } from "@/lib/tautulli-db-import";

/**
 * Tautulli database-file import.
 * POST { path, checkOnly: true }            -> validate + servers + suggested mapping
 * POST { path, serverMapping: {srcId: id} } -> start background import job
 * Single-server (original Tautulli) files use serverMapping key "0".
 *
 * The path is confined to the config volume's import directory; see
 * src/lib/import-paths.ts.
 */
export async function POST(request: Request) {
    // Reads a local file off the container filesystem.
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { path: requestedPath, checkOnly, serverMapping } = body as {
            path?: string;
            checkOnly?: boolean;
            serverMapping?: Record<string, string>;
        };

        if (typeof requestedPath !== "string" || !requestedPath.endsWith(".db")) {
            return NextResponse.json({ error: "A .db file path is required" }, { status: 400 });
        }

        const dbPath = resolveImportPath(requestedPath);
        if (!dbPath) {
            return NextResponse.json(
                { error: "The file must be a .db inside the config import directory" },
                { status: 400 },
            );
        }

        if (checkOnly) {
            const info = inspectTautulliDb(dbPath);
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
        void runTautulliDbImport(job.id, { path: dbPath, serverMapping });

        return NextResponse.json({ success: true, jobId: job.id });
    } catch (error) {
        Logger.error("Tautulli DB Import Error:", error);
        // Our own shape check is actionable and safe to show. Raw SQLite errors
        // are not — they carry absolute paths and distinguish "no such file"
        // from "not a database".
        const message =
            error instanceof Error && error.message.startsWith(NOT_TAUTULLI_PREFIX)
                ? error.message
                : "Could not read the database file";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
