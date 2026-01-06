import { NextResponse } from "next/server";
import { getUserStats } from "@/lib/user_stats";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username) {
        return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    try {
        const stats = getUserStats(username);
        return NextResponse.json(stats);
    } catch (error) {
        console.error("Failed to fetch user stats:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
