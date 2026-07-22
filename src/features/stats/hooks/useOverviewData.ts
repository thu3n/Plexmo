import useSWR from "swr";
import { fetchJson } from "./useStatsData";
import type { PlaysByType } from "@/lib/stats/overview-stats";
import type { StreakLeaderboardEntry } from "@/lib/stats/streak-leaderboard";
import type { ThumbRef } from "@/lib/stats/media-thumbs";

export type PeakInfo = { count: number; timestamp: number | null };

export type OverviewSummaryResponse = {
    days: number;
    totalPlays: number;
    totalSeconds: number;
    uniqueUsers: number;
    playsByType: PlaysByType[];
    peak: { window: PeakInfo; allTime: PeakInfo };
};

export type MediaTypeKey = "movie" | "show" | "episode";
export type TopMediaSort = "plays" | "users";

export type TopMediaItem = {
    mediaId: number;
    title: string;
    year: number | null;
    plays: number;
    uniqueUsers: number;
    duration: number;
    lastPlayed: number;
    showTitle?: string | null;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    thumb: ThumbRef | null;
};

export type TopMediaBothResponse = {
    days: number;
    type: MediaTypeKey;
    byUsers: TopMediaItem[];
    byPlays: TopMediaItem[];
};

export type TopStreaksResponse = { items: StreakLeaderboardEntry[] };

const SWR_OPTS = { revalidateOnFocus: false, keepPreviousData: true };

const buildQuery = (pairs: Record<string, string | number | null | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(pairs)) {
        if (value !== null && value !== undefined) params.set(key, String(value));
    }
    return params.toString();
};

// Per-section SWR keys: each section owns its own period pill, so a pill
// change revalidates only that section (keepPreviousData avoids skeleton
// flashes on toggles the cache has already seen).
export const useOverviewSummary = (days: number, serverId: string | null) =>
    useSWR<OverviewSummaryResponse>(
        `/api/stats/overview/summary?${buildQuery({ days, serverId })}`,
        fetchJson,
        SWR_OPTS
    );

export const useTopStreaks = (serverId: string | null, limit = 10) =>
    useSWR<TopStreaksResponse>(
        `/api/stats/overview/streaks?${buildQuery({ limit, serverId })}`,
        fetchJson,
        SWR_OPTS
    );

// One request serves both rankings — the server runs the aggregation once.
export const useTopMediaBoth = (
    type: MediaTypeKey,
    days: number,
    serverId: string | null,
    limit = 10
) =>
    useSWR<TopMediaBothResponse>(
        `/api/stats/overview/top-media?${buildQuery({ type, both: 1, days, serverId, limit })}`,
        fetchJson,
        SWR_OPTS
    );
