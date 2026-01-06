import { getDashboardSnapshot } from "@/lib/plex";
import { getServerForDashboard } from "@/lib/servers";
import { NextResponse } from "next/server";
import { checkAndLogViolations } from "@/lib/rules";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get("serverId") ?? undefined;

    if (serverId) {
      // Fetch single server (legacy/specific behavior)
      const server = await getServerForDashboard(serverId);
      if (!server) {
        return NextResponse.json(
          { error: "Ingen Plex-server har lagts till ännu." },
          { status: 404 },
        );
      }

      const snapshot = await getDashboardSnapshot({
        id: server.id,
        name: server.name,
        baseUrl: server.baseUrl,
        token: server.token,
      });

      return NextResponse.json(
        {
          ...snapshot,
          server: {
            id: server.id,
            name: server.name,
            baseUrl: server.baseUrl,
          },
        },
        { status: 200 },
      );
    }

    // Fetch ALL servers (Unified Dashboard)
    const db = (await import("@/lib/db")).db;
    const servers = db.prepare("SELECT * FROM servers").all() as any[];

    if (!servers.length) {
      return NextResponse.json({
        sessions: [],
        summary: { active: 0, directPlay: 0, transcoding: 0, paused: 0, bandwidth: 0, serverName: "Alla servrar" },
        libraries: [],
        updatedAt: new Date().toISOString(),
        server: { id: "all", name: "Alla servrar", baseUrl: "" },
        appName: (await import("@/lib/settings")).getSetting("APP_NAME") || "Plexmo"
      });
    }

    const results = await Promise.allSettled(
      servers.map((server) =>
        getDashboardSnapshot({
          id: server.id,
          name: server.name,
          baseUrl: server.baseUrl,
          token: server.token,
        }).then(snapshot => ({ ...snapshot, serverId: server.id }))
      )
    );

    // Aggregate results
    const successResults = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    // console.log(`Aggregating ${successResults.length} servers. Found ${successResults.reduce((acc, r) => acc + r.sessions.length, 0)} sessions.`);

    const aggregated = {
      sessions: successResults.flatMap(r => r.sessions),
      summary: successResults.reduce((acc, curr) => ({
        active: acc.active + curr.summary.active,
        directPlay: acc.directPlay + curr.summary.directPlay,
        transcoding: acc.transcoding + curr.summary.transcoding,
        paused: acc.paused + curr.summary.paused,
        bandwidth: acc.bandwidth + curr.summary.bandwidth,
        serverName: "Alla servrar"
      }), { active: 0, directPlay: 0, transcoding: 0, paused: 0, bandwidth: 0 }),
      libraries: successResults.flatMap((r) =>
        r.libraries.map((lib: any) => ({
          ...lib,
          title: lib.title,
          serverId: r.serverId,
          serverName: servers.find((s: any) => s.id === r.serverId)?.name
        }))
      ),
      updatedAt: new Date().toISOString(),
      server: {
        id: "all",
        name: "Alla servrar",
        baseUrl: "unified"
      },
      appName: successResults.find(r => r.appName)?.appName || "Plexmo"
    };

    // Check rules on aggregated sessions
    checkAndLogViolations(aggregated.sessions);

    return NextResponse.json(aggregated, { status: 200 });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Ett okänt fel uppstod";
    console.error("Plex dashboard fetch failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
