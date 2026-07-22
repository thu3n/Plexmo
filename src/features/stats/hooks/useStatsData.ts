import useSWR from "swr";
import type { GraphType } from "@/lib/stats/graph-stats";

export type GraphRow = {
    bucket: string;
    directPlay?: number;
    directStream?: number;
    transcode?: number;
    unknown?: number;
    total: number;
};

export type TopUser = {
    accountId: string;
    user: string;
    thumb?: string;
    plays: number;
    duration: number;
    lastPlayed: number;
};

export type TopMedia = {
    mediaId: number;
    title: string;
    year?: number;
    plays: number;
    uniqueUsers: number;
    duration: number;
    lastPlayed: number;
};

export type TopPlatform = {
    platform: string;
    plays: number;
    uniqueUsers: number;
    duration: number;
};

export type ServerPlays = {
    serverId: string;
    serverName: string | null;
    plays: number;
    duration: number;
};

export type HomeStatsResponse = {
    days: number;
    topUsers: TopUser[];
    // Absent when the request opts out via media=0 (statistics page renders
    // media lists from the top-media API instead).
    topMovies?: TopMedia[];
    topShows?: TopMedia[];
    topPlatforms: TopPlatform[];
    playsPerServer: ServerPlays[];
};

export const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
        const parsed = await response.json().catch(() => null);
        throw new Error(parsed?.error || "Failed to fetch statistics");
    }
    return response.json() as Promise<T>;
};

const buildQuery = (days: number, serverId: string | null, userId?: string) => {
    const params = new URLSearchParams({ days: String(days) });
    if (serverId) params.set("serverId", serverId);
    if (userId) params.set("user", userId);
    return params.toString();
};

// keepPreviousData: period/server switches keep the previous chart while
// revalidating — skeletons only appear on true first load.
// userId (canonical accountId) scopes everything to one identity's rows.
export const useHomeStats = (
    days: number,
    serverId: string | null,
    userId?: string,
    opts?: { media?: boolean }
) =>
    useSWR<HomeStatsResponse>(
        `/api/stats/home?${buildQuery(days, serverId, userId)}${opts?.media === false ? "&media=0" : ""}`,
        fetchJson,
        { revalidateOnFocus: false, keepPreviousData: true }
    );

export const useGraphData = (type: GraphType, days: number, serverId: string | null, userId?: string) =>
    useSWR<{ type: GraphType; days: number; data: GraphRow[] }>(
        `/api/stats/graphs?type=${type}&${buildQuery(days, serverId, userId)}`,
        fetchJson,
        { revalidateOnFocus: false, keepPreviousData: true }
    );
