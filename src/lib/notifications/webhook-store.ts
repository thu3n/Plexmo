import { getSetting } from "@/lib/settings";
import { db } from "@/lib/db";
import type { DiscordWebhookRow, CountRow } from "@/lib/db-types";
import { DEFAULT_WEBHOOK_EVENTS, sanitizeEvents, type NotificationEventId } from "@/features/notifications/lib/events";

export type DiscordWebhook = {
    id: string;
    name: string;
    url: string;
    events: NotificationEventId[];
    enabled: boolean;
    createdAt: string;
};

/** What the settings API exposes: the URL is a credential, so only a masked form leaves the server. */
export type PublicWebhook = Omit<DiscordWebhook, "url"> & { maskedUrl: string };

export interface WebhookInput {
    name: string;
    /** Omitted on update = keep the stored URL (the UI never receives it back). */
    url?: string;
    events: NotificationEventId[];
    enabled?: boolean;
}

const MASK = "••••••";
const LEGACY_EVENT_SETTINGS: [NotificationEventId, string][] = [
    ["start", "discordNotifyStart"],
    ["stop", "discordNotifyStop"],
    ["terminate", "discordNotifyTerminate"],
];

/** One-time import of the pre-multi-webhook single URL stored in settings. */
const migrateLegacyWebhook = () => {
    try {
        const count = db.prepare<[], CountRow>("SELECT COUNT(*) as count FROM discord_webhooks").get()!.count;
        if (count !== 0) return;
        const legacyUrl = getSetting("discordWebhookUrl");
        if (!legacyUrl) return;

        const events = LEGACY_EVENT_SETTINGS
            .filter(([, key]) => getSetting(key, "true") === "true")
            .map(([event]) => event);
        if (events.length === 0) return;

        db.prepare(
            "INSERT INTO discord_webhooks (id, name, url, events, enabled, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(
            crypto.randomUUID(),
            "Default Webhook",
            legacyUrl,
            JSON.stringify(events),
            getSetting("discordEnabled", "true") === "true" ? 1 : 0,
            new Date().toISOString()
        );
        console.log("[Discord] Migrated legacy webhook");
    } catch (e) {
        console.error("[Discord] Migration failed:", e);
    }
};

migrateLegacyWebhook();

const parseEvents = (raw: string): NotificationEventId[] => {
    try {
        return sanitizeEvents(JSON.parse(raw));
    } catch {
        return [...DEFAULT_WEBHOOK_EVENTS];
    }
};

const toWebhook = (row: DiscordWebhookRow): DiscordWebhook => ({
    id: row.id,
    name: row.name,
    url: row.url,
    events: parseEvents(row.events),
    enabled: row.enabled === 1,
    createdAt: row.createdAt,
});

export const getWebhooks = (): DiscordWebhook[] => {
    try {
        return db.prepare<[], DiscordWebhookRow>("SELECT * FROM discord_webhooks ORDER BY createdAt").all().map(toWebhook);
    } catch (e) {
        console.error("Failed to get webhooks:", e);
        return [];
    }
};

export const getWebhookById = (id: string): DiscordWebhook | null => {
    const row = db.prepare<[string], DiscordWebhookRow>("SELECT * FROM discord_webhooks WHERE id = ?").get(id);
    return row ? toWebhook(row) : null;
};

/** Host plus a fixed mask — enough to recognise the destination, useless for posting. */
export const maskWebhookUrl = (raw: string): string => {
    try {
        return `${new URL(raw).host}/${MASK}`;
    } catch {
        return MASK;
    }
};

export const toPublicWebhook = ({ url, ...rest }: DiscordWebhook): PublicWebhook => ({
    ...rest,
    maskedUrl: maskWebhookUrl(url),
});

/** Create a webhook; returns the generated id. */
export const createWebhook = (input: WebhookInput & { url: string }): string => {
    const id = crypto.randomUUID();
    db.prepare(
        "INSERT INTO discord_webhooks (id, name, url, events, enabled, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, input.name, input.url, JSON.stringify(input.events), input.enabled === false ? 0 : 1, new Date().toISOString());
    return id;
};

/** Update editable fields; returns false when the id does not exist. */
export const updateWebhook = (id: string, input: WebhookInput): boolean => {
    const result = db.prepare(
        `UPDATE discord_webhooks
         SET name = @name, url = COALESCE(@url, url), events = @events, enabled = @enabled
         WHERE id = @id`
    ).run({
        id,
        name: input.name,
        url: input.url ?? null,
        events: JSON.stringify(input.events),
        enabled: input.enabled === false ? 0 : 1,
    });
    return result.changes > 0;
};

export const deleteWebhook = (id: string): void => {
    db.prepare("DELETE FROM discord_webhooks WHERE id = ?").run(id);
};
