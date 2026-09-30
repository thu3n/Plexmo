import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { getBingeStats } from "@/lib/stats/viewing-behaviour-binge";
import { respondWithBehaviourStats, unauthorized } from "@/lib/stats/viewing-behaviour-route";

export const dynamic = "force-dynamic";

/** Binge runs, top binged shows and longest binges. ?days&serverId&limit */
export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) return unauthorized();
    return respondWithBehaviourStats(request, user, "binges", getBingeStats);
}
