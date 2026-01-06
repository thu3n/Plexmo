import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCachedStreaks } from "@/lib/user_stats";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const now = Date.now();

        // 3. Top Streaks Calculation
        // Get users active in the last 60 days to check for streaks (optimization)
        const streakCutoff = now - (60 * 24 * 60 * 60 * 1000);
        const activeUsersQuery = `
            SELECT DISTINCT user, userId 
            FROM activity_history 
            WHERE startTime > ?
        `;
        const activeUsers = db.prepare(activeUsersQuery).all(streakCutoff) as { user: string; userId: string }[];

        // Deduplicate users by username, preferring those with a userId if multiple exist
        const uniqueUsersMap = new Map<string, { user: string; userId: string }>();

        activeUsers.forEach(u => {
            const existing = uniqueUsersMap.get(u.user);
            if (!existing) {
                uniqueUsersMap.set(u.user, u);
            } else if (!existing.userId && u.userId) {
                // Replace entry with one that has a userId
                uniqueUsersMap.set(u.user, u);
            }
        });

        const streaks = Array.from(uniqueUsersMap.values()).map(u => {
            const s = getCachedStreaks({ username: u.user, userId: u.userId || "" }); // Handle null userId
            return {
                username: u.user,
                userId: u.userId,
                currentStreak: s.current,
                longestStreak: s.longest
            };
        });

        // Filter out 0 streaks and sort
        const topStreaks = streaks
            .filter(s => s.currentStreak > 0)
            .sort((a, b) => b.currentStreak - a.currentStreak)
            .slice(0, 10);

        return NextResponse.json({
            topStreaks
        });

    } catch (error) {
        console.error("Failed to fetch streak stats:", error);
        return NextResponse.json({ error: "Failed to fetch streak stats" }, { status: 500 });
    }
}
