import { NextRequest, NextResponse } from "next/server";
import { getRuleServers, toggleServerRule } from "@/lib/rules";

interface Props {
    params: Promise<{
        id: string;
    }>
}

export async function GET(req: NextRequest, props: Props) {
    const params = await props.params;
    try {
        const servers = getRuleServers(params.id);
        return NextResponse.json(servers);
    } catch (error) {
        console.error("Failed to fetch rule servers:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: Props) {
    const params = await props.params;
    try {
        const { serverId, enabled } = await req.json();
        if (!serverId || typeof enabled !== "boolean") {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        toggleServerRule(serverId, params.id, enabled);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to update rule servers:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}
