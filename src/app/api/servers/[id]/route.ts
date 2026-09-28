import { deleteServer, updateServer, setServerDisabled, getServerById, type ServerUpdateInput } from "@/lib/servers";
import { disconnectFromServer } from "@/lib/plex-listener";
import { deleteServerSnapshot } from "@/lib/dashboard-cache";
import { normalizePlexUrl } from "@/lib/plex";
import { parseServerColor } from "@/lib/serverColors";
import { isMaskedToken } from "@/lib/server-token-mask";
import { refreshServerMonitoring } from "@/lib/server-monitoring";
import { requireOwner } from "@/lib/auth-guard";
import { NextResponse } from "next/server";

const MAX_NAME_LENGTH = 100;

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
    const message = error instanceof Error ? error.message : "Could not remove the server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type ParsedUpdate = { update: ServerUpdateInput; disabled?: boolean } | { error: string };

/** Shape-check the untrusted PUT body; absent fields mean "leave unchanged". */
const parseUpdateBody = (body: unknown): ParsedUpdate => {
  const record = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const update: ServerUpdateInput = {};

  if (record.name !== undefined) {
    if (typeof record.name !== "string" || !record.name.trim() || record.name.length > MAX_NAME_LENGTH) {
      return { error: `Name must be 1-${MAX_NAME_LENGTH} characters.` };
    }
    update.name = record.name;
  }
  if (record.baseUrl !== undefined) {
    if (typeof record.baseUrl !== "string" || !record.baseUrl.trim()) {
      return { error: "Enter the server URL." };
    }
    update.baseUrl = normalizePlexUrl(record.baseUrl);
  }
  // A masked placeholder is never a credential — storing it would break the server.
  if (record.token !== undefined && !isMaskedToken(record.token)) {
    if (typeof record.token !== "string" || !record.token.trim()) {
      return { error: "Enter the server token." };
    }
    update.token = record.token.trim();
  }
  if (record.color !== undefined) {
    const color = parseServerColor(record.color);
    if (color === undefined) return { error: "Color must be a hex value like #34D399." };
    update.color = color;
  }
  if (record.disabled !== undefined && typeof record.disabled !== "boolean") {
    return { error: "disabled must be true or false." };
  }
  return { update, disabled: record.disabled as boolean | undefined };
};

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  if (!(await requireOwner(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const params = await props.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = parseUpdateBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existing = await getServerById(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Server not found." }, { status: 404 });
  }

  try {
    let updated = await updateServer(params.id, parsed.update);
    if (parsed.disabled !== undefined) {
      const toggled = setServerDisabled(params.id, parsed.disabled);
      if (!toggled) {
        return NextResponse.json({ error: "A removed server cannot be paused." }, { status: 409 });
      }
      updated = toggled;
    }

    await refreshServerMonitoring(params.id);
    return NextResponse.json({ server: updated }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
