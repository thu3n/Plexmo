import { NextResponse } from "next/server";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { BEHAVIOUR_MEDIA_TYPES, type BehaviourMediaType } from "@/lib/stats/viewing-behaviour";
import { getCompletionStats } from "@/lib/stats/viewing-behaviour-completion";
import { respondWithBehaviourStats, unauthorized } from "@/lib/stats/viewing-behaviour-route";

export const dynamic = "force-dynamic";

/** Completion rate per title + drop-off histogram. ?type=movie|show&days&serverId&limit */
export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) return unauthorized();

    const type = new URL(request.url).searchParams.get("type") as BehaviourMediaType | null;
    if (!type || !BEHAVIOUR_MEDIA_TYPES.includes(type)) {
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    return respondWithBehaviourStats(request, user, "completion", (params) => getCompletionStats(type, params), { type });
}
