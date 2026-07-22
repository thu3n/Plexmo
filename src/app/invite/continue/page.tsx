"use client";

import { SetupShell } from "@/features/setup/components/SetupShell";
import { SetupWizard } from "@/features/setup/components/SetupWizard";

/**
 * Resume target for invite-minted onboarding sessions: middleware redirects
 * any page navigation here while the session role is `onboarding`, so the
 * invitee lands back in the connect-your-server step (their session already
 * exists — no invite token needed).
 */
export default function InviteContinuePage() {
    return (
        <SetupShell
            title="Connect your server"
            subtitle="Finish onboarding by connecting your Plex server to this Plexmo instance."
        >
            <SetupWizard mode="invite-onboarding" />
        </SetupShell>
    );
}
