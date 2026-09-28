import {
    getEventDefinition,
    isNotificationEventId,
    type MessageTemplate,
    PLACEHOLDERS,
    type NotificationEventId,
    type Placeholder,
    type TemplateVars,
} from "./events";

/** Discord embed limits (https://discord.com/developers/docs/resources/message#embed-object-embed-limits). */
export const DISCORD_LIMITS = {
    title: 256,
    description: 4096,
    fieldName: 256,
    fieldValue: 1024,
} as const;

/** Stored template length cap — generous, but keeps the settings row bounded. */
export const MAX_TEMPLATE_LENGTH = DISCORD_LIMITS.description;

const MISSING_VALUE = "Unknown";
const ELLIPSIS = "…";
const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;
const KNOWN_PLACEHOLDERS: ReadonlySet<string> = new Set(PLACEHOLDERS);

export type TemplateOverrides = Partial<Record<NotificationEventId, MessageTemplate>>;

/** Cut to `max` characters, marking the cut so a truncated message is obvious. */
export const clampText = (text: string, max: number): string =>
    text.length <= max ? text : `${text.slice(0, max - ELLIPSIS.length)}${ELLIPSIS}`;

/**
 * Plain single-pass substitution: `{name}` becomes the value, unknown names
 * are left verbatim. Values are never re-scanned, so a username containing
 * "{title}" cannot expand into anything.
 */
export const renderTemplate = (template: string, vars: TemplateVars): string =>
    template.replace(PLACEHOLDER_PATTERN, (match, name: string) => {
        if (!KNOWN_PLACEHOLDERS.has(name)) return match;
        const value = vars[name as Placeholder];
        return value && value.trim() !== "" ? value : MISSING_VALUE;
    });

/** Override for the event if one is saved and non-blank, else the default. */
export const resolveTemplate = (event: NotificationEventId, overrides: TemplateOverrides): MessageTemplate => {
    const fallback = getEventDefinition(event).defaultTemplate;
    const custom = overrides[event];
    return {
        title: custom?.title?.trim() ? custom.title : fallback.title,
        description: custom?.description?.trim() ? custom.description : fallback.description,
    };
};

export const renderMessage = (
    event: NotificationEventId,
    vars: TemplateVars,
    overrides: TemplateOverrides
): MessageTemplate => {
    const template = resolveTemplate(event, overrides);
    return {
        // Discord rejects the whole message on an empty or oversized title.
        title: clampText(renderTemplate(template.title, vars), DISCORD_LIMITS.title) || MISSING_VALUE,
        description: clampText(renderTemplate(template.description, vars), DISCORD_LIMITS.description),
    };
};

const isTemplateShape = (value: unknown): value is MessageTemplate => {
    if (!value || typeof value !== "object") return false;
    const { title, description } = value as Record<string, unknown>;
    return typeof title === "string" && typeof description === "string";
};

/**
 * Validate untrusted template input (API body or stored JSON). Unknown events
 * and malformed entries are dropped; strings are length-capped.
 */
export const sanitizeTemplates = (input: unknown): TemplateOverrides => {
    const result: TemplateOverrides = {};
    if (!input || typeof input !== "object" || Array.isArray(input)) return result;
    for (const [key, value] of Object.entries(input)) {
        if (!isNotificationEventId(key) || !isTemplateShape(value)) continue;
        result[key] = {
            title: value.title.slice(0, DISCORD_LIMITS.title),
            description: value.description.slice(0, MAX_TEMPLATE_LENGTH),
        };
    }
    return result;
};

/** Example values for the settings preview. */
export const SAMPLE_VARS: Required<TemplateVars> = {
    user: "Alice",
    title: "The Expanse - Leviathan Wakes",
    server: "Living Room",
    player: "Apple TV",
    quality: "1080p",
    decision: "Transcode",
    duration: "42 mins",
    reason: "Stream limit exceeded",
    rule: "Max 2 streams",
};
