import { deleteServer, updateServer } from "@/lib/servers";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  try {
    await deleteServer(params.id);
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
  const params = await props.params;
  try {
    const body = await request.json();
    const updated = await updateServer(params.id, {
      name: body.name,
      baseUrl: body.baseUrl,
      token: body.token,
      color: body.color,
    });
    return NextResponse.json({ server: updated }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kunde inte uppdatera servern";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
