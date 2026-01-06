import { NextRequest, NextResponse } from "next/server";
import { getRuleServers, toggleServerRule } from "@/lib/rules";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ key: string }> }
) {
    const { key } = await params;
    const servers = getRuleServers(key);
    return NextResponse.json(servers);
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ key: string }> }
) {
    const { key } = await params;
    try {
        const body = await req.json();
        const { serverId, enabled } = body;

        if (!serverId) {
            return NextResponse.json({ error: "Missing serverId" }, { status: 400 });
        }

        toggleServerRule(serverId, key, Boolean(enabled));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating server rule:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
