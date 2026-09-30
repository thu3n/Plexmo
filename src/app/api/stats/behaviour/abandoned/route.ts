import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { getAbandonedSeries } from "@/lib/stats/viewing-behaviour-abandoned";
import { respondWithBehaviourStats, unauthorized } from "@/lib/stats/viewing-behaviour-route";

export const dynamic = "force-dynamic";

/** Series users stopped mid-season and haven't returned to. ?days&serverId&limit */
export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) return unauthorized();
    return respondWithBehaviourStats(request, user, "abandoned", getAbandonedSeries);
}
