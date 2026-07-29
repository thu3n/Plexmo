import { NextRequest, NextResponse } from "next/server";
import { getRuleServers, getRuleInstance, toggleServerRule } from "@/lib/rules";
import { requireOwner } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ key: string }> }
) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { key } = await params;
    const servers = getRuleServers(key);
    return NextResponse.json(servers);
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ key: string }> }
) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { key } = await params;
    try {
        const body = await req.json();
        const { serverId, enabled } = body;

        if (!serverId) {
            return NextResponse.json({ error: "Missing serverId" }, { status: 400 });
        }

        // server_rules carries no foreign key, so an unknown rule would silently
        // accumulate orphan assignment rows.
        if (!getRuleInstance(key)) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }

        toggleServerRule(serverId, key, Boolean(enabled));
        return NextResponse.json({ success: true });
    } catch (error) {
        Logger.error("Error updating server rule:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
