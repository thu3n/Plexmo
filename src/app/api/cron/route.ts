import { NextResponse } from "next/server";
import { runCronJob } from "@/lib/cron";

// Force dynamic to ensure it runs every time
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const result = await runCronJob();
        return NextResponse.json(result);
    } catch (error) {
        console.error("Cron sync failed:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
