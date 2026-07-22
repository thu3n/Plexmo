"use client";

import { useEffect, useState } from "react";
import { Link2Off } from "lucide-react";
import { SetupShell } from "./SetupShell";
import { SetupWizard } from "./SetupWizard";

type InviteInfo = { type: "onboarding" | "access"; label: string | null };

/**
 * Public /invite/<token> flow: validates the link, then runs the shared
 * wizard in the mode the invite grants. Every invalid state (missing, used,
 * expired) renders the same generic card — by design.
 */
export function InviteClient({ token }: { token: string }) {
    const [state, setState] = useState<"loading" | "invalid" | InviteInfo>("loading");

    useEffect(() => {
        let cancelled = false;
        fetch("/api/invites/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
        })
            .then(async (res) => (res.ok ? ((await res.json()) as InviteInfo) : "invalid"))
            .catch(() => "invalid" as const)
            .then((result) => {
                if (!cancelled) setState(result);
            });
        return () => {
            cancelled = true;
        };
    }, [token]);

    if (state === "loading") {
        return (
            <SetupShell title="You're invited">
                <div className="glass-panel w-full max-w-md rounded-2xl p-10 text-center backdrop-blur-xl">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                </div>
            </SetupShell>
        );
    }

    if (state === "invalid") {
        return (
            <SetupShell title="Invite link">
                <div className="glass-panel w-full max-w-md rounded-2xl p-10 text-center backdrop-blur-xl">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-white/40 ring-1 ring-white/10">
                        <Link2Off className="h-8 w-8" />
                    </div>
                    <h2 className="mb-2 text-2xl font-semibold text-white">This invite link is invalid or has expired</h2>
                    <p className="text-sm text-slate-400">
                        Ask the person who invited you to create a new link.
                    </p>
                </div>
            </SetupShell>
        );
    }

    return (
        <SetupShell
            title="You're invited"
            subtitle={
                state.type === "onboarding"
                    ? "Sign in with Plex and connect your own server to this Plexmo instance."
                    : "Sign in with Plex to get access to this Plexmo instance."
            }
        >
            <SetupWizard
                mode={state.type === "onboarding" ? "invite-onboarding" : "invite-access"}
                inviteToken={token}
            />
        </SetupShell>
    );
}
