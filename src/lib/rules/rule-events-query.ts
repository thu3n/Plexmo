import { db } from "../db";
import type { RuleEventEntry } from "@/features/rules/types";

interface RuleEventJoinRow {
    id: number;
    userId: string;
    username: string | null;
    serverId: string | null;
    serverName: string | null;
    triggeredAt: string;
    endedAt: string | null;
    details: string | null;
}

/** Subset of the JSON the enforcement modules write into rule_events.details. */
interface RuleEventDetails {
    enforced?: unknown;
    count?: unknown;
    limit?: unknown;
    sessionTitle?: unknown;
    scheduleType?: unknown;
}

const recentEventsStmt = db.prepare<[string, number], RuleEventJoinRow>(`
    SELECT re.id, re.userId, ui.username, re.serverId, s.name AS serverName,
           re.triggeredAt, re.endedAt, re.details
    FROM rule_events re
    LEFT JOIN user_identities ui ON ui.accountId = re.userId
    LEFT JOIN servers s ON s.id = re.serverId
    WHERE re.ruleKey = ?
    ORDER BY re.triggeredAt DESC
    LIMIT ?
`);

const parseDetails = (raw: string | null): RuleEventDetails => {
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? (parsed as RuleEventDetails) : {};
    } catch {
        // Legacy rows may hold free text; treat as no structured details.
        return {};
    }
};

const numberOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const stringOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Most recent enforcement events for one rule, newest first. */
export const getRecentRuleEvents = (ruleId: string, limit: number): RuleEventEntry[] =>
    recentEventsStmt.all(ruleId, limit).map((row) => {
        const details = parseDetails(row.details);
        return {
            id: row.id,
            userId: row.userId,
            username: row.username,
            serverId: row.serverId,
            serverName: row.serverName,
            triggeredAt: row.triggeredAt,
            endedAt: row.endedAt,
            enforced: details.enforced === true,
            count: numberOrNull(details.count),
            limit: numberOrNull(details.limit),
            sessionTitle: stringOrNull(details.sessionTitle),
            scheduleType: stringOrNull(details.scheduleType),
        };
    });
