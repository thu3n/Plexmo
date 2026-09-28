import useSWR from "swr";
import type { PublicServer } from "@/lib/servers";
import { fetchJson, useGraphData, useHomeStats } from "@/features/stats/hooks/useStatsData";
import { useOverviewSummary } from "@/features/stats/hooks/useOverviewData";
import { ALL_TIME_DAYS } from "@/features/stats/lib/stats-periods";

/** Above a year of data, daily buckets are noise — the area chart goes monthly. */
const MONTHLY_THRESHOLD_DAYS = 365;

const SWR_OPTS = { revalidateOnFocus: false, keepPreviousData: true };

export type DeviceRow = { bucket: string; total: number; duration: number };
export type TranscodeDetailRow = {
    bucket: "video" | "audio" | "resolution";
    total: number;
    detail: string | null;
};

/** Current window + the doubled window, whose difference is the previous period. */
export function useKpiData(days: number, serverId: string | null) {
    const current = useOverviewSummary(days, serverId);
    const hasPrevious = days < ALL_TIME_DAYS;
    const doubled = useOverviewSummary(hasPrevious ? Math.min(days * 2, ALL_TIME_DAYS) : days, serverId);
    return { current: current.data, doubled: hasPrevious ? doubled.data : undefined };
}

export function usePlaysSeries(days: number, serverId: string | null) {
    const monthly = days > MONTHLY_THRESHOLD_DAYS;
    const { data } = useGraphData(monthly ? "plays_by_month" : "plays_by_day", days, serverId);
    return data?.data;
}

export function useDecisionShare(days: number, serverId: string | null) {
    const { data } = useGraphData("transcode_share", days, serverId);
    return (data?.data ?? []) as { bucket: string; total: number }[];
}

export function useHeatmapRows(days: number, serverId: string | null) {
    const { data } = useGraphData("plays_by_dow_hour", days, serverId);
    return data?.data;
}

export function useDevices(days: number, serverId: string | null) {
    const { data } = useGraphData("plays_by_device", days, serverId);
    return data?.data as DeviceRow[] | undefined;
}

export function useTranscodeDetails(days: number, serverId: string | null) {
    const { data } = useGraphData("transcode_details", days, serverId);
    return data?.data as TranscodeDetailRow[] | undefined;
}

export const useHomeLight = (days: number, serverId: string | null) =>
    useHomeStats(days, serverId, undefined, { media: false }).data;

export const useServers = () =>
    useSWR<{ servers: PublicServer[] }>("/api/servers", fetchJson, SWR_OPTS).data?.servers ?? [];
