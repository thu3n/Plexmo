
import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings"; // Or DB directly if preferred

export async function GET() {
    try {
        // We need to check if ANY servers exist.
        // We can import the DB logic here.
        const { db } = await import("@/lib/db");
        // Check count of servers
        const count = db.prepare("SELECT COUNT(*) as count FROM servers").get() as { count: number };

        // console.log(`[API] Setup Status Check: Found ${count.count} servers.`);
        const isConfigured = count.count > 0;

        return NextResponse.json({ configured: isConfigured });
    } catch (error) {
        console.error("Failed to check setup status:", error);
        return NextResponse.json({ configured: false }, { status: 500 });
    }
}
