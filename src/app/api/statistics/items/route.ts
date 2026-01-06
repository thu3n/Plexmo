import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const ratingKey = searchParams.get("ratingKey");
        const serverId = searchParams.get("serverId");
        const range = searchParams.get("range") || "24h";
        const type = searchParams.get("type"); // Support 'show' type for series aggregation

        if (!ratingKey) {
            return NextResponse.json({ error: "Missing ratingKey" }, { status: 400 });
        }

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

        // 1. Fetch ALL history for the range to perform in-memory matching
        // We need this to duplicate the aggregation logic from the popular route
        const query = `
            SELECT 
                h.user,
                h.startTime,
                h.ratingKey,
                h.serverId,
                h.title,
                h.subtitle,
                h.meta_json,
                l.type as library_type,
                l.meta_json as library_meta,
                h.duration
            FROM activity_history h
            LEFT JOIN library_items l ON h.ratingKey = l.ratingKey AND h.serverId = l.serverId
            WHERE h.startTime > ?
            ORDER BY h.startTime DESC
            LIMIT 5000
        `;

        const rows = db.prepare(query).all(cutoff) as any[];

        // 2. Find the "Reference Item" to establish Identity
        const referenceRow = rows.find(r => r.ratingKey === ratingKey && (!serverId || r.serverId === serverId)) || rows.find(r => r.ratingKey === ratingKey);

        if (!referenceRow) {
            return NextResponse.json({ users: [] });
        }

        // Helper to get Identity Key (Copied from popular/route.ts)
        const getIdentity = (row: any) => {
            let meta: any = null;
            try { meta = JSON.parse(row.meta_json); } catch (e) { }
            let libMeta: any = null;
            try { libMeta = JSON.parse(row.library_meta); } catch (e) { }
            const effectiveMeta = { ...libMeta, ...meta };

            let itemType = row.library_type;
            if (!itemType && effectiveMeta && effectiveMeta.type) {
                itemType = effectiveMeta.type;
            }

            if (itemType === 'episode' || (effectiveMeta && effectiveMeta.grandparentTitle)) {

                const seriesName = (effectiveMeta?.grandparentTitle || row.title).toLowerCase().trim();

                if (type === 'show') {
                    // If we are looking for series level users, we match by series name
                    if (seriesName) return `series:${seriesName}`;
                    return ""; // If it doesn't have a series name, it's not a match for series mode
                }

                // Normal Episode Strategy
                let season = effectiveMeta?.parentIndex;
                let episode = effectiveMeta?.index;

                if ((season === undefined || episode === undefined) && row.subtitle) {
                    const match = row.subtitle.match(/S(\d+)\s*E(\d+)/i);
                    if (match) {
                        season = parseInt(match[1]);
                        episode = parseInt(match[2]);
                    }
                }

                if (seriesName && season !== undefined && episode !== undefined) {
                    return `show:${seriesName}:s${season}:e${episode}`;
                }
                return `show:${row.ratingKey}`;
            } else {
                if (type === 'show') return ""; // Series mode ignores movies

                const titleKey = (effectiveMeta?.originalTitle || row.title).toLowerCase().trim();
                const year = effectiveMeta?.year || row.year || '';
                return `movie:${titleKey}:${year}`;
            }
        };

        const targetIdentity = getIdentity(referenceRow);

        // If we couldn't determine identity (e.g. requested show but item is a movie?), return empty
        if (!targetIdentity) {
            return NextResponse.json({ users: [] });
        }

        // 3. Filter rows that match the target identity
        const matchedRows = rows.filter(row => getIdentity(row) === targetIdentity);

        const sort = searchParams.get("sort") || "unique_users"; // 'unique_users' or 'total_plays'

        // 4. Aggregate Users & Plays
        const userStats = new Map<string, {
            playCount: number,
            lastWatched: number,
            user: string,
            plays: any[]
        }>();

        for (const row of matchedRows) {
            // Extract metadata
            let meta: any = null;
            if (row.meta_json) { try { meta = JSON.parse(row.meta_json); } catch (e) { } }
            let libMeta: any = null;
            if (row.library_meta) { try { libMeta = JSON.parse(row.library_meta); } catch (e) { } }
            const effectiveMeta = { ...libMeta, ...meta };

            // 80% Completion Check (Only for 'total_plays' sort)
            let completionPercentage = 0;
            if (effectiveMeta?.duration > 0) {
                completionPercentage = ((row.duration || 0) * 1000) / effectiveMeta.duration;
            }

            if (effectiveMeta?.duration > 0) {
                if (completionPercentage < 0.8) {
                    continue; // Skip incomplete plays
                }
            }

            // Determine Episode Details
            let episodeTitle = row.title;
            let season = effectiveMeta?.parentIndex;
            let episode = effectiveMeta?.index;

            // If it's a show/episode, try to format nicely
            if (type === 'show' || row.library_type === 'episode' || effectiveMeta?.grandparentTitle) {
                if ((season === undefined || episode === undefined) && row.subtitle) {
                    const match = row.subtitle.match(/S(\d+)\s*E(\d+)/i);
                    if (match) { season = parseInt(match[1]); episode = parseInt(match[2]); }
                }

                if (season !== undefined && episode !== undefined) {
                    // It's a proper episode
                    episodeTitle = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
                }
            }

            if (!userStats.has(row.user)) {
                userStats.set(row.user, {
                    user: row.user,
                    playCount: 0,
                    lastWatched: 0,
                    plays: []
                });
            }
            const stat = userStats.get(row.user)!;
            stat.playCount += 1;
            if (row.startTime > stat.lastWatched) {
                stat.lastWatched = row.startTime;
            }

            // Add specific play details
            stat.plays.push({
                title: episodeTitle,
                originalTitle: row.title,
                date: row.startTime,
                duration: row.duration,
                percent: Math.round(completionPercentage * 100),
                season: season,
                episode: episode
            });
        }

        const users = Array.from(userStats.values()).sort((a, b) => b.lastWatched - a.lastWatched);

        return NextResponse.json({
            users
        });

    } catch (error) {
        console.error("Failed to fetch item details:", error);
        return NextResponse.json({ error: "Failed to fetch details" }, { status: 500 });
    }
}
