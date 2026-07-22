import type { RuleInstance } from "@/features/rules/types";

// A rule instance read back from the DB always has an id (and createdAt). The
// shared RuleInstance leaves id optional to cover unsaved drafts in the UI, so
// the DB getters return this narrower type to preserve the id guarantee.
export type PersistedRuleInstance = RuleInstance & { id: string };

// RuleInstanceRow is the raw `rule_instances` row shape — imported from db-types.

export interface RuleUserRow {
    userId: string;
    username: string;
}

export interface RuleServerRow {
    serverId: string;
    name: string;
}

export interface RuleEventRow {
    id: number;
    userId: string;
    ruleKey: string;
    triggeredAt: string;
    endedAt: string | null;
    details: string;
    ruleName: string | null;
    ruleType: string | null;
}
