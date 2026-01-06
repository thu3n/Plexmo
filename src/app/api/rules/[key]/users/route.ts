import { NextRequest, NextResponse } from "next/server";
import { getRuleUsers, toggleUserRule } from "@/lib/rules";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ key: string }> }
) {
    const { key } = await params;
    const users = getRuleUsers(key);
    return NextResponse.json(users);
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ key: string }> }
) {
    const { key } = await params;
    try {
        const body = await req.json();
        const { userId, enabled } = body;

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        toggleUserRule(userId, key, Boolean(enabled));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating user rule:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
