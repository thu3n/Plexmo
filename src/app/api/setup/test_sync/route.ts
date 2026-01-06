import { NextResponse } from "next/server";
import { getLibraries, syncLibraryItems } from "@/lib/libraries";
import { getServerById } from "@/lib/servers";
import { resolveServer } from "@/lib/plex";
import { createJob } from "@/lib/jobs";

export async function GET() {
    // 1. Get a library
    const libs = await getLibraries();
    if (libs.length === 0) return NextResponse.json({ error: "No libraries" });
    const lib = libs[0];

    // 2. Get server
    if (!lib.serverId) {
        return NextResponse.json({ error: "Library has no server ID" }, { status: 500 });
    }
    const dbServer = await getServerById(lib.serverId);
    if (!dbServer) return NextResponse.json({ error: "Server not found" });

    // 3. Resolve
    const serverConfig = resolveServer({
        id: dbServer.id,
        name: dbServer.name,
        baseUrl: dbServer.baseUrl,
        token: dbServer.token
    });

    // 4. Create Job
    const job = createJob('sync_library', lib.key);

    // 5. Sync
    console.log("Starting test sync for", lib.title);
    // await for test purposes to see result immediately
    await syncLibraryItems(serverConfig, lib.key, job.id);

    return NextResponse.json({ success: true, job });
}
