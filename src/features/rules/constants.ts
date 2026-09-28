import type { RuleSettings } from "@/features/rules/types";

export const RULE_TYPE = {
    MAX_CONCURRENT: "max_concurrent_streams",
    KILL_PAUSED: "kill_paused_streams",
    SCHEDULED: "scheduled_access",
} as const;

export const RULE_TYPE_LABELS: Record<string, string> = {
    [RULE_TYPE.MAX_CONCURRENT]: "Max Concurrent Streams",
    [RULE_TYPE.KILL_PAUSED]: "Kill Paused Stream",
    [RULE_TYPE.SCHEDULED]: "Scheduled Access",
};

export const ruleTypeLabel = (type: string): string => RULE_TYPE_LABELS[type] ?? type;

/** Bounds for the numeric `limit` field, per rule type. */
export const LIMIT_BOUNDS: Record<string, { min: number; max: number; unit: string }> = {
    [RULE_TYPE.MAX_CONCURRENT]: { min: 1, max: 100, unit: "streams" },
    [RULE_TYPE.KILL_PAUSED]: { min: 1, max: 1440, unit: "minutes" },
};

export const RULE_NAME_MAX_LENGTH = 100;

/** How many events the per-rule history panel requests. */
export const RULE_EVENTS_PAGE_SIZE = 50;

const DEFAULT_LIMIT = 1;
const DEFAULT_SCHEDULE_START = "22:00";
const DEFAULT_SCHEDULE_END = "07:00";
const WEEKDAYS = [1, 2, 3, 4, 5];

export const getDefaultSettings = (type: string): RuleSettings => {
    const base: RuleSettings = {
        limit: DEFAULT_LIMIT,
        enforce: false,
        kill_all: false,
        message: "",
        notify: true,
        exclude_same_ip: false,
    };
    if (type !== RULE_TYPE.SCHEDULED) return base;
    return {
        ...base,
        schedule: {
            type: "block",
            timeWindows: [{ startTime: DEFAULT_SCHEDULE_START, endTime: DEFAULT_SCHEDULE_END, days: [...WEEKDAYS] }],
        },
    };
};
