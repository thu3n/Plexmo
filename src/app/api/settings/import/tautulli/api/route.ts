import { NextResponse } from "next/server";
import { createJob } from "@/lib/jobs";
import { Logger } from "@/lib/logger";
import { runTautulliImport } from "@/lib/tautulli-import";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, apiKey, serverMapping } = body;

        // serverMapping is { [sourceId]: targetPlexmoId }
        if (!url || !apiKey || !serverMapping || Object.keys(serverMapping).length === 0) {
            return NextResponse.json({ error: "Missing URL, API Key, or Server Mapping" }, { status: 400 });
        }

        // Clean URL (strip trailing slash)
        const cleanUrl = url.replace(/\/$/, "");

        // Create Job (Associated with the FIRST target server for now, or a generic system job if we supported it)
        // For UI purposes, we'll pick the first target ID to associate the job notification with,
        // or just use 'system' if allowed. We'll stick to first target for now.
        const firstTargetId = Object.values(serverMapping)[0] as string;
        const job = createJob('import_tautulli', firstTargetId);

        // Kick off the background import (does not block the response; reports
        // progress/terminal state via the job record).
        void runTautulliImport(job.id, { cleanUrl, apiKey, serverMapping });

        return NextResponse.json({ success: true, jobId: job.id });

    } catch (error: any) {
        Logger.error("Tautulli API Import Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
