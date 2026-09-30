import useSWR from "swr";
import { fetchJson } from "@/features/stats/hooks/useStatsData";
import type { BehaviourMediaType } from "@/lib/stats/viewing-behaviour";
import type { CompletionStats } from "@/lib/stats/viewing-behaviour-completion";
import type { BingeStats } from "@/lib/stats/viewing-behaviour-binge";
import type { AbandonedStats } from "@/lib/stats/viewing-behaviour-abandoned";
import type { PauseStats } from "@/lib/stats/viewing-behaviour-pauses";

const SWR_OPTS = { revalidateOnFocus: false, keepPreviousData: true };

type BehaviourResponse<T> = { days: number; data: T };

const behaviourUrl = (
    metric: string,
    days: number,
    serverId: string | null,
    limit: number,
    extra: Record<string, string> = {},
) => {
    const params = new URLSearchParams({ ...extra, days: String(days), limit: String(limit) });
    if (serverId) params.set("serverId", serverId);
    return `/api/stats/behaviour/${metric}?${params.toString()}`;
};

const useBehaviour = <T>(url: string) =>
    useSWR<BehaviourResponse<T>>(url, fetchJson, SWR_OPTS).data?.data;

export const useCompletion = (type: BehaviourMediaType, days: number, serverId: string | null, limit: number) =>
    useBehaviour<CompletionStats>(behaviourUrl("completion", days, serverId, limit, { type }));

export const useBinges = (days: number, serverId: string | null, limit: number) =>
    useBehaviour<BingeStats>(behaviourUrl("binges", days, serverId, limit));

export const useAbandoned = (days: number, serverId: string | null, limit: number) =>
    useBehaviour<AbandonedStats>(behaviourUrl("abandoned", days, serverId, limit));

export const usePauses = (days: number, serverId: string | null, limit: number) =>
    useBehaviour<PauseStats>(behaviourUrl("pauses", days, serverId, limit));
