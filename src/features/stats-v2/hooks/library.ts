import useSWR from "swr";
import { fetchJson } from "@/features/stats/hooks/useStatsData";
import type { LibraryValueResult } from "@/lib/stats/library-value";

const SWR_OPTS = { revalidateOnFocus: false, keepPreviousData: true };

/** Staleness choices for the dead-weight panel, in months. */
export const STALE_MONTH_OPTIONS = [6, 12, 24] as const;
export type StaleMonths = (typeof STALE_MONTH_OPTIONS)[number];
export const DEFAULT_STALE_MONTHS: StaleMonths = 12;

const libraryValueUrl = (serverId: string | null, months: number) => {
    const params = new URLSearchParams({ months: String(months) });
    if (serverId) params.set("serverId", serverId);
    return `/api/stats/library/value?${params.toString()}`;
};

/**
 * All four library-value metrics come from one lifetime response. Panels that
 * don't care about staleness pass the default so SWR shares one request.
 */
export const useLibraryValue = (serverId: string | null, months: number = DEFAULT_STALE_MONTHS) =>
    useSWR<LibraryValueResult>(libraryValueUrl(serverId, months), fetchJson, SWR_OPTS).data;
