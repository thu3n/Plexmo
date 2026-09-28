"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { fetchJsonOrThrow, requestJson } from "@/lib/swr-fetch";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import type { MessageTemplate, NotificationEventId } from "../lib/events";
import type { TemplateOverrides } from "../lib/templates";

const TEMPLATES_KEY = "/api/notifications/templates";

/** Global per-event template overrides. Saving `null` for an event resets it to the default. */
export function useTemplates() {
    const { toast } = useFeedback();
    const { data, error, isLoading, mutate } = useSWR<{ templates: TemplateOverrides }>(TEMPLATES_KEY, fetchJsonOrThrow);
    const overrides = data?.templates;

    const saveTemplate = useCallback(
        async (event: NotificationEventId, template: MessageTemplate | null): Promise<boolean> => {
            const next: TemplateOverrides = { ...overrides };
            if (template) next[event] = template;
            else delete next[event];
            try {
                const res = await requestJson<{ templates: TemplateOverrides }>(TEMPLATES_KEY, {
                    method: "PUT",
                    body: { templates: next },
                });
                await mutate({ templates: res.templates }, { revalidate: false });
                toast(template ? "Template saved" : "Template reset to default");
                return true;
            } catch (err) {
                toast(errorMessage(err, "Failed to save template"), "error");
                return false;
            }
        },
        [overrides, mutate, toast]
    );

    return { overrides, error, isLoading, retry: () => mutate(), saveTemplate };
}
