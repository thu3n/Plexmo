import { getDashboardSnapshot } from "@/lib/plex";
import { getServerForDashboard, listInternalServers } from "@/lib/servers";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { resolveScope, canAccessServer, type AccessScope } from "@/lib/authz";
import { Logger } from "@/lib/logger";
import {
  getServerSnapshot,
  setServerSnapshot,
  markServerFailure,
  getServerFailure,
  type CachedServerSnapshot,
} from "@/lib/dashboard-cache";

// How long to honour a cached failure before allowing another live prime attempt.
// Cron retries every 60s in the background regardless; this just protects
// request-thread prime-on-miss from re-stalling on dead servers.
const FAILURE_TTL_MS = 30_000;

type ServerForFetch = {
  id: string;
  name: string;
  baseUrl: string;
  token: string;
};

/**
 * Return the cached snapshot, or fetch one live on a miss. Failures are
 * cached for FAILURE_TTL_MS so dead servers can't stall every request.
 */
async function primeOnMiss(server: ServerForFetch): Promise<CachedServerSnapshot> {
  const cached = getServerSnapshot(server.id);
  if (cached) return cached;

  const failure = getServerFailure(server.id);
  if (failure && Date.now() - failure.failedAt < FAILURE_TTL_MS) {
    throw new Error(failure.message);
  }

  try {
    const snapshot = await getDashboardSnapshot({
      id: server.id,
      name: server.name,
      baseUrl: server.baseUrl,
      token: server.token,
    });
    setServerSnapshot(server.id, snapshot);
    return getServerSnapshot(server.id)!;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    markServerFailure(server.id, message);
    throw err;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get("serverId") ?? undefined;

    // Opt-in viewer scoping: default scope is "all" (equal-access policy).
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const sessionUser = token ? await verifyToken(token) : null;
    const scope: AccessScope | null = sessionUser ? resolveScope(sessionUser) : null;

    if (serverId && scope && !canAccessServer(scope, serverId)) {
      return NextResponse.json({ error: "Forbidden: server outside your scope" }, { status: 403 });
    }

    if (serverId) {
      const server = await getServerForDashboard(serverId);
      if (!server) {
        return NextResponse.json(
          { error: "Ingen Plex-server har lagts till ännu." },
          { status: 404 },
        );
      }

      const snapshot = await primeOnMiss({
        id: server.id,
        name: server.name,
        baseUrl: server.baseUrl,
        token: server.token,
      });

      return NextResponse.json(
        {
          sessions: snapshot.sessions,
          summary: snapshot.summary,
          updatedAt: new Date(snapshot.cachedAt).toISOString(),
          appName: snapshot.appName,
          server: {
            id: server.id,
            name: server.name,
            baseUrl: server.baseUrl,
          },
        },
        { status: 200 },
      );
    }

    const allServers = await listInternalServers();
    const servers =
      scope && scope.serverIds !== "all"
        ? allServers.filter((s) => canAccessServer(scope, s.id))
        : allServers;

    if (!servers.length) {
      return NextResponse.json({
        sessions: [],
        summary: { active: 0, directPlay: 0, directStream: 0, transcoding: 0, paused: 0, bandwidth: 0, serverName: "Alla servrar" },
        updatedAt: new Date().toISOString(),
        server: { id: "all", name: "Alla servrar", baseUrl: "" },
        appName: (await import("@/lib/settings")).getSetting("APP_NAME") || "Plexmo"
      });
    }

    // Aggregated view: cache-first with prime-on-miss, so a fresh restart or a
    // newly added server shows streams immediately instead of silently missing
    // until the next cron tick. Unreachable servers never block the request —
    // their prime attempt fails fast (failure TTL) and they are skipped.
    const primed = await Promise.allSettled(
      servers.map((server) =>
        primeOnMiss({
          id: server.id,
          name: server.name,
          baseUrl: server.baseUrl,
          token: server.token,
        }),
      ),
    );
    const snapshots = primed
      .filter((r): r is PromiseFulfilledResult<CachedServerSnapshot> => r.status === "fulfilled")
      .map((r) => r.value);

    const aggregated = {
      sessions: snapshots.flatMap((s) => s.sessions),
      summary: snapshots.reduce(
        (acc, s) => ({
          active: acc.active + s.summary.active,
          directPlay: acc.directPlay + s.summary.directPlay,
          directStream: acc.directStream + (s.summary.directStream ?? 0),
          transcoding: acc.transcoding + s.summary.transcoding,
          paused: acc.paused + s.summary.paused,
          bandwidth: acc.bandwidth + s.summary.bandwidth,
          serverName: "Alla servrar",
        }),
        { active: 0, directPlay: 0, directStream: 0, transcoding: 0, paused: 0, bandwidth: 0 },
      ),
      updatedAt: new Date(
        snapshots.length
          ? Math.min(...snapshots.map((s) => s.cachedAt))
          : Date.now(),
      ).toISOString(),
      server: {
        id: "all",
        name: "Alla servrar",
        baseUrl: "unified",
      },
      appName: snapshots.find((s) => s.appName)?.appName || "Plexmo",
    };

    // NOTE: rule enforcement deliberately does NOT run here. The dashboard is
    // polled every 5s per open tab — enforcement runs solely in the serialized
    // cron pipeline (src/lib/cron.ts) to avoid double-terminations.

    return NextResponse.json(aggregated, { status: 200 });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Ett okänt fel uppstod";
    Logger.error("Plex dashboard fetch failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
