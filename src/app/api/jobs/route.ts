import { NextResponse } from "next/server";
import { getJobs } from "@/lib/jobs";

export async function GET() {
    try {
        const jobs = getJobs();
        return NextResponse.json({ jobs });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load jobs";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
