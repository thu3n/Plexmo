import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings";
import { verifyToken } from "@/lib/jwt";

export async function GET(req: NextRequest) {
    const expiryStr = getSetting("MAINTENANCE_EXPIRY");

    if (!expiryStr) {
        return NextResponse.json({ active: false });
    }

    const expiry = parseInt(expiryStr, 10);
    const active = Date.now() < expiry;

    return NextResponse.json({ active });
}

export async function POST(req: NextRequest) {
    const token = req.cookies.get("token")?.value;
    let session = null;
    if (token) {
        session = await verifyToken(token);
    }

    const expiryStr = getSetting("MAINTENANCE_EXPIRY");
    const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;
    const isMaintenanceActive = Date.now() < expiry;

    // Authorization Rule:
    // 1. If currently authenticated -> Allowed.
    // 2. If Maintenance is ACTIVE -> Allowed (Guest Ops to re-lock the door).
    // 3. Otherwise -> Denied.
    if (!session && !isMaintenanceActive) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { duration, enabled } = body;

        // ENABLE AUTH (Disable Maintenance)
        if (enabled === true) {
            setSetting("MAINTENANCE_EXPIRY", "0");
            return NextResponse.json({ success: true, message: "Authentication re-enabled" });
        }

        // DISABLE AUTH (Enable Maintenance)
        if (duration && typeof duration === "number") {
            const newExpiry = Date.now() + (duration * 1000);
            setSetting("MAINTENANCE_EXPIRY", newExpiry.toString());
            return NextResponse.json({ success: true, expiry: newExpiry });
        }

        return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });

    } catch (error) {
        console.error("Failed to set maintenance mode:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
