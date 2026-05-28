import { getDashboardSnapshot } from "@/lib/plex";
import { getServerForDashboard, listInternalServers } from "@/lib/servers";
import { NextResponse } from "next/server";
import { checkAndLogViolations } from "@/lib/rules";
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

// Used only by the single-server branch (when a user explicitly asks for one server).
// The aggregated branch never primes live — it just reads what the worker has.
async function primeOnMissForSingleServer(server: ServerForFetch): Promise<CachedServerSnapshot> {
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

    if (serverId) {
      const server = await getServerForDashboard(serverId);
      if (!server) {
        return NextResponse.json(
          { error: "Ingen Plex-server har lagts till ännu." },
          { status: 404 },
        );
      }

      const snapshot = await primeOnMissForSingleServer({
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

    const servers = await listInternalServers();

    if (!servers.length) {
      return NextResponse.json({
        sessions: [],
        summary: { active: 0, directPlay: 0, transcoding: 0, paused: 0, bandwidth: 0, serverName: "Alla servrar" },
        updatedAt: new Date().toISOString(),
        server: { id: "all", name: "Alla servrar", baseUrl: "" },
        appName: (await import("@/lib/settings")).getSetting("APP_NAME") || "Plexmo"
      });
    }

    // Aggregated view: read-only from cache. Servers without a snapshot yet
    // are skipped (cron will fill them in the background). Unreachable servers
    // never block the request.
    const snapshots = servers
      .map((server) => getServerSnapshot(server.id))
      .filter((s): s is CachedServerSnapshot => s !== undefined);

    const aggregated = {
      sessions: snapshots.flatMap((s) => s.sessions),
      summary: snapshots.reduce(
        (acc, s) => ({
          active: acc.active + s.summary.active,
          directPlay: acc.directPlay + s.summary.directPlay,
          transcoding: acc.transcoding + s.summary.transcoding,
          paused: acc.paused + s.summary.paused,
          bandwidth: acc.bandwidth + s.summary.bandwidth,
          serverName: "Alla servrar",
        }),
        { active: 0, directPlay: 0, transcoding: 0, paused: 0, bandwidth: 0 },
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

    checkAndLogViolations(aggregated.sessions);

    return NextResponse.json(aggregated, { status: 200 });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Ett okänt fel uppstod";
    Logger.error("Plex dashboard fetch failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
