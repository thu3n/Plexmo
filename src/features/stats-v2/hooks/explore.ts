import useSWR from "swr";
import { fetchJson, useGraphData } from "@/features/stats/hooks/useStatsData";
import type { TitleBucket, TitleDetail } from "@/lib/stats/title-detail";
import type { AlsoWatchedItem } from "@/lib/stats/title-detail-also-watched";
import type { HeatmapCell, HeatmapSessionsResult } from "@/lib/stats/heatmap-sessions";
import type { SeriesRow } from "./useStatsV2";

/** Data hooks for the Statistics v2 drill-downs (title page, compare, heatmap cell, calendar). */

const SWR_OPTS = { revalidateOnFocus: false, keepPreviousData: true };
/** Above a year of data, daily buckets are noise — series go monthly (same as useStatsV2). */
const MONTHLY_THRESHOLD_DAYS = 365;
/** The calendar heatmap always covers one year of days, whatever the page period. */
export const CALENDAR_DAYS = 365;

const query = (pairs: Record<string, string | number | null | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(pairs)) {
        if (value !== null && value !== undefined) params.set(key, String(value));
    }
    return params.toString();
};

export type TitleDetailResponse = TitleDetail & { days: number; bucket: TitleBucket };

export function useTitleDetail(mediaId: number, days: number, serverId: string | null) {
    const { data, error } = useSWR<TitleDetailResponse>(
        `/api/stats/title/${mediaId}?${query({ days, serverId })}`,
        fetchJson,
        SWR_OPTS,
    );
    return { data, error: error as Error | undefined };
}

export const useAlsoWatched = (mediaId: number, days: number, serverId: string | null) =>
    useSWR<{ items: AlsoWatchedItem[] }>(
        `/api/stats/title/${mediaId}/also-watched?${query({ days, serverId })}`,
        fetchJson,
        SWR_OPTS,
    ).data?.items;

type GraphResponse<T> = { data: T[] };

/** The activity + concurrent series of the window right before the current one; null key = off. */
export function usePreviousSeries(days: number, serverId: string | null, offsetDays: number | null) {
    const monthly = days > MONTHLY_THRESHOLD_DAYS;
    const key = (type: string) =>
        offsetDays === null ? null : `/api/stats/graphs?${query({ type, days, serverId, offsetDays })}`;
    const activity = useSWR<GraphResponse<SeriesRow>>(
        key(monthly ? "plays_by_month" : "plays_by_day"),
        fetchJson,
        SWR_OPTS,
    ).data?.data;
    const concurrent = useSWR<GraphResponse<{ bucket: string; total: number }>>(
        key(monthly ? "concurrent_by_month" : "concurrent_by_day"),
        fetchJson,
        SWR_OPTS,
    ).data?.data;
    return { activity, concurrent };
}

export type HeatmapSessionsResponse = HeatmapSessionsResult & HeatmapCell & { days: number };

export const useHeatmapSessions = (cell: HeatmapCell | null, days: number, serverId: string | null) =>
    useSWR<HeatmapSessionsResponse>(
        cell ? `/api/stats/heatmap-sessions?${query({ weekday: cell.weekday, hour: cell.hour, days, serverId })}` : null,
        fetchJson,
        SWR_OPTS,
    );

/** Daily plays for the last year — the calendar heatmap's input (shares the 1y period's cache entry). */
export function useCalendarSeries(serverId: string | null) {
    const { data } = useGraphData("plays_by_day", CALENDAR_DAYS, serverId);
    return data?.data as SeriesRow[] | undefined;
}
