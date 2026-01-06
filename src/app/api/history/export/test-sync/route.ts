import { NextRequest, NextResponse } from "next/server";
import { createJob } from "@/lib/jobs";
import { syncLibraryItems, syncAllLibraryLists } from "@/lib/libraries";
import { getServerById } from "@/lib/servers";
import { resolveServer } from "@/lib/plex";

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { key: libraryKey, server: serverId, type } = body;
    console.log("Test Route Type:", type);

    if (type === 'sync_all_library_lists') {
        const job = createJob('sync_all_library_lists', 'global');
        syncAllLibraryLists(job.id).catch(console.error);
        return NextResponse.json({ job });
    }

    if (type === 'sync_all_content') {
        const { createJob } = await import("@/lib/jobs");
        const { syncAllLibrariesContent } = await import("@/lib/libraries");
        const job = createJob('sync_all_content', 'global');
        syncAllLibrariesContent(job.id).catch(console.error);
        return NextResponse.json({ job });
    }

    if (!libraryKey || !serverId) {
        return NextResponse.json({ error: "Missing key or server" }, { status: 400 });
    }

    const jobType = 'sync_library';

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

    const job = createJob(jobType, libraryKey);

    syncLibraryItems(serverConfig, libraryKey, job.id).catch(err => {
        console.error(`[TestAPI] Sync failed:`, err);
    });

    return NextResponse.json({ job });
}
