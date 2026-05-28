
import { NextResponse } from "next/server";
import { getServerCount } from "@/lib/servers";
import { Logger } from "@/lib/logger";

export async function GET() {
    try {
        // We are configured once at least one server exists.
        const isConfigured = getServerCount() > 0;

        return NextResponse.json({ configured: isConfigured });
    } catch (error) {
        Logger.error("Failed to check setup status:", error);
        return NextResponse.json({ configured: false }, { status: 500 });
    }
}
