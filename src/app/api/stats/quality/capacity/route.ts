import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-guard";
import { parseUploadCapacity, setUploadCapacityMbps } from "@/lib/stats/server-quality-capacity";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Owner-only: set (or clear with null) the WAN upload capacity the quality
 * panel compares peak remote bandwidth against. Body: { mbps: number | null }.
 */
export async function POST(request: Request) {
    const user = await requireOwner(request);
    if (!user) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (typeof body !== "object" || body === null || !("mbps" in body)) {
        return NextResponse.json({ error: "Missing mbps" }, { status: 400 });
    }

    const parsed = parseUploadCapacity((body as { mbps: unknown }).mbps);
    if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
        setUploadCapacityMbps(parsed.value);
        return NextResponse.json({ capacityMbps: parsed.value });
    } catch (error) {
        Logger.error("Failed to save WAN upload capacity:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
