/**
 * Single source of truth for notification events. Shared by the server
 * dispatcher (colors, default templates) and the settings UI (labels, picker,
 * placeholder hints) so a new event is added in exactly one place.
 *
 * Event ids are persisted in `discord_webhooks.events` — never rename one.
 * "start" / "stop" / "terminate" predate this module and must stay as-is so
 * existing webhooks keep working.
 */

export const NOTIFICATION_EVENT_IDS = [
    "start",
    "stop",
    "pause",
    "resume",
    "transcode",
    "terminate",
    "rule_violation",
    "server_down",
    "server_up",
    "anomaly",
] as const;

export type NotificationEventId = (typeof NOTIFICATION_EVENT_IDS)[number];

/** Pseudo-event used only for the "send test" action; never stored on a webhook. */
export type DispatchEventId = NotificationEventId | "test";

export const PLACEHOLDERS = [
    "user",
    "title",
    "server",
    "player",
    "quality",
    "decision",
    "duration",
    "reason",
    "rule",
] as const;

export type Placeholder = (typeof PLACEHOLDERS)[number];
export type TemplateVars = Partial<Record<Placeholder, string>>;

export interface MessageTemplate {
    title: string;
    description: string;
}

export interface NotificationEventDefinition {
    id: NotificationEventId;
    label: string;
    description: string;
    category: "stream" | "enforcement" | "server";
    color: number;
    /** Placeholders that carry a value for this event (others render as "Unknown"). */
    placeholders: readonly Placeholder[];
    defaultTemplate: MessageTemplate;
}

const DISCORD_GREEN = 0x57f287;
const DISCORD_YELLOW = 0xfee75c;
const DISCORD_RED = 0xed4245;
const DISCORD_BLURPLE = 0x5865f2;
const DISCORD_FUCHSIA = 0xeb459e;
const DISCORD_GREY = 0x95a5a6;

const SESSION_PLACEHOLDERS = ["user", "title", "server", "player", "quality", "decision"] as const;

export const NOTIFICATION_EVENTS: readonly NotificationEventDefinition[] = [
    {
        id: "start",
        label: "Stream started",
        description: "A new playback session begins.",
        category: "stream",
        color: DISCORD_GREEN,
        placeholders: SESSION_PLACEHOLDERS,
        defaultTemplate: { title: "▶️ Stream Started", description: "**{user}** started watching **{title}**" },
    },
    {
        id: "stop",
        label: "Stream stopped",
        description: "A session ends and is written to history.",
        category: "stream",
        color: DISCORD_YELLOW,
        placeholders: ["user", "title", "server", "player", "duration"],
        defaultTemplate: { title: "⏹️ Stream Stopped", description: "**{user}** stopped watching **{title}** after {duration}" },
    },
    {
        id: "pause",
        label: "Stream paused",
        description: "A playing session is paused.",
        category: "stream",
        color: DISCORD_GREY,
        placeholders: SESSION_PLACEHOLDERS,
        defaultTemplate: { title: "⏸️ Stream Paused", description: "**{user}** paused **{title}**" },
    },
    {
        id: "resume",
        label: "Stream resumed",
        description: "A paused session starts playing again.",
        category: "stream",
        color: DISCORD_GREEN,
        placeholders: SESSION_PLACEHOLDERS,
        defaultTemplate: { title: "⏯️ Stream Resumed", description: "**{user}** resumed **{title}**" },
    },
    {
        id: "transcode",
        label: "Transcoding",
        description: "A session's video is transcoded (once per session).",
        category: "stream",
        color: DISCORD_FUCHSIA,
        placeholders: SESSION_PLACEHOLDERS,
        defaultTemplate: { title: "🔄 Transcoding", description: "**{user}** is transcoding **{title}** ({quality})" },
    },
    {
        id: "terminate",
        label: "Stream terminated",
        description: "An admin stops a stream from Plexmo.",
        category: "enforcement",
        color: DISCORD_RED,
        placeholders: [...SESSION_PLACEHOLDERS, "reason"],
        defaultTemplate: {
            title: "⚠️ Stream Terminated",
            description: "Stream for **{user}** watching **{title}** was terminated by admin.",
        },
    },
    {
        id: "rule_violation",
        label: "Rule violation",
        description: "A rule flags or terminates a session.",
        category: "enforcement",
        color: DISCORD_RED,
        placeholders: [...SESSION_PLACEHOLDERS, "reason", "rule"],
        defaultTemplate: { title: "🚫 Rule: {rule}", description: "**{user}** watching **{title}**: {reason}" },
    },
    {
        id: "server_down",
        label: "Server down",
        description: "A server stops responding to polls.",
        category: "server",
        color: DISCORD_RED,
        placeholders: ["server", "reason", "duration"],
        defaultTemplate: { title: "🔴 Server Down", description: "**{server}** is unreachable: {reason}" },
    },
    {
        id: "server_up",
        label: "Server back up",
        description: "A server that was down responds again.",
        category: "server",
        color: DISCORD_BLURPLE,
        placeholders: ["server", "duration"],
        defaultTemplate: { title: "🟢 Server Back Up", description: "**{server}** is reachable again after {duration}" },
    },
    {
        // Daily scan (src/lib/stats/anomalies-job.ts). {title} is the anomaly
        // headline, {reason} the measured detail. Opt-in: not in the defaults.
        id: "anomaly",
        label: "Unusual activity",
        description: "The daily scan finds a transcode spike, a silent server, a plays drop/spike or a new client transcoding.",
        category: "server",
        color: DISCORD_YELLOW,
        placeholders: ["server", "title", "reason"],
        defaultTemplate: { title: "📈 {title}", description: "**{server}**: {reason}" },
    },
];

export const DEFAULT_WEBHOOK_EVENTS: NotificationEventId[] = ["start", "stop", "terminate"];

const EVENT_BY_ID = new Map(NOTIFICATION_EVENTS.map((e) => [e.id, e]));

export const getEventDefinition = (id: NotificationEventId): NotificationEventDefinition =>
    EVENT_BY_ID.get(id)!;

export const isNotificationEventId = (value: unknown): value is NotificationEventId =>
    typeof value === "string" && EVENT_BY_ID.has(value as NotificationEventId);

/**
 * Keep only known event ids, de-duplicated. Unknown strings in old rows are
 * dropped rather than rejected so a stale value never breaks a webhook.
 */
export const sanitizeEvents = (events: unknown): NotificationEventId[] =>
    Array.isArray(events) ? Array.from(new Set(events.filter(isNotificationEventId))) : [];

/** Whether a webhook subscribed to `events` should receive `event`. Tests reach every webhook. */
export const webhookWantsEvent = (events: readonly string[], event: DispatchEventId): boolean =>
    event === "test" || events.includes(event);
