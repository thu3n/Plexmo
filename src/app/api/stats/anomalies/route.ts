import { NextResponse } from "next/server";
import { listAnomalies } from "@/lib/stats/anomalies-store";
import { describeAnomaly, type AnomalyListItem } from "@/lib/stats/anomalies-describe";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { scopedServerIds, canAccessServer } from "@/lib/authz";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Recent anomaly incidents from the daily scan. Not cached: the table is tiny
 * and only changes once a day, and a stale cache would hide a fresh incident.
 */
export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(MAX_DAYS, Math.max(1, Number(searchParams.get("days")) || DEFAULT_DAYS));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT));
    const serverIdParam = searchParams.get("serverId") ?? undefined;
    const serverId = serverIdParam && serverIdParam !== "all" ? serverIdParam : undefined;

    if (serverId && !canAccessServer(user.scope, serverId)) {
        return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    try {
        const anomalies = listAnomalies({
            since: Date.now() - days * ONE_DAY_MS,
            serverId,
            allowedServerIds: scopedServerIds(user.scope),
            limit,
        });
        const items: AnomalyListItem[] = anomalies.map((a) => ({
            id: a.id,
            kind: a.kind,
            severity: a.severity,
            serverId: a.serverId,
            serverName: a.serverName,
            ...describeAnomaly(a),
            firstDetectedAt: a.firstDetectedAt,
            lastSeenAt: a.lastSeenAt,
        }));
        return NextResponse.json({ days, items });
    } catch (error) {
        Logger.error("Failed to fetch anomalies:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
