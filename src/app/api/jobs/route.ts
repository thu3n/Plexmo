import { NextRequest, NextResponse } from "next/server";
import { getJobs, createJob, getRunningJobForTarget } from "@/lib/jobs";
import { syncLibraryItems, syncLibraries, syncAllLibrariesContent, syncAllLibraryLists } from "@/lib/libraries";
import { getServerById } from "@/lib/servers";
import { resolveServer } from "@/lib/plex";

export async function GET() {
    try {
        const jobs = getJobs();
        return NextResponse.json({ jobs });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { type, libraryKey, serverId } = body;

        if (type === 'sync_library') {
            if (!libraryKey || !serverId) {
                return NextResponse.json({ error: "Missing libraryKey or serverId" }, { status: 400 });
            }

            // Check if job already running
            const existing = getRunningJobForTarget(type, libraryKey);
            if (existing) {
                return NextResponse.json({ job: existing, message: "Sync already running" });
            }

            const dbServer = await getServerById(serverId);
            if (!dbServer) {
                return NextResponse.json({ error: "Server not found" }, { status: 404 });
            }

            const serverConfig = resolveServer({
                id: dbServer.id,
                name: dbServer.name,
                baseUrl: dbServer.baseUrl,
                token: dbServer.token
            });

            const job = createJob(type, libraryKey);

            // Start sync in background (no await)
            syncLibraryItems(serverConfig, libraryKey, job.id).catch(err => {
                console.error(`[API] Background sync failed for job ${job.id}:`, err);
            });

            return NextResponse.json({ job });
        } else if (type === 'sync_server_libraries') {
            if (!serverId) {
                return NextResponse.json({ error: "Missing serverId" }, { status: 400 });
            }

            const dbServer = await getServerById(serverId);
            if (!dbServer) {
                return NextResponse.json({ error: "Server not found" }, { status: 404 });
            }

            const serverConfig = resolveServer({
                id: dbServer.id,
                name: dbServer.name,
                baseUrl: dbServer.baseUrl,
                token: dbServer.token
            });

            // Target ID is server ID for this job type
            const existing = getRunningJobForTarget(type, serverId);
            if (existing) {
                return NextResponse.json({ job: existing, message: "Sync already running" });
            }

            const job = createJob(type, serverId);

            // Start sync in background
            syncLibraries(serverConfig, job.id).catch(err => {
                console.error(`[API] Background library list sync failed for job ${job.id}:`, err);
            });

            return NextResponse.json({ job });
        } else if (type === 'sync_all_content') {
            // Check if global sync is running
            const existing = getRunningJobForTarget(type, 'global');
            if (existing) {
                return NextResponse.json({ job: existing, message: "Global sync already running" });
            }

            const job = createJob(type, 'global');

            // Start sync in background
            syncAllLibrariesContent(job.id).catch(err => {
                console.error(`[API] Global content sync failed for job ${job.id}:`, err);
            });

            return NextResponse.json({ job });
        } else if (type === 'sync_all_library_lists') {
            // Check if global list sync is running
            const existing = getRunningJobForTarget(type, 'global');
            if (existing) {
                return NextResponse.json({ job: existing, message: "Global library list sync already running" });
            }

            const job = createJob(type, 'global');

            // Start sync in background
            syncAllLibraryLists(job.id).catch(err => {
                console.error(`[API] Global library list sync failed for job ${job.id}:`, err);
            });

            return NextResponse.json({ job });
        } else if (type === 'reconcile_stats') {
            // Check if already running
            const existing = getRunningJobForTarget(type, 'global');
            if (existing) {
                return NextResponse.json({ job: existing, message: "Reconciliation already running" });
            }

            const job = createJob(type, 'global');

            // Start sync in background
            // Dynamic import to avoid circular dependency issues
            import("@/lib/cron_reconcile_stats").then(({ reconcileStatistics }) => {
                reconcileStatistics(job.id); // Error handling is now inside properly
            });

            return NextResponse.json({ job });
        }

        return NextResponse.json({ error: "Unknown job type" }, { status: 400 });

    } catch (error: any) {
        console.error("[API] Job creation failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
