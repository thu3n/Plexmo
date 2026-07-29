import { NextResponse } from "next/server";
import { getJobs } from "@/lib/jobs";
import { requireOwner } from "@/lib/auth-guard";

export async function GET(request: Request) {
    // Job progress belongs to the import/admin surface.
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const jobs = getJobs();
        return NextResponse.json({ jobs });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load jobs";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
