import { isAllowedOutboundUrl } from "@/lib/outbound-url";
import { sanitizeEvents } from "@/features/notifications/lib/events";
import type { WebhookInput } from "./webhook-store";

const MAX_NAME_LENGTH = 100;

export type ParsedWebhookInput = { ok: true; input: WebhookInput } | { ok: false; error: string };

/**
 * Validate a create/update body. On update the URL may be omitted or blank to
 * keep the stored one — the settings UI only ever sees a masked URL.
 */
export const parseWebhookInput = (body: unknown, { requireUrl }: { requireUrl: boolean }): ParsedWebhookInput => {
    if (!body || typeof body !== "object") return { ok: false, error: "Invalid input" };
    const { name, url, events, enabled } = body as Record<string, unknown>;

    if (typeof name !== "string" || name.trim() === "" || !Array.isArray(events)) {
        return { ok: false, error: "Invalid input" };
    }
    if (enabled !== undefined && typeof enabled !== "boolean") return { ok: false, error: "Invalid input" };

    const trimmedUrl = typeof url === "string" ? url.trim() : "";
    if (!trimmedUrl && requireUrl) return { ok: false, error: "Webhook URL is required" };
    // Validate on the write path so an unfetchable target can never be
    // persisted and fired repeatedly by the notification loop.
    if (trimmedUrl && !isAllowedOutboundUrl(trimmedUrl)) return { ok: false, error: "Invalid webhook URL" };

    return {
        ok: true,
        input: {
            name: name.trim().slice(0, MAX_NAME_LENGTH),
            url: trimmedUrl || undefined,
            events: sanitizeEvents(events),
            enabled,
        },
    };
};
