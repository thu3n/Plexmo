import { getSetting, setSetting } from "./settings";
import { PlexSession, decodePlexString } from "./plex";
import { HistoryEntry } from "./history";
import { db } from "./db";
import type { DiscordWebhookRow, CountRow } from "./db-types";

type DiscordEmbed = {
    title: string;
    description?: string;
    color?: number;
    fields?: { name: string; value: string; inline?: boolean }[];
    thumbnail?: { url: string };
    image?: { url: string };
    footer?: { text: string; icon_url?: string };
    timestamp?: string;
    url?: string;
};

const COLORS = {
    START: 0x57F287, // Green
    STOP: 0xFEE75C,  // Yellow
    TERMINATE: 0xED4245, // Red
    DEFAULT: 0x5865F2, // Blurple
};

export type DiscordWebhook = {
    id: string;
    name: string;
    url: string;
    events: string[]; // ["start", "stop", "terminate"]
    enabled: boolean;
    createdAt: string;
};

// Migration / Initialization
const migrateWebhooks = () => {
    try {
        const count = db.prepare<[], CountRow>("SELECT COUNT(*) as count FROM discord_webhooks").get()!.count;
        if (count === 0) {
            // Check for legacy setting
            const legacyUrl = getSetting("discordWebhookUrl");
            if (legacyUrl) {
                const events = [];
                if (getSetting("discordNotifyStart", "true") === "true") events.push("start");
                if (getSetting("discordNotifyStop", "true") === "true") events.push("stop");
                if (getSetting("discordNotifyTerminate", "true") === "true") events.push("terminate");

                if (events.length > 0) {
                    db.prepare(`
                        INSERT INTO discord_webhooks (id, name, url, events, enabled, createdAt)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).run(
                        crypto.randomUUID(),
                        "Default Webhook",
                        legacyUrl,
                        JSON.stringify(events),
                        getSetting("discordEnabled", "true") === "true" ? 1 : 0,
                        new Date().toISOString()
                    );
                    console.log("[Discord] Migrated legacy webhook");
                }
            }
        }
    } catch (e) {
        console.error("[Discord] Migration failed:", e);
    }
};

// Run migration check once on module load (or could be explicit)
migrateWebhooks();

export const getWebhooks = (): DiscordWebhook[] => {
    try {
        const rows = db.prepare<[], DiscordWebhookRow>("SELECT * FROM discord_webhooks").all();
        return rows.map((row): DiscordWebhook => ({
            id: row.id,
            name: row.name,
            url: row.url,
            events: JSON.parse(row.events),
            enabled: row.enabled === 1,
            createdAt: row.createdAt,
        }));
    } catch (e) {
        console.error("Failed to get webhooks:", e);
        return [];
    }
};

export interface WebhookInput {
    name: string;
    url: string;
    events: string[];
    enabled?: boolean;
}

/** Create a webhook; returns the generated id. */
export const createWebhook = (input: WebhookInput): string => {
    const id = crypto.randomUUID();
    db.prepare(`
        INSERT INTO discord_webhooks (id, name, url, events, enabled, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        id,
        input.name,
        input.url,
        JSON.stringify(input.events),
        input.enabled === false ? 0 : 1,
        new Date().toISOString()
    );
    return id;
};

/** Update an existing webhook's editable fields. */
export const updateWebhook = (id: string, input: WebhookInput): void => {
    db.prepare(`
        UPDATE discord_webhooks
        SET name = @name, url = @url, events = @events, enabled = @enabled
        WHERE id = @id
    `).run({
        id,
        name: input.name,
        url: input.url,
        events: JSON.stringify(input.events),
        enabled: input.enabled ? 1 : 0,
    });
};

export const deleteWebhook = (id: string): void => {
    db.prepare("DELETE FROM discord_webhooks WHERE id = ?").run(id);
};

export const sendDiscordNotification = async (embed: DiscordEmbed, eventType: "start" | "stop" | "terminate" | "test", overrideUrl?: string) => {
    // If override URL is provided, send only to that URL
    if (overrideUrl) {
        try {
            await fetch(overrideUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: "Plexmo",
                    embeds: [embed],
                }),
            });
        } catch (error) {
            console.error(`Failed to send Discord notification to override URL:`, error);
        }
        return;
    }

    // 1. Get enabled webhooks
    const webhooks = getWebhooks().filter(w => w.enabled);
    if (webhooks.length === 0) return;

    // 2. Filter by event type
    const targets = eventType === "test"
        ? webhooks
        : webhooks.filter(w => w.events.includes(eventType));

    if (targets.length === 0) return;

    // 3. Send to all targets
    await Promise.allSettled(targets.map(async (webhook) => {
        try {
            await fetch(webhook.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: "Plexmo",
                    embeds: [embed],
                }),
            });
        } catch (error) {
            console.error(`Failed to send Discord notification to ${webhook.name}:`, error);
        }
    }));
};

export const sendSessionStartNotification = async (session: PlexSession) => {
    const title = session.grandparentTitle
        ? `${session.grandparentTitle} - ${session.title}`
        : session.title;

    const embed: DiscordEmbed = {
        title: "▶️ Stream Started",
        description: `**${session.user}** started watching **${title}**`,
        color: COLORS.START,
        fields: [
            { name: "Device", value: session.player || session.device || "Unknown", inline: true },
            { name: "Server", value: session.serverName || "Unknown", inline: true },
            { name: "Quality", value: `${session.resolution || "Unknown"} · ${session.videoDecision === "transcode" ? "Transcode" : "Direct Play"}`, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Plexmo" },
    };

    await sendDiscordNotification(embed, "start");
};

export const sendSessionStopNotification = async (entry: HistoryEntry) => {
    const title = entry.subtitle
        ? `${entry.title} - ${entry.subtitle}`
        : entry.title;

    const durationMins = Math.round(entry.duration / 60);

    const embed: DiscordEmbed = {
        title: "⏹️ Stream Stopped",
        description: `**${entry.user}** stopped watching **${title}**`,
        color: COLORS.STOP,
        fields: [
            { name: "Duration", value: `${durationMins} mins`, inline: true },
            { name: "Device", value: entry.device || "Unknown", inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Plexmo" },
    };

    await sendDiscordNotification(embed, "stop");
};

export const sendSessionTerminatedNotification = async (session: PlexSession, reason: string, overrideUrl?: string) => {
    const title = session.grandparentTitle
        ? `${session.grandparentTitle} - ${session.title}`
        : session.title;

    const embed: DiscordEmbed = {
        title: "⚠️ Stream Terminated",
        description: `Stream for **${session.user}** watching **${title}** was terminated by admin.`,
        color: COLORS.TERMINATE,
        fields: [
            { name: "Reason", value: reason, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Plexmo" },
    };

    await sendDiscordNotification(embed, "terminate", overrideUrl);
};
