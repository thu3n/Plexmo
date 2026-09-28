"use client";

import useSWR from "swr";
import type { RuleEventEntry } from "@/features/rules/types";
import { fetchJsonOrThrow } from "@/lib/swr-fetch";
import { RULE_EVENTS_PAGE_SIZE } from "@/features/rules/constants";
import { RULES_ENDPOINT } from "./useRuleManagement";

/** Recent enforcement events for one rule; pass null to skip fetching. */
export function useRuleEvents(ruleId: string | null) {
    const { data, error, isLoading, mutate } = useSWR<{ events: RuleEventEntry[] }>(
        ruleId ? `${RULES_ENDPOINT}/${encodeURIComponent(ruleId)}/events?limit=${RULE_EVENTS_PAGE_SIZE}` : null,
        fetchJsonOrThrow
    );
    return { events: data?.events, error: error as Error | undefined, isLoading, retry: () => mutate() };
}
