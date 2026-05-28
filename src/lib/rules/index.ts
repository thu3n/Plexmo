// Barrel for the rules module. Preserves the historical `@/lib/rules` import
// path after the file was split into focused submodules (crud / assignments /
// enforcement). Public export names are unchanged.

// RuleInstance is the shared domain type (client + server). Re-exported here so
// existing `import { RuleInstance } from "@/lib/rules"` call sites keep working.
export type { RuleInstance } from "@/features/rules/types";

export {
    getRuleInstances,
    getRuleInstance,
    createRuleInstance,
    updateRuleInstance,
    deleteRuleInstance,
    getUserRuleHistory,
    getGlobalRules,
    getUserRules,
} from "./rules-crud";

export {
    getRuleUsers,
    toggleUserRule,
    getRuleServers,
    toggleServerRule,
    getRuleAssignmentIds,
    getEnabledServersForRule,
    logRuleEvent,
    closeRuleEvent,
    deleteRuleEvent,
    updateRuleEventDetails,
} from "./rules-assignments";

export { checkAndLogViolations } from "./rules-enforcement";
