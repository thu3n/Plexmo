import type { RuleSettings } from "@/features/rules/types";
import { LIMIT_BOUNDS, RULE_NAME_MAX_LENGTH, RULE_TYPE } from "@/features/rules/constants";

/**
 * Shape checks for rule create/update bodies. The UI validates too, but the
 * API is reachable directly (API key), so it must not trust the client.
 */

const KNOWN_TYPES = new Set<string>(Object.values(RULE_TYPE));

export interface RuleAssignmentsPayload {
    userIds: string[];
    serverIds: string[];
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

export const validateRuleName = (name: unknown): Result<string> => {
    if (typeof name !== "string" || !name.trim()) return { ok: false, error: "Rule name is required" };
    const trimmed = name.trim();
    if (trimmed.length > RULE_NAME_MAX_LENGTH) return { ok: false, error: "Rule name is too long" };
    return { ok: true, value: trimmed };
};

export const validateRuleType = (type: unknown): Result<string> =>
    typeof type === "string" && KNOWN_TYPES.has(type) ? { ok: true, value: type } : { ok: false, error: "Unknown rule type" };

export const validateRuleSettings = (type: string, settings: unknown): Result<RuleSettings> => {
    if (!isRecord(settings)) return { ok: false, error: "Invalid settings" };
    const bounds = LIMIT_BOUNDS[type];
    if (bounds) {
        const limit = settings.limit;
        if (typeof limit !== "number" || !Number.isInteger(limit) || limit < bounds.min || limit > bounds.max) {
            return { ok: false, error: `Limit must be between ${bounds.min} and ${bounds.max}` };
        }
    }
    return { ok: true, value: settings as unknown as RuleSettings };
};

export const validateWebhookIds = (ids: unknown): Result<string[]> =>
    ids === undefined ? { ok: true, value: [] } : isStringArray(ids) ? { ok: true, value: ids } : { ok: false, error: "Invalid webhook ids" };

/** `undefined` means "leave assignments untouched". */
export const validateAssignments = (raw: unknown): Result<RuleAssignmentsPayload | undefined> => {
    if (raw === undefined || raw === null) return { ok: true, value: undefined };
    if (!isRecord(raw)) return { ok: false, error: "Invalid assignments" };
    const userIds = raw.userIds ?? [];
    const serverIds = raw.serverIds ?? [];
    if (!isStringArray(userIds) || !isStringArray(serverIds)) return { ok: false, error: "Invalid assignments" };
    return { ok: true, value: { userIds, serverIds } };
};
