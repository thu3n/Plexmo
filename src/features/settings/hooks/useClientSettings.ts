"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { fetchJsonOrThrow, requestJson } from "@/lib/swr-fetch";

export const CLIENT_SETTINGS_URL = "/api/settings";

/**
 * The allowlisted key/value settings (APP_NAME, retention windows, last
 * retention run). Saves go through the same endpoint and revalidate the shared
 * SWR entry, so every card on the General page sees the new values.
 */
export function useClientSettings() {
    const { data, error, isLoading, mutate } = useSWR<Record<string, string>>(CLIENT_SETTINGS_URL, fetchJsonOrThrow);

    const saveSettings = useCallback(
        async (entries: Record<string, string>) => {
            // Sequential on purpose: the endpoint takes one key per request and a
            // failure should stop before writing the rest.
            for (const [key, value] of Object.entries(entries)) {
                await requestJson(CLIENT_SETTINGS_URL, { method: "POST", body: { key, value } });
            }
            await mutate();
        },
        [mutate]
    );

    return { settings: data, error, isLoading, saveSettings };
}
