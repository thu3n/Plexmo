import type { RuleEventEntry } from "@/features/rules/types";

/** What the rule did: terminated streams, or only recorded the violation. */
export const describeEventAction = (e: RuleEventEntry): string => (e.enforced ? "Terminated" : "Logged");

/** Short type-specific context for an event, e.g. "3 streams (limit 2)". */
export const describeEventContext = (e: RuleEventEntry): string | null => {
    if (e.sessionTitle) return e.limit !== null ? `${e.sessionTitle} (paused > ${e.limit} min)` : e.sessionTitle;
    if (e.count !== null && e.limit !== null) return `${e.count} streams (limit ${e.limit})`;
    if (e.scheduleType) return e.scheduleType === "allow" ? "Outside allowed hours" : "During blocked hours";
    return null;
};
