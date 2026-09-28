import type { NotificationEventId } from "./lib/events";

/** Webhook as returned by GET /api/notifications/webhooks — never carries the raw URL. */
export interface WebhookSummary {
    id: string;
    name: string;
    maskedUrl: string;
    events: NotificationEventId[];
    enabled: boolean;
    createdAt: string;
}

export interface WebhookFormValues {
    name: string;
    /** Blank on edit = keep the stored URL. */
    url: string;
    events: NotificationEventId[];
    enabled: boolean;
}
