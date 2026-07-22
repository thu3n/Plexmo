import { getServerToken } from "@/lib/servers";
import { requireOwner } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";
import { NextResponse } from "next/server";

// Returns the raw Plex token for a server so the settings UI can reveal/copy it.
// Owner-only: viewers must never be able to exfiltrate server credentials.
// Never log the token value.
export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  if (!(await requireOwner(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const params = await props.params;
  try {
    const token = await getServerToken(params.id);
    if (!token) {
      return NextResponse.json({ error: "Server or token not found" }, { status: 404 });
    }
    return NextResponse.json({ token }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read token";
    Logger.error("Read server token failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
