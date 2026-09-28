import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-guard";
import { listServersForOwnership } from "@/lib/servers";
import { fetchServerResources, type ServerResources } from "@/lib/server-resources";

export const dynamic = "force-dynamic";

/**
 * Live CPU/RAM per active server for the statistics server-status card.
 * Owner-only, like /api/servers/status: it calls Plex with stored owner
 * credentials and exposes host load that viewers have no use for.
 */
export async function GET(request: Request) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const servers = (await listServersForOwnership()).filter((s) => !s.archivedAt && !s.disabledAt);
    const resources: ServerResources[] = await Promise.all(servers.map((s) => fetchServerResources(s)));
    return NextResponse.json({ servers: resources });
}
