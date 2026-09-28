"use client";

import useSWR from "swr";
import { fetchJsonOrThrow, requestJson } from "@/lib/swr-fetch";
import { useFeedback, errorMessage } from "@/components/ui/Feedback";
import type { PublicServer } from "@/lib/servers";

export const SERVERS_KEY = "/api/servers";

/**
 * /api/servers also returns archived and orphaned (history-only) servers for
 * the history/stats filters. Settings manages only configured servers.
 */
export const isManagedServer = (server: PublicServer): boolean => !server.archived && server.hasToken;

export function useServers() {
    const { toast, confirm } = useFeedback();
    const { data, error, isLoading, mutate } = useSWR<{ servers: PublicServer[] }>(SERVERS_KEY, fetchJsonOrThrow);
    const servers = (data?.servers ?? []).filter(isManagedServer);

    const removeServer = async (server: PublicServer): Promise<void> => {
        const ok = await confirm({
            title: `Remove ${server.name}?`,
            message: `Plexmo stops monitoring this server and removes it from Settings. Its watch history, users and rule assignments are kept and come back automatically if you add the same server again. To keep it configured but stop polling, use Pause instead.`,
            confirmLabel: "Remove server",
            destructive: true,
        });
        if (!ok) return;
        try {
            await requestJson(`/api/servers/${server.id}`, { method: "DELETE" });
            toast(`${server.name} removed`);
        } catch (err) {
            toast(errorMessage(err, "Could not remove the server"), "error");
        } finally {
            await mutate();
        }
    };

    const setDisabled = async (server: PublicServer, disabled: boolean): Promise<void> => {
        if (disabled) {
            const ok = await confirm({
                title: `Pause monitoring ${server.name}?`,
                message:
                    "Plexmo stops polling this server and closes any sessions it is currently tracking into history. Nothing is deleted — resume at any time.",
                confirmLabel: "Pause monitoring",
            });
            if (!ok) return;
        }
        try {
            await requestJson(`/api/servers/${server.id}`, { method: "PUT", body: { disabled } });
            toast(disabled ? `Monitoring paused for ${server.name}` : `Monitoring resumed for ${server.name}`);
        } catch (err) {
            toast(errorMessage(err, "Could not update the server"), "error");
        } finally {
            await mutate();
        }
    };

    return { servers, error: error as Error | undefined, isLoading, refresh: mutate, removeServer, setDisabled };
}
