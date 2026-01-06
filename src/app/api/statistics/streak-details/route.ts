import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateStreaks } from "@/lib/user_stats";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const username = searchParams.get("username");
        const userId = searchParams.get("userId");

        if (!username) {
            return NextResponse.json({ error: "Username is required" }, { status: 400 });
        }

        // 1. Calculate the streak to get the valid dates
        const streaks = calculateStreaks({ username, userId: userId || "" });
        const dates = streaks.currentStreakDates || [];

        if (dates.length === 0) {
            return NextResponse.json({
                username,
                streakCount: 0,
                history: []
            });
        }

        // 2. Fetch history for each date
        const historyByDate = dates.map(date => {
            // Activity history stores timestamps in UTC (milliseconds) or seconds?
            // The table has `startTime` (INTEGER, unix epoch ms).
            // `strftime('%Y-%m-%d', datetime(startTime / 1000, 'unixepoch', 'localtime'))` was used to group.

            // We need to fetch items where the LOCAL date matches `date`.
            const query = `
                SELECT 
                    title,
                    duration,
                    meta_json,
                    datetime(startTime / 1000, 'unixepoch', 'localtime') as localTime
                FROM activity_history
                WHERE (user = ? OR userId = ?)
                AND strftime('%Y-%m-%d', datetime(startTime / 1000, 'unixepoch', 'localtime')) = ?
                ORDER BY startTime DESC
            `;

            const items = db.prepare(query).all(username, userId || "", date) as any[];

            // Format items
            const formattedItems = items.map(item => {
                let thumb = null;
                try {
                    const meta = JSON.parse(item.meta_json || "{}");
                    thumb = meta.thumb;
                } catch (e) { /* ignore */ }

                return {
                    title: item.title,
                    duration: item.duration,
                    thumb,
                    time: item.localTime
                };
            });

            // Calculate total duration for the day to confirm validation
            const totalDuration = items.reduce((acc, curr) => acc + (curr.duration || 0), 0);

            return {
                date,
                totalDuration,
                items: formattedItems
            };
        });

        // Sort history by date descending (newest first)
        historyByDate.reverse();

        return NextResponse.json({
            username,
            streakCount: streaks.current,
            history: historyByDate
        });

    } catch (error) {
        console.error("Failed to fetch streak details:", error);
        return NextResponse.json({ error: "Failed to fetch streak details" }, { status: 500 });
    }
}
