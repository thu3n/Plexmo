import useSWR from "swr";
import { fetchJson } from "@/features/stats/hooks/useStatsData";
import type { AnomalyListItem } from "@/lib/stats/anomalies-describe";

/** The API keeps 90 days of incidents; longer stats periods show all of them. */
export const MAX_ANOMALY_DAYS = 90;
const ANOMALY_LIMIT = 20;

type AnomaliesResponse = { days: number; items: AnomalyListItem[] };

/** Recent anomaly incidents from the daily scan, newest sighting first. */
export function useAnomalies(days: number, serverId: string | null) {
    const params = new URLSearchParams({
        days: String(Math.min(days, MAX_ANOMALY_DAYS)),
        limit: String(ANOMALY_LIMIT),
    });
    if (serverId) params.set("serverId", serverId);
    const { data, error } = useSWR<AnomaliesResponse>(`/api/stats/anomalies?${params}`, fetchJson, {
        revalidateOnFocus: false,
        keepPreviousData: true,
    });
    return { items: data?.items, days: data?.days, error };
}
