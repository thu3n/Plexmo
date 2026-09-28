import type { PlexSession } from "./plex/plex-types";
import type { HistoryEntry } from "./history/types";
import { db } from "./db";
import type { TemplateVars } from "@/features/notifications/lib/events";
import { dispatchNotification, type EmbedField } from "./notifications/dispatch";

/**
 * Event-specific Discord senders. Each maps its domain object to template
 * variables + structured fields and hands off to the generic dispatcher, which
 * applies the (possibly customised) template and each webhook's event filter.
 */

const SECONDS_PER_MINUTE = 60;
const MS_PER_MINUTE = 60_000;

/** Keyed by the normalised decisions plex-sessions produces. */
const DECISION_LABELS: Record<string, string> = {
    transcode: "Transcode",
    "direct stream": "Direct Stream",
    "direct play": "Direct Play",
};

const formatMinutes = (minutes: number): string => `${Math.max(0, Math.round(minutes))} mins`;

const sessionTitle = (session: PlexSession): string =>
    session.grandparentTitle ? `${session.grandparentTitle} - ${session.title}` : session.title;

export const sessionVars = (session: PlexSession): TemplateVars => ({
    user: session.user,
    title: sessionTitle(session),
    server: session.serverName,
    player: session.player || session.device,
    quality: session.resolution || session.quality,
    decision: DECISION_LABELS[session.videoDecision ?? ""] ?? "Direct Play",
});

const sessionFields = (vars: TemplateVars): EmbedField[] => [
    { name: "Device", value: vars.player ?? "Unknown", inline: true },
    { name: "Server", value: vars.server ?? "Unknown", inline: true },
    { name: "Quality", value: `${vars.quality || "Unknown"} · ${vars.decision}`, inline: false },
];

const serverNameStmt = db.prepare<[string], { name: string }>("SELECT name FROM servers WHERE id = ?");

const logFailure = (event: string) => (e: unknown) => console.error(`Failed to send ${event} notification`, e);

export const sendSessionStartNotification = async (session: PlexSession) => {
    const vars = sessionVars(session);
    await dispatchNotification("start", vars, sessionFields(vars));
};

export const sendSessionStopNotification = async (entry: HistoryEntry) => {
    const vars: TemplateVars = {
        user: entry.user,
        title: entry.subtitle ? `${entry.title} - ${entry.subtitle}` : entry.title,
        server: serverNameStmt.get(entry.serverId)?.name,
        player: entry.device,
        duration: formatMinutes(entry.duration / SECONDS_PER_MINUTE),
    };
    await dispatchNotification("stop", vars, [
        { name: "Duration", value: vars.duration!, inline: true },
        { name: "Device", value: vars.player ?? "Unknown", inline: true },
    ]);
};

/** pause / resume / transcode, detected by the session event tracker. */
export const sendSessionEventNotification = (type: "pause" | "resume" | "transcode", session: PlexSession) => {
    const vars = sessionVars(session);
    dispatchNotification(type, vars, sessionFields(vars)).catch(logFailure(type));
};

/** Manual termination by an admin (session terminate API). */
export const sendSessionTerminatedNotification = async (session: PlexSession, reason: string) => {
    const vars = { ...sessionVars(session), reason };
    await dispatchNotification("terminate", vars, [{ name: "Reason", value: reason, inline: false }]);
};

/**
 * A rule flagged or terminated a session. Goes to the rule's own webhooks
 * (selected in the rule's Notifications tab, regardless of their event list)
 * and to every webhook subscribed to "rule_violation" — once each.
 */
export const sendRuleViolationNotification = async (
    session: PlexSession,
    ruleName: string,
    reason: string,
    ruleWebhookIds: readonly string[]
) => {
    const vars = { ...sessionVars(session), rule: ruleName, reason };
    await dispatchNotification(
        "rule_violation",
        vars,
        [
            { name: "Rule", value: ruleName, inline: true },
            { name: "Reason", value: reason, inline: false },
        ],
        ruleWebhookIds
    );
};

export const sendServerHealthNotification = (
    type: "server_down" | "server_up",
    serverName: string,
    outageMs: number,
    reason?: string
) => {
    const vars: TemplateVars = { server: serverName, reason, duration: formatMinutes(outageMs / MS_PER_MINUTE) };
    dispatchNotification(type, vars).catch(logFailure(type));
};
