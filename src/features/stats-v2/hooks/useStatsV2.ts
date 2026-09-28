import useSWR from "swr";
import type { PublicServer } from "@/lib/servers";
import type { ServerHealthResponse } from "@/lib/server-health";
import type { ServerResources } from "@/lib/server-resources";
import { useAuthMe } from "@/lib/use-auth-me";
import { fetchJson, useGraphData, type HomeStatsResponse } from "@/features/stats/hooks/useStatsData";
import type { OverviewSummaryResponse } from "@/features/stats/hooks/useOverviewData";
import { ALL_TIME_DAYS } from "@/features/stats/lib/stats-periods";

/** Above a year of data, daily buckets are noise — series go monthly. */
const MONTHLY_THRESHOLD_DAYS = 365;
/** Server load changes by the second; a slow poll keeps the card honest without hammering Plex. */
const RESOURCES_REFRESH_MS = 30_000;

const SWR_OPTS = { revalidateOnFocus: false, keepPreviousData: true };

export type SeriesRow = { bucket: string; total: number; seconds: number; users: number };
export type DeviceRow = { bucket: string; total: number; duration: number };
export type TranscodeDetailRow = {
    bucket: "video" | "audio" | "resolution";
    total: number;
    detail: string | null;
};
export type SummaryWithPrevious = OverviewSummaryResponse & {
    previous?: { totalPlays: number; totalSeconds: number; uniqueUsers: number; peak: number };
};

const query = (pairs: Record<string, string | number | null | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(pairs)) {
        if (value !== null && value !== undefined) params.set(key, String(value));
    }
    return params.toString();
};

const isMonthly = (days: number) => days > MONTHLY_THRESHOLD_DAYS;

export const useSummary = (days: number, serverId: string | null) =>
    useSWR<SummaryWithPrevious>(
        `/api/stats/overview/summary?${query({ days, serverId, previous: days < ALL_TIME_DAYS ? 1 : null })}`,
        fetchJson,
        SWR_OPTS,
    ).data;

/** Plays / watch seconds / distinct users per day (or month beyond a year). */
export function useActivitySeries(days: number, serverId: string | null) {
    const { data } = useGraphData(isMonthly(days) ? "plays_by_month" : "plays_by_day", days, serverId);
    return data?.data as SeriesRow[] | undefined;
}

/** Peak concurrent streams per bucket — same granularity as the activity series. */
export function useConcurrentSeries(days: number, serverId: string | null) {
    const { data } = useGraphData(isMonthly(days) ? "concurrent_by_month" : "concurrent_by_day", days, serverId);
    return data?.data as { bucket: string; total: number }[] | undefined;
}

export function useDecisionShare(days: number, serverId: string | null) {
    const { data } = useGraphData("transcode_share", days, serverId);
    return (data?.data ?? []) as { bucket: string; total: number }[];
}

/** Streams per delivered resolution (stream_video_resolution), largest first. */
export function useResolutionShare(days: number, serverId: string | null) {
    const { data } = useGraphData("plays_by_resolution", days, serverId);
    return data?.data as { bucket: string; total: number }[] | undefined;
}

export function useHeatmapRows(days: number, serverId: string | null) {
    const { data } = useGraphData("plays_by_dow_hour", days, serverId);
    return data?.data as SeriesRow[] | undefined;
}

export function useDevices(days: number, serverId: string | null) {
    const { data } = useGraphData("plays_by_device", days, serverId);
    return data?.data as DeviceRow[] | undefined;
}

export function useTranscodeDetails(days: number, serverId: string | null) {
    const { data } = useGraphData("transcode_details", days, serverId);
    return data?.data as TranscodeDetailRow[] | undefined;
}

export const useHomeLight = (days: number, serverId: string | null, limit?: number) =>
    useSWR<HomeStatsResponse>(`/api/stats/home?${query({ days, serverId, media: 0, limit })}`, fetchJson, SWR_OPTS)
        .data;

export const useServers = () =>
    useSWR<{ servers: PublicServer[] }>("/api/servers", fetchJson, SWR_OPTS).data?.servers ?? [];

/** Live health + CPU/RAM; both routes are owner-only, so viewers skip the requests. */
export function useServerLive() {
    const { user } = useAuthMe();
    const isOwner = user?.role === "owner";
    const health = useSWR<ServerHealthResponse>(isOwner ? "/api/servers/status" : null, fetchJson, SWR_OPTS).data;
    const resources = useSWR<{ servers: ServerResources[] }>(
        isOwner ? "/api/servers/resources" : null,
        fetchJson,
        { ...SWR_OPTS, refreshInterval: RESOURCES_REFRESH_MS },
    ).data;
    return { health: health?.servers, resources: resources?.servers };
}
