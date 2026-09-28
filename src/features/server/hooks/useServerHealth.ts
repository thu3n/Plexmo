"use client";

import useSWR from "swr";
import { fetchJsonOrThrow } from "@/lib/swr-fetch";
import type { ServerHealth, ServerHealthResponse } from "@/lib/server-health";

export const SERVER_HEALTH_KEY = "/api/servers/status";

// Each refresh makes one authenticated request per server; once a minute is
// plenty for a settings page and keeps load on the Plex servers negligible.
const HEALTH_REFRESH_MS = 60_000;

export function useServerHealth(enabled: boolean) {
    const { data, error, isLoading, isValidating, mutate } = useSWR<ServerHealthResponse>(
        enabled ? SERVER_HEALTH_KEY : null,
        fetchJsonOrThrow,
        { refreshInterval: HEALTH_REFRESH_MS, revalidateOnFocus: false }
    );

    const byId = new Map<string, ServerHealth>((data?.servers ?? []).map((h) => [h.serverId, h]));

    return {
        healthFor: (serverId: string): ServerHealth | undefined => byId.get(serverId),
        error: error as Error | undefined,
        isLoading,
        isValidating,
        refresh: mutate,
    };
}
