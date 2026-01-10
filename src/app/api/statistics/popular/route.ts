import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const range = searchParams.get("range") || "24h";
        const type = searchParams.get("type"); // 'movie', 'episode', or 'show'
        const sort = searchParams.get("sort") || "unique_users"; // 'unique_users' or 'total_plays'

        const { getPopularStats } = await import("@/lib/statistics");
        const results = await getPopularStats(range, type, sort);

        return NextResponse.json({
            range,
            data: results
        });

    } catch (error) {
        console.error("Failed to fetch popular stats:", error);
        return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }
}
