import { useState, useEffect, useMemo } from "react";
import type { PlexSession } from "@/lib/plex";

export type StreamRule = {
    value: number;
    enabled: boolean;
    enforce: boolean;
    excludeSameIp: boolean;
};

export const useRuleEnforcement = (sessions: PlexSession[]) => {
    const [maxStreamRule, setMaxStreamRule] = useState<StreamRule>({
        value: 0,
        enabled: false,
        enforce: false,
        excludeSameIp: false
    });
    const [ruleUsers, setRuleUsers] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchRules = async () => {
            try {
                const rulesRes = await fetch("/api/rules/instances");
                if (rulesRes.ok) {
                    const rules = await rulesRes.json();
                    const limitRule = rules.find((r: any) => r.type === "max_concurrent_streams");

                    if (limitRule) {
                        setMaxStreamRule({
                            value: parseInt(limitRule.settings.limit, 10),
                            enabled: limitRule.enabled,
                            enforce: limitRule.settings.enforce,
                            excludeSameIp: limitRule.settings.exclude_same_ip || false
                        });

                        // Fetch users for this rule
                        const usersRes = await fetch(`/api/rules/${limitRule.id}/users`);
                        if (!usersRes.ok) {
                            const legacyUsersRes = await fetch("/api/rules/max_concurrent_streams/users");
                            if (legacyUsersRes.ok) {
                                const users = await legacyUsersRes.json();
                                const enabledUsernames = new Set<string>(users.filter((u: any) => u.enabled).map((u: any) => u.username));
                                setRuleUsers(enabledUsernames);
                            }
                        } else {
                            const users = await usersRes.json();
                            const enabledUsernames = new Set<string>(users.filter((u: any) => u.enabled).map((u: any) => u.username));
                            setRuleUsers(enabledUsernames);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch rules", e);
            }
        };
        fetchRules();
    }, []);

    // Calculate violations
    const userViolations = useMemo(() => {
        // Only show badge if rule is enabled, limit is set, and NO acting configs (enforce/exclude) are active.
        if (!maxStreamRule.enabled || maxStreamRule.value <= 0 || maxStreamRule.enforce || maxStreamRule.excludeSameIp) {
            return new Set<string>();
        }

        const counts = new Map<string, number>();
        // Count ALL active sessions per user (globally, not just filtered)
        sessions.forEach(s => {
            const u = s.user;
            counts.set(u, (counts.get(u) || 0) + 1);
        });

        const violators = new Set<string>();
        counts.forEach((count, user) => {
            // Check if user is subject to the rule
            if (ruleUsers.has(user) && count > maxStreamRule.value) {
                violators.add(user);
            }
        });

        return violators;
    }, [sessions, maxStreamRule.enabled, maxStreamRule.value, maxStreamRule.enforce, maxStreamRule.excludeSameIp, ruleUsers]);

    return {
        ruleViolations: userViolations,
        maxStreamRule,
        setMaxStreamRule
    };
};
