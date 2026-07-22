import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";
import { Logger } from "@/lib/logger";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: "Missing job ID" }, { status: 400 });
        }

        const job = getJob(id);

        if (!job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        return NextResponse.json({ job });

    } catch (error: any) {
        Logger.error("Get Job Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
