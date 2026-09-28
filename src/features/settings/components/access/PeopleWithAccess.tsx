"use client";

import { Trash2, User } from "lucide-react";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { formatDateTime, serverScopeLabel } from "./access-types";
import { usePeopleWithAccess, useServerOptions } from "./useAccessManagement";

export function PeopleWithAccess() {
    const { users, error, isLoading, remove } = usePeopleWithAccess();
    const { names } = useServerOptions();

    if (isLoading) {
        return (
            <div className="grid gap-4 2xl:grid-cols-2" aria-busy="true">
                {[1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />)}
            </div>
        );
    }

    if (error) {
        return (
            <div role="alert" className="p-6 text-center text-rose-300 border border-rose-500/20 bg-rose-500/5 rounded-3xl">
                Could not load who has access: {error instanceof Error ? error.message : "unknown error"}
            </div>
        );
    }

    if (users.length === 0) {
        return (
            <div className="p-8 text-center text-white/50 border border-dashed border-white/10 rounded-3xl">
                Nobody besides server owners has access. People who redeem an access invite appear here.
            </div>
        );
    }

    return (
        <ul className="grid gap-4 2xl:grid-cols-2">
            {users.map((user) => (
                <li key={user.id}>
                    <SettingsCard className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center bg-indigo-500/20 text-indigo-400">
                                <User className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-bold text-white truncate">{user.username || user.email}</h4>
                                {user.username && <p className="text-xs text-white/50 truncate">{user.email}</p>}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] text-white/40">
                                    <span className="uppercase font-bold">{serverScopeLabel(user.serverIds, names)}</span>
                                    <span>Added {formatDateTime(user.createdAt)}</span>
                                    <span className={user.expiresAt ? "text-amber-400/80" : undefined}>
                                        {user.expiresAt ? `Expires ${formatDateTime(user.expiresAt)}` : "No expiry"}
                                    </span>
                                    {user.removeAfterLogin === 1 && <span>One-time (not yet used)</span>}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => remove(user)}
                            className="p-2 shrink-0 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            aria-label={`Remove access for ${user.username || user.email}`}
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </SettingsCard>
                </li>
            ))}
        </ul>
    );
}
