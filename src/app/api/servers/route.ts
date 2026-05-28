import { createServer, listAllServers } from "@/lib/servers";
import { normalizePlexUrl } from "@/lib/plex";
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
  try {
    const body = await request.json();
    const rawUrl = String(body.baseUrl || "").trim();
    const baseUrl = normalizePlexUrl(rawUrl);
    const token = String(body.token || "").trim();
    const name = body.name ? String(body.name).trim() : undefined;
    const color = body.color ? String(body.color).trim() : undefined;

    if (!baseUrl || !token) {
      return NextResponse.json(
        { error: "Ange både server-URL och token." },
        { status: 400 },
      );
    }

    const server = await createServer({ baseUrl, token, name, color });
    deleteServerSnapshot(server.id);
    runCronJob().catch((err) => Logger.error("Post-create cron kick failed:", err));
    return NextResponse.json({ server }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ett okänt fel uppstod";
    Logger.error("Create server failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
