"use client";

import { useState } from "react";
import { EmptyRow, Panel } from "../Panel";
import { useProfileUsers, useUserProfile } from "../../hooks/people";
import { UserProfileCard } from "./UserProfileCard";

type Scope = { days: number; serverId: string | null };

/**
 * Viewing profile of one user, picked from everyone who played in the
 * period (most active first, the default selection).
 */
export function UserProfilePanel({ days, serverId }: Scope) {
    const users = useProfileUsers(days, serverId);
    const [picked, setPicked] = useState<string | null>(null);
    // A pick that fell out of the period's user list falls back to the most active user.
    const accountId =
        users?.some((u) => u.accountId === picked) ? picked : users?.[0]?.accountId ?? null;
    const profile = useUserProfile(accountId, days, serverId);

    const picker = users && users.length > 0 && (
        <select
            aria-label="User"
            value={accountId ?? ""}
            onChange={(e) => setPicked(e.target.value)}
            className="max-w-[12rem] truncate rounded-full border border-white/5 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-400/60"
        >
            {users.map((u) => (
                <option key={u.accountId} value={u.accountId} className="bg-neutral-900">
                    {u.user}
                </option>
            ))}
        </select>
    );

    return (
        <Panel id="user-profile" title="User profile" action={picker || undefined}>
            {users && users.length === 0 ? <EmptyRow /> : <UserProfileCard profile={profile} />}
        </Panel>
    );
}
