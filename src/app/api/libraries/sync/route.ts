import { NextResponse } from "next/server";
import { authorizeApiKeyOrSession, isOwnerLike } from "@/lib/auth-guard";
import { startTrackedLibrarySync } from "@/lib/library/sync-job";
import { syncAllLibraries } from "@/lib/library/library-sync";

export const dynamic = "force-dynamic";

/**
 * Manual library sync trigger ("Sync now"). Owner-gated on purpose — the
 * jobs/cron read surfaces are open to any authenticated user, but kicking a
 * full inventory sweep is an administration action.
 */
export async function POST(request: Request) {
  const user = await authorizeApiKeyOrSession(request);
  if (!user || !isOwnerLike(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const started = startTrackedLibrarySync("all libraries", syncAllLibraries);
  if (!started) {
    return NextResponse.json({ error: "A library sync is already running" }, { status: 409 });
  }
  return NextResponse.json({ jobId: started.jobId }, { status: 202 });
}
