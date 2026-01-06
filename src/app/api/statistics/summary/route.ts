import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
// import { calculateStreaks } from "@/lib/user_stats";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const range = searchParams.get("range") || "24h";

        let cutoff = 0;
        const now = Date.now();

        switch (range) {
            case "24h":
                cutoff = now - (24 * 60 * 60 * 1000);
                break;
            case "7d":
                cutoff = now - (7 * 24 * 60 * 60 * 1000);
                break;
            case "30d":
                cutoff = now - (30 * 24 * 60 * 60 * 1000);
                break;
            case "90d":
                cutoff = now - (90 * 24 * 60 * 60 * 1000);
                break;
            case "all":
                cutoff = 0;
                break;
            default:
                cutoff = now - (24 * 60 * 60 * 1000);
        }

        // Fetch aggregation data
        // We use a single query to get the raw data then aggregate in JS for flexibility
        // or we can use specific SQL queries. 
        // For performance on large datasets, SQL is better.

        // 1. Summary Metrics
        const summaryQuery = `
            SELECT 
                COUNT(*) as totalPlays,
                COUNT(DISTINCT user) as uniqueUsers,
                SUM(duration) as totalDurationMs
            FROM activity_history 
            WHERE startTime > ?
        `;

        const summary = db.prepare(summaryQuery).get(cutoff) as any;

        const totalPlays = summary.totalPlays || 0;
        const uniqueUsers = summary.uniqueUsers || 0;
        // duration is in seconds in DB, not ms
        const totalDurationHours = Math.round((summary.totalDurationMs || 0) / 60 / 60);

        // 2. Top Users
        const topUsersQuery = `
            SELECT 
                user, 
                COUNT(*) as playCount,
                MAX(startTime) as lastWatched
            FROM activity_history 
            WHERE startTime > ?
            GROUP BY user
            ORDER BY playCount DESC
            LIMIT 10
        `;

        const topUsers = db.prepare(topUsersQuery).all(cutoff) as any[];

        // Attempt to find user thumbs if possible?
        // Since we don't have a users table with thumbs linked easily here, we'll return what we have.
        // The frontend can generate initials or use a default avatar.

        // Format top users
        const formattedTopUsers = topUsers.map(u => ({
            username: u.user,
            plays: u.playCount,
            lastWatched: u.lastWatched,
            thumb: null // We don't have a reliable source for user thumb in history yet
        }));

        // 3. Top Streaks Calculation - MOVED to /api/statistics/streaks

        return NextResponse.json({
            range,
            totalPlays,
            uniqueUsers,
            totalDurationHours,
            topUsers: formattedTopUsers,
            // topStreaks no longer returned here
        });

    } catch (error) {
        console.error("Failed to fetch summary stats:", error);
        return NextResponse.json({ error: "Failed to fetch summary stats" }, { status: 500 });
    }
}
