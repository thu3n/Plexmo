
import { NextResponse } from "next/server";
import { hasCompletedSetup } from "@/lib/servers";
import { Logger } from "@/lib/logger";

export async function GET() {
    try {
        // Configured once a server has ever been added. Archived servers still
        // count — removing the last one must not re-open unauthenticated setup.
        const isConfigured = hasCompletedSetup();

        return NextResponse.json({ configured: isConfigured });
    } catch (error) {
        Logger.error("Failed to check setup status:", error);
        return NextResponse.json({ configured: false }, { status: 500 });
    }
}
