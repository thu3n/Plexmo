
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { plexFetch } from "@/lib/plex";

interface StatRequest {
    items: {
        id: string; // The merged item ID (e.g. tmdb://123)
        title: string;
        type: 'movie' | 'show';
        sources: {
            serverId: string;
            ratingKey: string;
        }[];
    };
}

// Helper to decode HTML entities (e.g. &#228; -> ä, &amp; -> &)
function decodeHTMLEntities(text: string): string {
    if (!text) return text;
    return text.replace(/&#([0-9]{1,4});/gi, (match, numStr) => {
        const num = parseInt(numStr, 10);
        return String.fromCharCode(num);
    }).replace(/&#x([0-9a-f]{1,4});/gi, (match, hexStr) => {
        const num = parseInt(hexStr, 16);
        return String.fromCharCode(num);
    }).replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'");
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as StatRequest;
        const { items } = body;

        if (!items || !items.sources || items.sources.length === 0) {
            return NextResponse.json({ error: "Invalid item" }, { status: 400 });
        }

        // 1. Identify Primary Source (for metadata fetching)
        // We use the first source as primary for now.
        const primarySource = items.sources[0];
        const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(primarySource.serverId) as any;

        if (!server) {
            return NextResponse.json({ error: "Server not found" }, { status: 404 });
        }

        // Movie Logic
        if (items.type === 'movie') {
            // Aggregate stats from ALL sources?
            // Since we don't have GUIDs in history, we can only reliably match by ratingKey + serverId.
            // We can iterate all sources and sum them up!

            const placeholders = items.sources.map(() => `(h.serverId = ? AND h.ratingKey = ?)`).join(' OR ');
            const params = items.sources.flatMap(s => [s.serverId, s.ratingKey]);

            const history = db.prepare(`
                SELECT h.*, s.name as serverName
                FROM activity_history h
                LEFT JOIN servers s ON h.serverId = s.id
                WHERE ${placeholders}
                ORDER BY h.startTime DESC
            `).all(...params) as any[];

            // Calculate Unique Plays (Same User + Same Movie + Same Day)
            const uniquePlayKeys = new Set();
            history.forEach(h => {
                const date = new Date(h.startTime).toLocaleDateString('en-CA');
                // For movies in a Unified Group, we ignore ratingKey because they are all the same movie (just different duplications)
                uniquePlayKeys.add(`${h.user}-${date}`);
            });

            const totalPlays = uniquePlayKeys.size;
            const uniqueUsers = new Set(history.map(h => h.user)).size;

            return NextResponse.json({
                type: 'movie',
                stats: {
                    totalPlays,
                    uniqueUsers,
                    history: history.slice(0, 50) // Top 50 recent
                }
            });
        }

        // 3. Show Logic
        if (items.type === 'show') {
            // Fetch episodes from ALL sources in parallel
            const sourcePromises = items.sources.map(async (source) => {
                const srcServer = db.prepare("SELECT * FROM servers WHERE id = ?").get(source.serverId) as any;
                if (!srcServer) return [];

                try {
                    const data = await plexFetch(`/library/metadata/${source.ratingKey}/allLeaves`, {}, srcServer) as any;
                    const leaves = data.MediaContainer?.Video || data.MediaContainer?.Metadata || [];
                    const leafArray = Array.isArray(leaves) ? leaves : [leaves];

                    return leafArray.map((l: any) => ({
                        serverId: source.serverId,
                        ratingKey: l.ratingKey,
                        parentIndex: Number(l.parentIndex ?? 1),
                        index: Number(l.index ?? 1),
                        title: decodeHTMLEntities(l.title),
                        parentTitle: decodeHTMLEntities(l.parentTitle),
                        viewCount: Number(l.viewCount || 0) // Capture view count (watched status)
                    }));
                } catch (e) {
                    console.error(`[Stats] Failed to fetch episodes from ${srcServer.name}`, e);
                    return [];
                }
            });

            const allEpisodesNested = await Promise.all(sourcePromises);
            const allEpisodes = allEpisodesNested.flat();

            if (allEpisodes.length === 0) {
                return NextResponse.json({ type: 'show', stats: { totalPlays: 0, uniqueUsers: 0, seasons: [], episodeCount: 0, watchedEpisodeCount: 0 } });
            }

            // Collect all ratingKeys for history query
            const allRatingKeys = allEpisodes.map(e => e.ratingKey);
            // We need to query by (serverId, ratingKey) pairs
            const placeholders = allEpisodes.map(() => '(h.serverId = ? AND h.ratingKey = ?)').join(' OR ');
            const params = allEpisodes.flatMap(e => [e.serverId, e.ratingKey]);

            const history = db.prepare(`
                SELECT h.*, s.name as serverName 
                FROM activity_history h
                LEFT JOIN servers s ON h.serverId = s.id
                WHERE ${placeholders}
                ORDER BY h.startTime DESC
            `).all(...params) as any[];

            // Aggregate by Season/Episode Index
            // Map key: "S{season}-E{episode}"
            const seasonsMap = new Map<number, any>();

            // Helper to get stats from the global history list for a set of ratingKeys
            const getStatsForKeys = (keys: { serverId: string, ratingKey: string }[]) => {
                const relevantHistory = history.filter(h =>
                    keys.some(k => k.serverId === h.serverId && k.ratingKey === h.ratingKey)
                );

                return {
                    plays: relevantHistory.length,
                    lastPlayed: relevantHistory.length > 0 ? relevantHistory[0].startTime : null,
                    uniqueUsers: new Set(relevantHistory.map(h => h.user)).size,
                    history: relevantHistory
                };
            };

            // Group episodes by index
            const uniqueEpisodesMap = new Map<string, {
                parentIndex: number,
                index: number,
                title: string,
                isWatched: boolean,
                keys: { serverId: string, ratingKey: string }[]
            }>();

            for (const ep of allEpisodes) {
                const key = `S${ep.parentIndex}-E${ep.index}`;
                if (!uniqueEpisodesMap.has(key)) {
                    uniqueEpisodesMap.set(key, {
                        parentIndex: ep.parentIndex,
                        index: ep.index,
                        title: ep.title, // Use title from first source found
                        isWatched: false,
                        keys: []
                    });
                }
                const epData = uniqueEpisodesMap.get(key)!;
                epData.keys.push({ serverId: ep.serverId, ratingKey: ep.ratingKey });
                if (ep.viewCount > 0) epData.isWatched = true; // Use OR logic across servers? Or AND? Usually if watched on any, it's watched.
            }

            // Mapping of ratingKey -> { title, season, episode }
            const episodeLookup = new Map<string, { title: string, s: number, e: number }>();

            let globalEpisodeCount = 0;
            let globalWatchedCount = 0;

            for (const [key, epData] of uniqueEpisodesMap.entries()) {
                const sIndex = epData.parentIndex;

                if (!seasonsMap.has(sIndex)) {
                    seasonsMap.set(sIndex, {
                        index: sIndex,
                        episodes: [],
                        episodeCount: 0,
                        watchedEpisodeCount: 0,
                        allRatingKeys: new Set<string>()
                    });
                }

                const stats = getStatsForKeys(epData.keys);

                // Find a ratingKey to use for "selectedEpisode" in UI (just use first valid one)
                const primaryKey = epData.keys[0].ratingKey;

                // Populate lookup for ALL keys
                epData.keys.forEach(k => {
                    episodeLookup.set(k.ratingKey, {
                        title: epData.title,
                        s: epData.parentIndex,
                        e: epData.index
                    });
                });

                seasonsMap.get(sIndex).episodes.push({
                    index: epData.index,
                    title: epData.title,
                    ratingKey: primaryKey, // UI Compatibility
                    isWatched: epData.isWatched,
                    stats: stats
                });

                seasonsMap.get(sIndex).episodeCount++;
                if (epData.isWatched) seasonsMap.get(sIndex).watchedEpisodeCount++;

                // Add all keys for this episode to the season's master list
                epData.keys.forEach(k => seasonsMap.get(sIndex).allRatingKeys.add(k.ratingKey));

                globalEpisodeCount++;
                if (epData.isWatched) globalWatchedCount++;
            }

            // Enrich History with Episode Details
            const enrichedHistory = history.map(h => {
                const epInfo = episodeLookup.get(h.ratingKey);
                return {
                    ...h,
                    episodeTitle: epInfo ? `${epInfo.s}x${epInfo.e} - ${epInfo.title}` : undefined,
                    season: epInfo?.s,
                    episode: epInfo?.e
                };
            });



            // Sort Seasons
            const seasons = Array.from(seasonsMap.values()).sort((a, b) => a.index - b.index);
            seasons.forEach(s => s.episodes.sort((a: any, b: any) => a.index - b.index));

            // Helper to generate user stats for a set of keys
            const generateUserStats = (keys: Set<string>) => {
                const map = new Map<string, {
                    user: string,
                    userThumb?: string,
                    watchedKeys: Set<string>,
                    lastPlayed: string,
                    lastEpisodeTitle: string
                }>();

                for (const h of enrichedHistory) {
                    if (!keys.has(h.ratingKey)) continue;

                    if (!map.has(h.user)) {
                        map.set(h.user, {
                            user: h.user,
                            userThumb: h.userThumb,
                            watchedKeys: new Set(),
                            lastPlayed: h.startTime,
                            lastEpisodeTitle: h.episodeTitle || "Unknown"
                        });
                    }
                    const entry = map.get(h.user)!;
                    if (h.season !== undefined && h.episode !== undefined) {
                        entry.watchedKeys.add(`S${h.season}E${h.episode}`);
                    }
                }

                return Array.from(map.values()).map(u => ({
                    user: u.user,
                    userThumb: u.userThumb,
                    episodeCount: u.watchedKeys.size, // count unique episodes watched by this user in this scope
                    lastPlayed: u.lastPlayed,
                    lastEpisodeTitle: u.lastEpisodeTitle
                })).sort((a, b) => b.episodeCount - a.episodeCount);
            };

            // Global User Stats (User Overview for All Seasons)
            const allSeasonKeys = new Set(allEpisodes.map(e => e.ratingKey)); // All valid ratingKeys
            const userStats = generateUserStats(allSeasonKeys);

            // Per-Season User Stats
            seasons.forEach((season: any) => {
                // Use the collected allRatingKeys which includes keys from ALL servers
                season.userOverview = generateUserStats(season.allRatingKeys);

                // Calculate aggregate stats for the season
                const seasonHistory = enrichedHistory.filter(h => season.allRatingKeys.has(h.ratingKey));

                // Calculate Unique Plays (Same User + Same Episode + Same Day = 1 Play)
                const uniquePlayKeys = new Set();
                seasonHistory.forEach((h: any) => {
                    const date = new Date(h.startTime).toLocaleDateString('en-CA'); // YYYY-MM-DD
                    const keyPart = (h.season !== undefined && h.episode !== undefined)
                        ? `S${h.season}E${h.episode}`
                        : h.ratingKey;
                    uniquePlayKeys.add(`${h.user}-${keyPart}-${date}`);
                });

                season.stats = {
                    totalPlays: uniquePlayKeys.size,
                    uniqueUsers: new Set(seasonHistory.map(h => h.user)).size,
                    lastPlayed: seasonHistory.length > 0 ? seasonHistory[0].startTime : null
                };

                // Clean up the Set before sending JSON
                delete season.allRatingKeys;
            });

            // Calculate Global Unique Plays
            const globalUniquePlayKeys = new Set();
            enrichedHistory.forEach(h => {
                const date = new Date(h.startTime).toLocaleDateString('en-CA'); // YYYY-MM-DD
                const keyPart = (h.season !== undefined && h.episode !== undefined)
                    ? `S${h.season}E${h.episode}`
                    : h.ratingKey;
                globalUniquePlayKeys.add(`${h.user}-${keyPart}-${date}`);
            });
            const finalTotalPlays = globalUniquePlayKeys.size;
            const finalUniqueUsers = new Set(history.map(h => h.user)).size;

            return NextResponse.json({
                type: 'show',
                stats: {
                    totalPlays: finalTotalPlays, // Now represents Unique Plays
                    uniqueUsers: finalUniqueUsers,
                    seasons,
                    episodeCount: globalEpisodeCount,
                    watchedEpisodeCount: globalWatchedCount,
                    history: enrichedHistory.slice(0, 100),
                    userOverview: userStats
                }
            });
        }

        return NextResponse.json({ error: "Invalid type" }, { status: 400 });

    } catch (e: any) {
        console.error("Stats Error Stack:", e.stack);
        console.error("Stats Error Message:", e.message);
        return NextResponse.json({ error: "Internal Server Error", details: e.message }, { status: 500 });
    }
}
