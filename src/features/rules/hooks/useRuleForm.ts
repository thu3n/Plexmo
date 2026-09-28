"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import type {
    ImpactedUser,
    RuleInstance,
    RuleServerAssignment,
    RuleUserAssignment,
} from "@/features/rules/types";
import { fetchJsonOrThrow, requestJson } from "@/lib/swr-fetch";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { LIMIT_BOUNDS } from "@/features/rules/constants";
import {
    firstErrorField,
    parseLimitInput,
    tabForError,
    validateRuleForm,
    type RuleFieldError,
    type RuleFormTab,
} from "@/features/rules/utils/ruleValidation";
import { RULES_ENDPOINT, type RuleEditorTarget } from "./useRuleManagement";

/** Sentinel the assignment endpoints accept for "no rule yet": full roster, nothing checked. */
const NEW_RULE_ID = "new";

const enabledIds = <T extends { enabled: boolean }>(rows: T[] | undefined, key: (row: T) => string) =>
    new Set((rows ?? []).filter((r) => r.enabled).map(key));

const toggleInSet = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
};

/**
 * All state for the rule editor. Scope changes are staged locally for both new
 * and existing rules and only committed with Save, so Cancel always discards.
 */
export function useRuleForm(target: RuleEditorTarget, onSave: (rule: RuleInstance) => Promise<void>) {
    const { toast } = useFeedback();
    const isEditing = !!target.rule.id;
    const scopeId = target.rule.id ?? target.scopeSourceId ?? NEW_RULE_ID;

    const [formData, setFormData] = useState<RuleInstance>(target.rule);
    const [limitInput, setLimitInput] = useState(String(target.rule.settings.limit));
    const [activeTab, setActiveTab] = useState<RuleFormTab>("config");
    const [showErrors, setShowErrors] = useState(false);
    const [focusRequest, setFocusRequest] = useState<{ field: RuleFieldError } | null>(null);

    const users = useSWR<RuleUserAssignment[]>(`${RULES_ENDPOINT}/${scopeId}/users`, fetchJsonOrThrow);
    const servers = useSWR<RuleServerAssignment[]>(`${RULES_ENDPOINT}/${scopeId}/servers`, fetchJsonOrThrow);
    const [draftUsers, setDraftUsers] = useState<Set<string> | null>(null);
    const [draftServers, setDraftServers] = useState<Set<string> | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [impactData, setImpactData] = useState<ImpactedUser[]>([]);

    const userIds = useMemo(() => draftUsers ?? enabledIds(users.data, (u) => u.userId), [draftUsers, users.data]);
    const serverIds = useMemo(() => draftServers ?? enabledIds(servers.data, (s) => s.serverId), [draftServers, servers.data]);
    const scopeLoaded = !!users.data && !!servers.data;

    const errors = useMemo(() => validateRuleForm(formData, limitInput), [formData, limitInput]);
    const visibleErrors = showErrors ? errors : {};

    // A new rule saves exactly the staged sets, so they decide; an edit whose
    // scope never loaded keeps its stored assignments.
    const isGlobalScope = scopeLoaded || !isEditing ? userIds.size === 0 && serverIds.size === 0 : !!target.rule.global;

    const buildRule = (): RuleInstance => {
        const parsedLimit = parseLimitInput(limitInput);
        const settings =
            LIMIT_BOUNDS[formData.type] && parsedLimit !== null ? { ...formData.settings, limit: parsedLimit } : formData.settings;
        // An edit whose scope never loaded must not wipe the stored assignments.
        const assignments =
            scopeLoaded || !isEditing ? { userIds: Array.from(userIds), serverIds: Array.from(serverIds) } : undefined;
        return { ...formData, name: formData.name.trim(), settings, assignments };
    };

    const submitSave = async () => {
        setIsSubmitting(true);
        try {
            await onSave(buildRule());
        } catch (err) {
            toast(errorMessage(err, "Failed to save rule"), "error");
        } finally {
            setIsSubmitting(false);
            setShowConfirmation(false);
        }
    };

    const analyzeImpact = async (rule: RuleInstance): Promise<ImpactedUser[]> => {
        setIsAnalyzing(true);
        try {
            const data = await requestJson<{ impactedUsers?: ImpactedUser[] }>("/api/rules/analyze", {
                method: "POST",
                body: { rule, assignments: rule.assignments ?? { userIds: [], serverIds: [] } },
            });
            return data.impactedUsers ?? [];
        } catch (err) {
            toast(errorMessage(err, "Impact analysis unavailable"), "info");
            return [];
        } finally {
            setIsAnalyzing(false);
        }
    };

    const requestSave = async () => {
        if (target.scopeSourceId && !scopeLoaded) {
            // Saving now would silently turn a scoped copy into a global rule.
            const failed = users.error || servers.error;
            toast(
                failed ? "Could not load the copied rule's scope; reopen the copy to retry." : "Still loading the copied rule's scope, try again in a moment.",
                failed ? "error" : "info"
            );
            return;
        }
        setShowErrors(true);
        const field = firstErrorField(errors);
        if (field) {
            setActiveTab(tabForError(field));
            setFocusRequest({ field });
            return;
        }
        const impacted = await analyzeImpact(buildRule());
        setImpactData(impacted);
        if (isGlobalScope || impacted.length > 0) setShowConfirmation(true);
        else await submitSave();
    };

    return {
        isEditing,
        formData,
        setFormData,
        limitInput,
        setLimitInput,
        activeTab,
        setActiveTab,
        errors: visibleErrors,
        focusRequest,
        scope: {
            users: users.data?.map((u) => ({ ...u, enabled: userIds.has(u.userId) })),
            servers: servers.data?.map((s) => ({ ...s, enabled: serverIds.has(s.serverId) })),
            error: (users.error ?? servers.error) as Error | undefined,
            toggleUser: (id: string, on: boolean) => setDraftUsers(toggleInSet(userIds, id, on)),
            toggleServer: (id: string, on: boolean) => setDraftServers(toggleInSet(serverIds, id, on)),
        },
        isGlobalScope,
        isBusy: isSubmitting || isAnalyzing,
        isSubmitting,
        isAnalyzing,
        showConfirmation,
        cancelConfirmation: () => setShowConfirmation(false),
        impactData,
        requestSave,
        submitSave,
    };
}

export type RuleFormState = ReturnType<typeof useRuleForm>;
