import { db } from "../db";
import { getRuleAssignmentIds, toggleServerRule, toggleUserRule } from "./rules-assignments";
import type { RuleAssignmentsPayload } from "./rule-payload";

/**
 * Replaces a rule's user/server assignments with the given sets in one
 * transaction, so the edit dialog can stage scope changes and commit them
 * together with the rest of the rule on Save.
 */
export const syncRuleAssignments = (ruleId: string, next: RuleAssignmentsPayload): void => {
    db.transaction(() => {
        const current = getRuleAssignmentIds(ruleId);
        const nextUsers = new Set(next.userIds);
        const nextServers = new Set(next.serverIds);
        const currentUsers = new Set(current.userIds);
        const currentServers = new Set(current.serverIds);

        for (const id of current.userIds) if (!nextUsers.has(id)) toggleUserRule(id, ruleId, false);
        for (const id of nextUsers) if (!currentUsers.has(id)) toggleUserRule(id, ruleId, true);
        for (const id of current.serverIds) if (!nextServers.has(id)) toggleServerRule(id, ruleId, false);
        for (const id of nextServers) if (!currentServers.has(id)) toggleServerRule(id, ruleId, true);
    })();
};
