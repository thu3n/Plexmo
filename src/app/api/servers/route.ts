import { createServer, listAllServers, getServerById, setServerOwner } from "@/lib/servers";
import { connectToServer } from "@/lib/plex-listener";
import { backfillServerIdentities } from "@/lib/server-identity-backfill";
import { normalizePlexUrl } from "@/lib/plex";
import { getPlexUser } from "@/lib/auth";
import { reattributeOwnerAlias } from "@/lib/identity";
import { authorizeApiKeyOrSession, isOwnerLike } from "@/lib/auth-guard";
import { canUpgradeSessionToOwner } from "@/lib/authz";
import { startTrackedLibrarySync } from "@/lib/library/sync-job";
import { syncServerLibraries } from "@/lib/library/library-sync";
import { createSession, verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { Logger } from "@/lib/logger";
import {
  deleteServerSnapshot,
  getServerFailure,
  getServerSnapshot,
} from "@/lib/dashboard-cache";
import { runCronJob } from "@/lib/cron";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const servers = await listAllServers();
    // Enrich with runtime reachability status from the dashboard cache.
    // A server is "unreachable" if the most recent cron attempt failed
    // and we have no successful snapshot to fall back to.
    const enriched = servers.map((s) => {
      const failure = getServerFailure(s.id);
      const snapshot = getServerSnapshot(s.id);
      if (failure && !snapshot) {
        return { ...s, status: "unreachable" as const, statusMessage: failure.message };
      }
      return { ...s, status: "ok" as const };
    });
    return NextResponse.json({ servers: enriched }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ett okänt fel uppstod";
    Logger.error("List servers failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Instance administration: owners, first-run setup sessions and API keys —
  // plus invite-minted `onboarding` sessions, which are authorized to ADD
  // their own server by the consumed invite (and nothing else).
  const user = await authorizeApiKeyOrSession(request);
  if (!user || !(isOwnerLike(user) || user.scope.role === "onboarding")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const rawUrl = String(body.baseUrl || "").trim();
    const baseUrl = normalizePlexUrl(rawUrl);
    const token = String(body.token || "").trim();
    const name = body.name ? String(body.name).trim() : undefined;
    const color = body.color ? String(body.color).trim() : undefined;

    if (!baseUrl || !token) {
      return NextResponse.json(
        { error: "Enter both server URL and token." },
        { status: 400 },
      );
    }

    const server = await createServer({ baseUrl, token, name, color });
    deleteServerSnapshot(server.id);

    // Resolve the server owner's plex.tv id right away (normally lazily
    // backfilled at next login). The submitted token is the server's admin
    // token, so its account IS the owner. Network failure must not fail the
    // creation — the lazy backfill covers it later.
    let ownerAccountId: string | null = null;
    try {
      const owner = await getPlexUser(token);
      ownerAccountId = owner.id;
      setServerOwner(server.id, owner.id);
      reattributeOwnerAlias(server.id, owner.id);
    } catch {
      Logger.warn(`[Servers] Could not resolve owner for new server ${server.id}; will backfill at login.`);
    }

    runCronJob().catch((err) => Logger.error("Post-create cron kick failed:", err));

    // Real-time must not wait for a process restart: wire the WebSocket and
    // backfill the natural key/owner cache for the new (or revived) server.
    const fresh = await getServerById(server.id);
    if (fresh) {
      connectToServer(fresh);
      // Library inventory for the new server must not wait for the 6-hour
      // cycle either — a fresh install would show "No libraries synced yet"
      // until restart. Tracked so it shows up under Settings → Jobs.
      startTrackedLibrarySync(fresh.name, () => syncServerLibraries(fresh));
    }
    backfillServerIdentities().catch((err) => Logger.error("Post-create identity backfill failed:", err));

    const response = NextResponse.json({ server }, { status: 201 });

    // First-server completion: the user just connected a server they provably
    // own (their token resolved to their own account) — upgrade the session to
    // a normal 7-day owner session. Applies to invite-minted `onboarding`
    // sessions AND fresh-install `setup` sessions: without this, the setup
    // cookie 401s on every data route as soon as the server exists, until the
    // user logs out and back in.
    if (canUpgradeSessionToOwner(user.scope.role, ownerAccountId, user.id)) {
      const cookieStore = await cookies();
      const rawCookie = cookieStore.get("token")?.value;
      const session = rawCookie ? await verifyToken(rawCookie) : null;
      if (session) {
        const jwt = await createSession({ ...session, role: "owner" });
        response.cookies.set("token", jwt, {
          httpOnly: true,
          secure: new URL(request.url).protocol === "https:",
          maxAge: 60 * 60 * 24 * 7,
          path: "/",
          sameSite: "lax",
        });
      }
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    Logger.error("Create server failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
