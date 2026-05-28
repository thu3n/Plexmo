import useSWR from "swr";
import { useEffect } from "react";
import type { LibrarySection, PlexSession, SessionSummary } from "@/lib/plex";
import type { PublicServer } from "@/lib/servers";

type DashboardResponse = {
    sessions: PlexSession[];
    summary: SessionSummary;
    libraries: LibrarySection[];
    updatedAt: string;
    appName?: string;
};

type ServersResponse = {
    servers: PublicServer[];
};

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
        let detail = "";
        try {
            const parsed = await response.json();
            detail = parsed?.error || "";
        } catch {
            detail = await response.text();
        }
        const message = detail || "Misslyckades att hämta data";
        throw new Error(message);
    }

    return response.json() as Promise<T>;
};

export const useDashboardData = () => {
    const {
        data: serversData,
        error: serversError,
        isLoading: serversLoading,
    } = useSWR<ServersResponse>("/api/servers", fetchJson);

    useEffect(() => {
        // Redirect to setup if we have loaded servers but found none
        if (!serversLoading && serversData && serversData.servers.length === 0) {
            window.location.href = "/setup";
        }
    }, [serversLoading, serversData]);

    const dashboardKey = "/api/dashboard";

    const {
        data,
        error,
        isLoading,
        mutate: refreshData,
    } = useSWR<DashboardResponse>(dashboardKey, fetchJson, {
        refreshInterval: 5000,
        revalidateOnFocus: false,
    });

    return {
        sessions: data?.sessions ?? [],
        summary: data?.summary,
        libraries: data?.libraries ?? [],
        appName: data?.appName,
        updatedAt: data?.updatedAt,
        servers: serversData?.servers ?? [],
        serversLoading,
        serversError,
        isLoading,
        error,
        refreshData,
    };
};
