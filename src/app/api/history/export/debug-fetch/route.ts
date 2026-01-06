import { NextRequest, NextResponse } from "next/server";
import { plexFetch, resolveServer } from "@/lib/plex";
import { getServerById } from "@/lib/servers";

export async function GET(req: NextRequest) {
    // Pick first valid server
    const { listInternalServers } = await import("@/lib/servers");
    const servers = await listInternalServers();
    const server = servers.find(s => s.baseUrl && s.token);

    if (!server) return NextResponse.json({ error: "No server" });

    try {
        const config = resolveServer(server);
        // Fetch specific metadata for 7th Time Loop (Show)
        const xml = (await plexFetch(`/library/metadata/112139`, {}, config)) as any;

        return NextResponse.json({ xml });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
