import { parseOutboundUrl } from "@/lib/outbound-url";
import {
    getEventDefinition,
    webhookWantsEvent,
    type DispatchEventId,
    type NotificationEventId,
    type TemplateVars,
} from "@/features/notifications/lib/events";
import { DISCORD_LIMITS, clampText, renderMessage, type TemplateOverrides } from "@/features/notifications/lib/templates";
import { getWebhooks, type DiscordWebhook } from "./webhook-store";
import { getTemplateOverrides } from "./template-store";

export type EmbedField = { name: string; value: string; inline?: boolean };

export type DiscordEmbed = {
    title: string;
    description?: string;
    color?: number;
    fields?: EmbedField[];
    footer?: { text: string };
    timestamp?: string;
};

const WEBHOOK_TIMEOUT_MS = 10_000;
const BOT_USERNAME = "Plexmo";
const TEST_COLOR = 0x0099ff;

export type PostResult = { ok: true } | { ok: false; error: string };

/**
 * Send one embed. The URL is re-validated here because rows persisted before
 * write-path validation existed may still hold a disallowed target.
 * `allowed_mentions` is empty so a username like "@everyone" can never ping.
 */
export const postEmbed = async (rawUrl: string, embed: DiscordEmbed, label: string): Promise<PostResult> => {
    const url = parseOutboundUrl(rawUrl);
    if (!url) {
        console.error(`Refusing to send Discord notification to ${label}: URL not allowed`);
        return { ok: false, error: "Webhook URL not allowed" };
    }
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: BOT_USERNAME, embeds: [embed], allowed_mentions: { parse: [] } }),
            signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        });
        // Only the status code is surfaced — echoing the body would make this a readable SSRF.
        if (!res.ok) return { ok: false, error: `Webhook endpoint returned ${res.status}` };
        return { ok: true };
    } catch (error) {
        console.error(`Failed to send Discord notification to ${label}:`, error);
        return { ok: false, error: "Failed to reach webhook endpoint" };
    }
};

const clampFields = (fields: EmbedField[]): EmbedField[] =>
    fields.map((f) => ({
        name: clampText(f.name, DISCORD_LIMITS.fieldName),
        value: clampText(f.value || "Unknown", DISCORD_LIMITS.fieldValue),
        inline: f.inline,
    }));

export const buildEmbed = (
    event: NotificationEventId,
    vars: TemplateVars,
    fields: EmbedField[],
    overrides: TemplateOverrides,
    now: Date = new Date()
): DiscordEmbed => {
    const { title, description } = renderMessage(event, vars, overrides);
    return {
        title,
        description: description || undefined,
        color: getEventDefinition(event).color,
        fields: fields.length > 0 ? clampFields(fields) : undefined,
        timestamp: now.toISOString(),
        footer: { text: BOT_USERNAME },
    };
};

/**
 * Enabled webhooks that should receive `event`: those subscribed to it, plus
 * any explicitly named (a rule's own webhook selection), each at most once.
 */
export const selectTargets = (
    webhooks: DiscordWebhook[],
    event: DispatchEventId,
    extraWebhookIds: readonly string[] = []
): DiscordWebhook[] => {
    const extra = new Set(extraWebhookIds);
    return webhooks.filter((w) => w.enabled && (webhookWantsEvent(w.events, event) || extra.has(w.id)));
};

export const dispatchNotification = async (
    event: NotificationEventId,
    vars: TemplateVars,
    fields: EmbedField[] = [],
    extraWebhookIds: readonly string[] = []
): Promise<void> => {
    const targets = selectTargets(getWebhooks(), event, extraWebhookIds);
    if (targets.length === 0) return;
    const embed = buildEmbed(event, vars, fields, getTemplateOverrides());
    await Promise.allSettled(targets.map((w) => postEmbed(w.url, embed, w.name)));
};

export const buildTestEmbed = (): DiscordEmbed => ({
    title: "Test Notification",
    description: "This is a test notification from Plexmo.",
    color: TEST_COLOR,
    timestamp: new Date().toISOString(),
    footer: { text: BOT_USERNAME },
});
