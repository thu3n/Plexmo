"use client";

import { useState } from "react";
import useSWR from "swr";
import type { RuleInstance } from "@/features/rules/types";
import { fetchJsonOrThrow, requestJson } from "@/lib/swr-fetch";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { getDefaultSettings } from "@/features/rules/constants";
import { duplicateRule as cloneRule } from "@/features/rules/utils/ruleList";

export type { RuleInstance };

export type PersistedRule = RuleInstance & { id: string };

export const RULES_ENDPOINT = "/api/rules/instances";

export interface RuleEditorTarget {
    rule: RuleInstance;
    /** Set when duplicating: the form seeds its scope from this rule. */
    scopeSourceId?: string;
}

export function useRuleManagement() {
    const { toast, confirm } = useFeedback();
    const { data: rules, error, isLoading, mutate } = useSWR<PersistedRule[]>(RULES_ENDPOINT, fetchJsonOrThrow);
    const [editorTarget, setEditorTarget] = useState<RuleEditorTarget | undefined>(undefined);
    const [isTypeSelectionOpen, setIsTypeSelectionOpen] = useState(false);

    const openCreateModal = () => setIsTypeSelectionOpen(true);

    const selectRuleType = (type: string) => {
        setIsTypeSelectionOpen(false);
        setEditorTarget({
            rule: {
                type,
                name: "",
                enabled: true,
                settings: getDefaultSettings(type),
                discordWebhookId: null,
                discordWebhookIds: [],
            },
        });
    };

    const openEditModal = (rule: RuleInstance) => setEditorTarget({ rule });

    const duplicateRule = (rule: PersistedRule) => setEditorTarget({ rule: cloneRule(rule), scopeSourceId: rule.id });

    const closeModals = () => {
        setEditorTarget(undefined);
        setIsTypeSelectionOpen(false);
    };

    const deleteRule = async (id: string, name: string) => {
        const ok = await confirm({
            title: "Delete rule?",
            message: `"${name}" will be removed along with its user and server assignments.`,
            confirmLabel: "Delete",
            destructive: true,
        });
        if (!ok) return;

        try {
            await requestJson(`${RULES_ENDPOINT}/${id}`, { method: "DELETE" });
            toast(`Deleted "${name}"`);
        } catch (err) {
            toast(errorMessage(err, "Failed to delete rule"), "error");
        } finally {
            await mutate();
        }
    };

    const toggleRule = async (id: string, enabled: boolean) => {
        await mutate(
            (current) => current?.map((r) => (r.id === id ? { ...r, enabled } : r)),
            { revalidate: false }
        );
        try {
            await requestJson(`${RULES_ENDPOINT}/${id}`, { method: "PUT", body: { enabled } });
        } catch (err) {
            toast(errorMessage(err, "Failed to update rule"), "error");
        } finally {
            // Revalidate either way: confirms success, or reverts the optimistic flip.
            await mutate();
        }
    };

    /** Throws on failure so the editor can stay open with the user's input intact. */
    const saveRule = async (rule: RuleInstance) => {
        if (rule.id) {
            await requestJson(`${RULES_ENDPOINT}/${rule.id}`, { method: "PUT", body: rule });
        } else {
            await requestJson(RULES_ENDPOINT, { method: "POST", body: rule });
        }
        toast(rule.id ? `Saved "${rule.name}"` : `Created "${rule.name}"`);
        setEditorTarget(undefined);
        await mutate();
    };

    return {
        rules,
        isLoading,
        error: error as Error | undefined,
        retry: () => mutate(),
        editorTarget,
        isTypeSelectionOpen,
        actions: {
            openCreateModal,
            selectRuleType,
            openEditModal,
            duplicateRule,
            closeModals,
            deleteRule,
            toggleRule,
            saveRule,
        },
    };
}
