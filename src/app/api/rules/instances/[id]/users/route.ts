import { NextRequest, NextResponse } from "next/server";
import { getRuleUsers, toggleUserRule } from "@/lib/rules";

interface Props {
    params: Promise<{
        id: string;
    }>
}

export async function GET(req: NextRequest, props: Props) {
    const params = await props.params;
    try {
        const users = getRuleUsers(params.id);
        return NextResponse.json(users);
    } catch (error) {
        console.error("Failed to fetch rule users:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, props: Props) {
    const params = await props.params;
    try {
        const { userId, enabled } = await req.json();
        if (!userId || typeof enabled !== "boolean") {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        toggleUserRule(userId, params.id, enabled);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to update rule users:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}
