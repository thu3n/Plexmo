import { deleteServer, updateServer, getServerById } from "@/lib/servers";
import { connectToServer, disconnectFromServer } from "@/lib/plex-listener";
import { backfillServerIdentities } from "@/lib/server-identity-backfill";
import { deleteServerSnapshot } from "@/lib/dashboard-cache";
import { runCronJob } from "@/lib/cron";
import { requireOwner } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  if (!(await requireOwner(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const params = await props.params;
  try {
    // Soft-delete: archives the server so history survives and a later
    // re-add of the same physical server revives it.
    await deleteServer(params.id);
    disconnectFromServer(params.id);
    deleteServerSnapshot(params.id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte ta bort servern";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  if (!(await requireOwner(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const params = await props.params;
  try {
    const body = await request.json();
    const updated = await updateServer(params.id, {
      name: body.name,
      baseUrl: body.baseUrl,
      token: body.token,
      color: body.color,
    });
    deleteServerSnapshot(params.id);

    // Reconnect the WebSocket with the (possibly changed) URL/token.
    disconnectFromServer(params.id);
    const fresh = await getServerById(params.id);
    if (fresh) connectToServer(fresh);
    backfillServerIdentities().catch((err) => Logger.error("Post-update identity backfill failed:", err));

    runCronJob().catch((err) => Logger.error("Post-update cron kick failed:", err));
    return NextResponse.json({ server: updated }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte uppdatera servern";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
