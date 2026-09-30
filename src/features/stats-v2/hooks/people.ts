import useSWR from "swr";
import { fetchJson } from "@/features/stats/hooks/useStatsData";
import type { UserLifecycle } from "@/lib/stats/user-insights-lifecycle";
import type { SharedAccountSuspect } from "@/lib/stats/user-insights-sharing";
import type { GenreStat } from "@/lib/stats/user-insights-genres";
import type { ProfileUserOption, UserProfile } from "@/lib/stats/user-insights-profile";

/** Data hooks for the "people" panels (/api/stats/people/*). */

const SWR_OPTS = { revalidateOnFocus: false, keepPreviousData: true };
const HTTP_FORBIDDEN = 403;

export type LifecycleResponse = UserLifecycle & { days: number };
export type GenresResponse = { days: number; items: GenreStat[]; hasGenreData: boolean };

const query = (pairs: Record<string, string | number | null | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(pairs)) {
        if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
    }
    return params.toString();
};

/** Owner-only endpoints: a 403 is an expected answer ("not for you"), not an error. */
const fetchOrForbidden = async <T,>(url: string): Promise<T | "forbidden"> => {
    const response = await fetch(url, { cache: "no-store" });
    if (response.status === HTTP_FORBIDDEN) return "forbidden";
    if (!response.ok) throw new Error("Failed to fetch statistics");
    return response.json() as Promise<T>;
};

export const useUserLifecycle = (days: number, serverId: string | null) =>
    useSWR<LifecycleResponse>(
        `/api/stats/people/lifecycle?${query({ days, serverId })}`,
        fetchJson,
        SWR_OPTS,
    ).data;

/** `"forbidden"` for non-owners — the panel hides itself. */
export const useSharedAccounts = (days: number, serverId: string | null, limit: number) =>
    useSWR<{ days: number; items: SharedAccountSuspect[] } | "forbidden">(
        `/api/stats/people/shared-accounts?${query({ days, serverId, limit })}`,
        fetchOrForbidden,
        SWR_OPTS,
    ).data;

export const useTopGenres = (days: number, serverId: string | null, limit: number, userId?: string | null) =>
    useSWR<GenresResponse>(
        `/api/stats/people/genres?${query({ days, serverId, limit, userId })}`,
        fetchJson,
        SWR_OPTS,
    ).data;

export const useProfileUsers = (days: number, serverId: string | null) =>
    useSWR<{ days: number; items: ProfileUserOption[] }>(
        `/api/stats/people/users?${query({ days, serverId })}`,
        fetchJson,
        SWR_OPTS,
    ).data?.items;

export const useUserProfile = (accountId: string | null, days: number, serverId: string | null) =>
    useSWR<{ days: number; profile: UserProfile }>(
        accountId ? `/api/stats/people/profile?${query({ accountId, days, serverId })}` : null,
        fetchJson,
        SWR_OPTS,
    ).data?.profile;
