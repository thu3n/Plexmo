import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSetting, setSetting } from "@/lib/settings";
import { verifyToken } from "@/lib/jwt";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// Authentication check helper
async function isAuthenticated() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return false;
    const user = await verifyToken(token);
    return !!user;
}

export async function GET() {
    if (!await isAuthenticated()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = getSetting("API_KEY");
    return NextResponse.json({ apiKey: apiKey || null });
}

export async function POST() {
    if (!await isAuthenticated()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate new 32-byte hex key
    const newKey = randomBytes(32).toString("hex");
    setSetting("API_KEY", newKey);

    return NextResponse.json({ apiKey: newKey });
}
