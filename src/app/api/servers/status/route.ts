import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-guard";
import { listServersForOwnership } from "@/lib/servers";
import { getServerSnapshot } from "@/lib/dashboard-cache";
import { probePlexServer } from "@/lib/server-probe";
import { disabledHealth, healthFromProbe, type ServerHealthResponse } from "@/lib/server-health";

/**
 * Live health for every configured (non-archived) server: an authenticated
 * probe per server, in parallel, each bounded by the probe timeout. Owner-only
 * — it makes outbound requests with stored credentials and reveals server
 * versions/latency that viewers have no use for.
 */
export async function GET(request: Request) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const servers = (await listServersForOwnership()).filter((s) => !s.archivedAt);

    const health = await Promise.all(
        servers.map(async (server) => {
            const lastSeenMs = getServerSnapshot(server.id)?.cachedAt;
            if (server.disabledAt) return disabledHealth(server.id, lastSeenMs, now);
            const probe = await probePlexServer({ baseUrl: server.baseUrl, token: server.token });
            return healthFromProbe(server.id, probe, lastSeenMs, now);
        })
    );

    const body: ServerHealthResponse = { servers: health };
    return NextResponse.json(body, { status: 200 });
}
