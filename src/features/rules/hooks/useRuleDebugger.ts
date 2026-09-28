"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import type { RuleDebugResult, RuleUserAssignment } from "@/features/rules/types";
import { fetchJsonOrThrow, requestJson } from "@/lib/swr-fetch";
import { errorMessage } from "@/components/ui/Feedback";
import { summarizeDebugResults } from "@/features/rules/utils/debuggerLogic";
import { RULES_ENDPOINT } from "./useRuleManagement";

/** The "new" sentinel returns the full user roster with nothing assigned. */
const USER_ROSTER_URL = `${RULES_ENDPOINT}/new/users`;

export function useRuleDebugger() {
    const roster = useSWR<RuleUserAssignment[]>(USER_ROSTER_URL, fetchJsonOrThrow);
    const [selectedUser, setSelectedUser] = useState<RuleUserAssignment | null>(null);
    const [results, setResults] = useState<RuleDebugResult[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Ignore responses for a user the operator has already moved away from.
    const requestSeq = useRef(0);

    const runDebug = async (user: RuleUserAssignment) => {
        const seq = ++requestSeq.current;
        setLoading(true);
        setError(null);
        setResults(null);
        try {
            const data = await requestJson<RuleDebugResult[]>("/api/rules/debug", { method: "POST", body: { userId: user.userId } });
            if (seq === requestSeq.current) setResults(data);
        } catch (err) {
            if (seq === requestSeq.current) setError(errorMessage(err, "Failed to analyze rules"));
        } finally {
            if (seq === requestSeq.current) setLoading(false);
        }
    };

    const selectUser = (user: RuleUserAssignment) => {
        setSelectedUser(user);
        void runDebug(user);
    };

    const clear = () => {
        requestSeq.current++;
        setSelectedUser(null);
        setResults(null);
        setError(null);
        setLoading(false);
    };

    const summary = useMemo(() => (results ? summarizeDebugResults(results) : null), [results]);

    return {
        users: roster.data,
        usersError: roster.error as Error | undefined,
        selectedUser,
        selectUser,
        clear,
        retry: () => selectedUser && runDebug(selectedUser),
        loading,
        error,
        summary,
    };
}
