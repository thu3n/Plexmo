import { NextRequest, NextResponse } from "next/server";
import { plexFetch, resolveServer } from "@/lib/plex";
import { getServerById } from "@/lib/servers";

export async function GET(req: NextRequest) {
    const libraryKey = req.nextUrl.searchParams.get("key") || '7'; // Default to a show library

    // STRICT SECURITY: Prevent SSRF
    // Only allow numeric library keys (e.g. "1", "7", "12")
    if (!/^\d+$/.test(libraryKey)) {
        return NextResponse.json({ error: "Invalid key. Only numeric library IDs are allowed." }, { status: 400 });
    }

    // Find a server
    // Find a server
    // We need to match the library key to a server?
    // Or just pick the first valid server.

    // Let's get the server corresponding to library 7?
    // We can assume the server is the one we fixed: 2a93ca35...
    // Or just look it up.

    // Hardcode for speed if I know the ID, or query?
    // Let's query valid server.
    const { listInternalServers } = await import("@/lib/servers");
    const servers = await listInternalServers();
    const server = servers.find(s => s.baseUrl && s.token); // Pick first valid

    if (!server) return NextResponse.json({ error: "No server" });

    try {
        const config = resolveServer(server);
        const xml = (await plexFetch(`/library/sections/${libraryKey}/all`, {
            "X-Plex-Container-Start": 0,
            "X-Plex-Container-Size": 1,
            includeLocations: 1
        }, config)) as any;

        return NextResponse.json({ xml });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
