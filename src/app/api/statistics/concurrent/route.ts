import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
            case "all":
                cutoff = 0;
                break;
            default:
                cutoff = now - (24 * 60 * 60 * 1000);
        }

        // Fetch history
        const rows = db.prepare(`
            SELECT 
                startTime, 
                duration, 
                user, 
                title, 
                device, 
                meta_json
            FROM activity_history 
            WHERE startTime > ? AND duration > 0
            ORDER BY startTime ASC
        `).all(cutoff) as any[];

        if (rows.length === 0) {
            return NextResponse.json({ count: 0, timestamp: null, sessions: [] });
        }

        const events: { time: number; type: number; session: any }[] = [];

        for (const row of rows) {
            const start = Number(row.startTime);
            const end = start + (Number(row.duration) * 1000); // Duration is in seconds

            // Simple user thumb fallback
            let userThumb = null;
            // We could try to extract user thumb from meta if available, or just rely on frontend fallback

            const sessionData = {
                user: row.user,
                title: row.title,
                player: row.device,
                thumb: null,
                userThumb: userThumb // We don't strictly have user thumb in history easily without join, skipping for performance or adding join if needed. 
                // Actually, existing snapshot had userThumb. Let's see if we can get it.
                // activity_history doesn't have userThumb column.
                // We can rely on frontend getting it or just use initials.
            };

            if (start && end && end > start) {
                events.push({ time: start, type: 1, session: sessionData });
                events.push({ time: end, type: -1, session: sessionData });
            }
        }

        // Sort: Time ASC, then Start (1) before End (-1) to maximize peak
        events.sort((a, b) => {
            if (a.time !== b.time) return a.time - b.time;
            return b.type - a.type;
        });

        let currentCount = 0;
        let maxCount = 0;
        let peakTime = 0;
        let activeSessions = new Set<any>(); // Track active objects
        let peakSessions: any[] = [];

        for (const e of events) {
            if (e.type === 1) {
                currentCount++;
                activeSessions.add(e.session);
            } else {
                currentCount--;
                activeSessions.delete(e.session);
            }

            if (currentCount > maxCount) {
                maxCount = currentCount;
                peakTime = e.time;
                // Capture current sessions
                peakSessions = Array.from(activeSessions);
            }
        }

        return NextResponse.json({
            count: maxCount,
            timestamp: peakTime,
            sessions: peakSessions
        });

    } catch (error) {
        console.error("Failed to fetch concurrent stats:", error);
        return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }
}
