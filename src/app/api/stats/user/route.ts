import { NextResponse } from "next/server";
import { getUserStats } from "@/lib/user_stats";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
