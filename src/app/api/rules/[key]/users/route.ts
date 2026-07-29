import { NextRequest, NextResponse } from "next/server";
import { getRuleUsers, getRuleInstance, toggleUserRule } from "@/lib/rules";
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
    const users = getRuleUsers(key);
    return NextResponse.json(users);
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
        const { userId, enabled } = body;

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        // user_rules carries no foreign key, so an unknown rule would silently
        // accumulate orphan assignment rows.
        if (!getRuleInstance(key)) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }

        toggleUserRule(userId, key, Boolean(enabled));
        return NextResponse.json({ success: true });
    } catch (error) {
        Logger.error("Error updating user rule:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
