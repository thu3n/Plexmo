"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fetchJson } from "@/features/stats/hooks/useStatsData";
import type { WrappedData } from "@/lib/stats/wrapped";
import type { WrappedPerson } from "@/lib/stats/wrapped-people";

export type WrappedResponse = {
    wrapped: WrappedData;
    years: number[];
    /** Owners only: everyone with history in the selected year. */
    people: WrappedPerson[] | null;
    canPickUser: boolean;
};

/**
 * Wrapped selection lives in the URL (?user=&year=) so the page is its own
 * share link and back/forward walks between recaps.
 */
export function useWrapped() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const user = searchParams.get("user");
    const year = searchParams.get("year");

    const params = new URLSearchParams();
    if (user) params.set("user", user);
    if (year) params.set("year", year);
    const query = params.toString();

    const { data, error, isLoading } = useSWR<WrappedResponse>(
        `/api/stats/wrapped${query ? `?${query}` : ""}`,
        fetchJson,
        { revalidateOnFocus: false, keepPreviousData: true },
    );

    const select = useCallback(
        (next: { user?: string; year?: number }) => {
            const updated = new URLSearchParams(searchParams.toString());
            if (next.user !== undefined) updated.set("user", next.user);
            if (next.year !== undefined) updated.set("year", String(next.year));
            router.replace(`${pathname}?${updated}`, { scroll: false });
        },
        [pathname, router, searchParams],
    );

    return { data, error: error as Error | undefined, isLoading, select };
}
