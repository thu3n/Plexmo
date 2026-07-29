import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-guard";
import { resolveTautulliApiBase, tautulliFetch } from "@/lib/tautulli-url";
import { Logger } from "@/lib/logger";

/** Highest Tautulli server_id the ghost scan probes for orphaned history. */
const MAX_GHOST_SERVER_ID = 20;
/** Concurrency cap so one check can't open 20 sockets against a foreign host at once. */
const GHOST_SCAN_CONCURRENCY = 4;

type GhostServer = {
    id: string;
    name: string;
    identifier: string;
    type: "ghost";
    param: number;
};

/** Probe one server id for history rows; null when it has none or the call fails. */
const probeGhostServer = async (apiUrl: string, apiKey: string, id: number): Promise<GhostServer | null> => {
    try {
        const histRes = await tautulliFetch(apiUrl, apiKey, { cmd: "get_history", server_id: id, length: 1 });
        if (!histRes.ok) return null;

        const histData = await histRes.json();
        if (histData.response?.result !== "success") return null;

        const count = parseInt(histData.response.data.recordsFiltered || 0);
        if (count <= 0) return null;

        return {
            id: id.toString(),
            // No name is available for these, so label them clearly.
            name: `Deleted/Legacy Server (ID ${id})`,
            identifier: `ghost-${id}`,
            type: "ghost",
            param: id,
        };
    } catch {
        // Ignore errors for individual checks
        return null;
    }
};

export async function POST(request: Request) {
    // Issues a server-side request to a caller-supplied URL.
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { url, apiKey } = body;

        if (!url || !apiKey || typeof apiKey !== "string") {
            return NextResponse.json({ error: "Missing URL or API Key" }, { status: 400 });
        }

        const apiUrl = resolveTautulliApiBase(url);
        if (!apiUrl) {
            return NextResponse.json({ error: "Invalid Tautulli URL" }, { status: 400 });
        }

        // Strategy 1: Standard Tautulli (get_servers_info)
        let servers: any[] = [];

        try {
            const serversRes = await tautulliFetch(apiUrl, apiKey, { cmd: "get_servers_info" });
            if (serversRes.ok) {
                const data = await serversRes.json();
                if (data.response?.result === 'success') {
                    // Normalize Standard Response
                    const rawData = data.response.data;

                    // Strict check: if rawData is empty object or null, skip
                    if (rawData && Object.keys(rawData).length > 0) {
                        const serverList = Array.isArray(rawData) ? rawData : [rawData];

                        servers = serverList.map((s: any) => ({
                            id: s.machine_identifier,
                            name: s.name,
                            identifier: s.machine_identifier,
                            type: 'standard',
                            param: s.machine_identifier
                        }));
                    }
                }
            }
        } catch {
            Logger.warn("Standard check failed, trying fork strategy...");
        }

        // Strategy 2: Tautulli Fork (get_server_names) if Strategy 1 found nothing
        if (servers.length === 0) {
            try {
                const namesRes = await tautulliFetch(apiUrl, apiKey, { cmd: "get_server_names" });
                if (namesRes.ok) {
                    const data = await namesRes.json();
                    if (data.response?.result === 'success') {
                        // Normalize Fork Response
                        const rawData = data.response.data;
                        // Fork returns array of { server_id, pms_name }
                        if (Array.isArray(rawData) && rawData.length > 0) {
                            servers = rawData.map((s: any) => ({
                                id: s.server_id.toString(),
                                name: s.pms_name,
                                identifier: null,
                                type: 'fork',
                                param: s.server_id
                            }));
                        }
                    }
                }
            } catch (e) {
                Logger.error("Fork check failed:", e);
            }
        }

        // Strategy 3: Fallback (If connection worked but no info returned - e.g. unconfigured fork)
        if (servers.length === 0) {
            // Verify basic connectivity with a cheap call like 'get_status' or 'arnold'
            try {
                const pingRes = await tautulliFetch(apiUrl, apiKey, { cmd: "arnold" });
                if (pingRes.ok) {
                    // Connection is GOOD, but no server info. Return a generic Default Server.
                    servers = [{
                        id: 'default',
                        name: 'Default Tautulli Server',
                        identifier: 'default', // Placeholder
                        type: 'fork', // Assume fork behavior (manual mapping)
                        param: 1 // Default server_id = 1
                    }];
                }
            } catch {
                // Ignore
            }
        }

        // --- GHOST SERVER SCAN ---
        // Find servers that have history but were missed by the main API (e.g. deleted servers).
        const existingIds = new Set(servers.map(s => s.param.toString()));
        const queue = Array.from({ length: MAX_GHOST_SERVER_ID }, (_, i) => i + 1)
            .filter((id) => !existingIds.has(id.toString()));

        const ghosts: GhostServer[] = [];
        const scanWorker = async () => {
            for (; ;) {
                const id = queue.shift();
                if (id === undefined) return;
                const ghost = await probeGhostServer(apiUrl, apiKey, id);
                if (ghost) ghosts.push(ghost);
            }
        };
        await Promise.all(Array.from({ length: GHOST_SCAN_CONCURRENCY }, scanWorker));

        servers = [...servers, ...ghosts.sort((a, b) => a.param - b.param)];
        // -------------------------

        if (servers.length === 0) {
            return NextResponse.json({ error: "Could not retrieve server list from Tautulli. Checked both Standard and Multi-Server methods." }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            servers: servers // Return array of normalized servers
        });

    } catch (error) {
        // Never reflect the error text: fetch failures name the host that was
        // probed, which turns this into an internal network scanner.
        Logger.error("Tautulli Check Error:", error);
        return NextResponse.json({ error: "Could not reach Tautulli" }, { status: 502 });
    }
}
