import { NextResponse } from "next/server";
import { runCronJob } from "@/lib/cron";
import { requireOwner } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";

// Force dynamic to ensure it runs every time
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    // Manual sync trigger. External schedulers authenticate with the API key,
    // which resolves to an owner-like scope.
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const result = await runCronJob();
        return NextResponse.json(result);
    } catch (error) {
        Logger.error("Cron sync failed:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
