import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { getPauseStats } from "@/lib/stats/viewing-behaviour-pauses";
import { respondWithBehaviourStats, unauthorized } from "@/lib/stats/viewing-behaviour-route";

export const dynamic = "force-dynamic";

/** Pause intensity per client and title, with likely-buffering flags. ?days&serverId&limit */
export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) return unauthorized();
    return respondWithBehaviourStats(request, user, "pauses", getPauseStats);
}
