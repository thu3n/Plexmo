import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSetting, setSetting } from "@/lib/settings";
import { requireOwner } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    // Owner-only: this key grants full API access, so reading or rotating it
    // is instance administration — not something a viewer session may do.
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiKey = getSetting("API_KEY");
    return NextResponse.json({ apiKey: apiKey || null });
}

export async function POST(request: Request) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Generate new 32-byte hex key
    const newKey = randomBytes(32).toString("hex");
    setSetting("API_KEY", newKey);

    return NextResponse.json({ apiKey: newKey });
}
