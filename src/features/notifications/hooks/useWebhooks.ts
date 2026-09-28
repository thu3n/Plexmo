"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { fetchJsonOrThrow, requestJson } from "@/lib/swr-fetch";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import type { WebhookFormValues, WebhookSummary } from "../types";

export const WEBHOOKS_KEY = "/api/notifications/webhooks";

/** Webhook list plus its mutations, with toast/confirm feedback. */
export function useWebhooks() {
    const { toast, confirm } = useFeedback();
    const { data, error, isLoading, mutate } = useSWR<{ webhooks: WebhookSummary[] }>(WEBHOOKS_KEY, fetchJsonOrThrow);

    /** Create or update; throws so the modal can stay open on failure. */
    const save = useCallback(
        async (values: WebhookFormValues, id?: string) => {
            const body = { ...values, url: values.url.trim() || undefined };
            await requestJson(id ? `${WEBHOOKS_KEY}/${id}` : WEBHOOKS_KEY, { method: id ? "PUT" : "POST", body });
            await mutate();
            toast(id ? "Webhook updated" : "Webhook added");
        },
        [mutate, toast]
    );

    const remove = useCallback(
        async (webhook: WebhookSummary) => {
            const ok = await confirm({
                title: "Delete webhook?",
                message: `"${webhook.name}" will stop receiving notifications. Rules using it will lose this destination.`,
                confirmLabel: "Delete",
                destructive: true,
            });
            if (!ok) return;
            try {
                await requestJson(`${WEBHOOKS_KEY}/${webhook.id}`, { method: "DELETE" });
                await mutate();
                toast("Webhook deleted");
            } catch (err) {
                toast(errorMessage(err, "Failed to delete webhook"), "error");
            }
        },
        [confirm, mutate, toast]
    );

    const sendTest = useCallback(
        async (webhook: WebhookSummary) => {
            try {
                await requestJson(`${WEBHOOKS_KEY}/${webhook.id}/test`, { method: "POST" });
                toast(`Test sent to "${webhook.name}"`);
            } catch (err) {
                toast(errorMessage(err, "Failed to send test"), "error");
            }
        },
        [toast]
    );

    return { webhooks: data?.webhooks, error, isLoading, retry: () => mutate(), save, remove, sendTest };
}
