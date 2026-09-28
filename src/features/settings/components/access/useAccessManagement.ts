"use client";

import { useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import { fetchJsonOrThrow, requestJson } from "@/lib/swr-fetch";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import {
    ACCESS_KEY,
    INVITES_KEY,
    SERVERS_KEY,
    personLabel,
    type AllowedUserItem,
    type InviteItem,
    type ServerOption,
} from "./access-types";

/** Servers for name lookup (all, incl. archived) and scoping (live ones only). */
export function useServerOptions() {
    const { data, error, isLoading } = useSWR<{ servers: ServerOption[] }>(SERVERS_KEY, fetchJsonOrThrow);
    return useMemo(() => {
        const servers = data?.servers ?? [];
        return {
            names: new Map(servers.map((s) => [s.id, s.name])),
            selectable: servers.filter((s) => !s.archived && s.baseUrl),
            error,
            isLoading,
        };
    }, [data, error, isLoading]);
}

/** Revoking an invite can remove a grant and vice versa — refresh both lists. */
const useRefreshAccess = () => {
    const { mutate } = useSWRConfig();
    return () => Promise.all([mutate(ACCESS_KEY), mutate(INVITES_KEY)]);
};

export function usePeopleWithAccess() {
    const { data, error, isLoading } = useSWR<{ users: AllowedUserItem[] }>(ACCESS_KEY, fetchJsonOrThrow);
    const { confirm, toast } = useFeedback();
    const refresh = useRefreshAccess();

    const remove = async (user: AllowedUserItem) => {
        const who = personLabel(user);
        const ok = await confirm({
            title: "Remove access?",
            message: `${who} will be signed out of Plexmo immediately and can no longer sign in.`,
            confirmLabel: "Remove access",
            destructive: true,
        });
        if (!ok) return;
        try {
            await requestJson(`${ACCESS_KEY}?id=${encodeURIComponent(user.id)}`, { method: "DELETE" });
            toast(`Removed access for ${who}`, "success");
        } catch (err) {
            toast(errorMessage(err, "Failed to remove access"), "error");
        }
        await refresh();
    };

    return { users: data?.users ?? [], error, isLoading, remove };
}

const revokePrompt = (invite: InviteItem) => {
    if (invite.grantId && invite.usedBy) {
        return {
            title: "Revoke invite and remove access?",
            message: `This invite was used by ${personLabel(invite.usedBy)}. Revoking it also removes their access and signs them out.`,
            confirmLabel: "Revoke and remove access",
        };
    }
    if (invite.status === "used") {
        return {
            title: "Remove used invite?",
            message:
                invite.type === "access"
                    ? "No active access is linked to this invite any more. This only clears it from the list - check People with access if someone should lose access."
                    : "This only clears it from the list. A server the invitee connected is managed under Servers.",
            confirmLabel: "Remove",
        };
    }
    return {
        title: "Revoke invite link?",
        message: "The link stops working immediately.",
        confirmLabel: "Revoke",
    };
};

export type NewInvite = {
    type: InviteItem["type"];
    label: string;
    expiryHours: number;
    serverIds: string[];
};

const MS_PER_HOUR = 3_600_000;

/** Creates an invite; resolves to the one-time URL (it is never retrievable again). */
export function useCreateInvite() {
    const { mutate } = useSWRConfig();
    return async (input: NewInvite): Promise<string> => {
        const data = await requestJson<{ inviteUrl: string }>(INVITES_KEY, {
            method: "POST",
            body: {
                type: input.type,
                label: input.label.trim() || null,
                expiresAt: new Date(Date.now() + input.expiryHours * MS_PER_HOUR).toISOString(),
                serverIds: input.type === "access" && input.serverIds.length > 0 ? input.serverIds : null,
            },
        });
        await mutate(INVITES_KEY);
        return data.inviteUrl;
    };
}

export function useInvites() {
    const { data, error, isLoading } = useSWR<{ invites: InviteItem[] }>(INVITES_KEY, fetchJsonOrThrow);
    const { confirm, toast } = useFeedback();
    const refresh = useRefreshAccess();

    const revoke = async (invite: InviteItem) => {
        if (!(await confirm({ ...revokePrompt(invite), destructive: true }))) return;
        try {
            const res = await requestJson<{ removedAccessEmail: string | null }>(
                `${INVITES_KEY}?id=${encodeURIComponent(invite.id)}`,
                { method: "DELETE" }
            );
            toast(
                res.removedAccessEmail ? `Invite revoked and access removed for ${res.removedAccessEmail}` : "Invite revoked",
                "success"
            );
        } catch (err) {
            toast(errorMessage(err, "Failed to revoke invite"), "error");
        }
        await refresh();
    };

    return { invites: data?.invites ?? [], error, isLoading, revoke };
}
