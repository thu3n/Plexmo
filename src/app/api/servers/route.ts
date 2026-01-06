import { createServer, listAllServers } from "@/lib/servers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const servers = await listAllServers();
    return NextResponse.json({ servers }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ett okänt fel uppstod";
    console.error("List servers failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const baseUrl = String(body.baseUrl || "").trim();
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
    return NextResponse.json({ server }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ett okänt fel uppstod";
    console.error("Create server failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
