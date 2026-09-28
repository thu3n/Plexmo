import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-guard";
import { getScheduledTasks } from "@/lib/scheduled-tasks";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Recurring background tasks with last/next run estimates (Settings → Jobs). */
export async function GET(request: Request) {
    // Same audience as /api/jobs: instance administration.
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        return NextResponse.json({ tasks: getScheduledTasks() });
    } catch (error) {
        Logger.error("Failed to load scheduled tasks:", error);
        return NextResponse.json({ error: "Failed to load scheduled tasks" }, { status: 500 });
    }
}
