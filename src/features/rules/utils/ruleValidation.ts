import type { RuleInstance } from "@/features/rules/types";
import { LIMIT_BOUNDS, RULE_NAME_MAX_LENGTH, RULE_TYPE } from "@/features/rules/constants";

export type RuleFormTab = "config" | "notifications" | "users";

export type RuleFieldError = "name" | "limit" | "schedule";

export type RuleFormErrors = Partial<Record<RuleFieldError, string>>;

/** Which modal tab hosts each validated field, so a failed save can jump there. */
const FIELD_TAB: Record<RuleFieldError, RuleFormTab> = {
    name: "config",
    limit: "config",
    schedule: "config",
};

/** Field order used to pick the first error to focus. */
const FIELD_ORDER: RuleFieldError[] = ["name", "limit", "schedule"];

const INTEGER_PATTERN = /^\d+$/;

/**
 * Parses the raw limit input. Returns null for anything that is not a plain
 * non-negative integer, so "", "1.5", "-2" and "1e3" are all rejected instead
 * of being silently coerced the way parseInt did.
 */
export const parseLimitInput = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!INTEGER_PATTERN.test(trimmed)) return null;
    return Number(trimmed);
};

export const validateRuleForm = (rule: RuleInstance, limitInput: string): RuleFormErrors => {
    const errors: RuleFormErrors = {};

    const name = rule.name.trim();
    if (!name) errors.name = "Rule name is required.";
    else if (name.length > RULE_NAME_MAX_LENGTH) errors.name = `Rule name must be at most ${RULE_NAME_MAX_LENGTH} characters.`;

    const bounds = LIMIT_BOUNDS[rule.type];
    if (bounds) {
        const limit = parseLimitInput(limitInput);
        if (limit === null) errors.limit = "Enter a whole number.";
        else if (limit < bounds.min || limit > bounds.max) {
            errors.limit = `Must be between ${bounds.min} and ${bounds.max} ${bounds.unit}.`;
        }
    }

    if (rule.type === RULE_TYPE.SCHEDULED) {
        const windows = rule.settings.schedule?.timeWindows ?? [];
        if (windows.length === 0) errors.schedule = "Add at least one time window.";
        else if (windows.some((w) => w.days.length === 0)) errors.schedule = "Every time window needs at least one day.";
    }

    return errors;
};

export const firstErrorField = (errors: RuleFormErrors): RuleFieldError | null =>
    FIELD_ORDER.find((field) => errors[field]) ?? null;

export const tabForError = (field: RuleFieldError): RuleFormTab => FIELD_TAB[field];
