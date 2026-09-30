import { useState } from "react";
import useSWR from "swr";
import { useAuthMe } from "@/lib/use-auth-me";
import { fetchJson } from "@/features/stats/hooks/useStatsData";
import type { TranscodeReasonsResult, TranscodingClient } from "@/lib/stats/server-quality";
import type { RelayShareResult } from "@/lib/stats/server-quality-relay";
import type { WanLoadResult } from "@/lib/stats/server-quality-wan";

const SWR_OPTS = { revalidateOnFocus: false, keepPreviousData: true };

export type ReasonsResponse = TranscodeReasonsResult & { days: number };
export type ClientsResponse = { days: number; items: TranscodingClient[] };
export type RelayResponse = RelayShareResult & { days: number };
export type WanResponse = WanLoadResult & { days: number; capacityMbps: number | null };

const qualityUrl = (path: string, days: number, serverId: string | null, limit?: number) => {
    const params = new URLSearchParams({ days: String(days) });
    if (serverId) params.set("serverId", serverId);
    if (limit !== undefined) params.set("limit", String(limit));
    return `/api/stats/quality/${path}?${params.toString()}`;
};

export const useTranscodeReasons = (days: number, serverId: string | null) =>
    useSWR<ReasonsResponse>(qualityUrl("reasons", days, serverId), fetchJson, SWR_OPTS).data;

export const useTranscodingClients = (days: number, serverId: string | null, limit: number) =>
    useSWR<ClientsResponse>(qualityUrl("clients", days, serverId, limit), fetchJson, SWR_OPTS).data;

export const useRelayShare = (days: number, serverId: string | null, limit: number) =>
    useSWR<RelayResponse>(qualityUrl("relay", days, serverId, limit), fetchJson, SWR_OPTS).data;

export const useWanLoad = (days: number, serverId: string | null) =>
    useSWR<WanResponse>(qualityUrl("wan", days, serverId), fetchJson, SWR_OPTS);

/**
 * Owner-only upload-capacity editor state. Saves through the owner-gated
 * route, then revalidates the WAN series so the capacity line moves at once.
 */
export function useUploadCapacityEditor(onSaved: () => void) {
    const { user } = useAuthMe();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async (mbps: number | null): Promise<boolean> => {
        setSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/stats/quality/capacity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mbps }),
            });
            if (!response.ok) {
                const parsed = (await response.json().catch(() => null)) as { error?: string } | null;
                setError(parsed?.error ?? "Could not save capacity");
                return false;
            }
            onSaved();
            return true;
        } catch {
            setError("Could not save capacity");
            return false;
        } finally {
            setSaving(false);
        }
    };

    return { canEdit: user?.role === "owner", saving, error, save };
}
