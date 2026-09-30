"use client";

import { GenresPanel } from "./GenresPanel";
import { SharedAccountsPanel } from "./SharedAccountsPanel";
import { UserLifecyclePanel } from "./UserLifecyclePanel";
import { UserProfilePanel } from "./UserProfilePanel";

type Scope = { days: number; serverId: string | null };

/**
 * Drop-in block for the People section: one column on mobile, two on lg.
 * The shared-accounts panel renders nothing for non-owners, so the last row
 * simply collapses for them.
 */
export function PeopleInsightsSection({ days, serverId }: Scope) {
    return (
        <div id="people-insights" className="grid scroll-mt-24 gap-4 lg:grid-cols-2">
            <UserLifecyclePanel days={days} serverId={serverId} />
            <GenresPanel days={days} serverId={serverId} />
            <div className="lg:col-span-2">
                <UserProfilePanel days={days} serverId={serverId} />
            </div>
            <SharedAccountsPanel days={days} serverId={serverId} />
        </div>
    );
}
