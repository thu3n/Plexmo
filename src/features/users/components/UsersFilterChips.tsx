"use client";

import { Shield, Moon } from "lucide-react";
import { INACTIVE_AFTER_DAYS } from "../lib/directory-query";
import type { UsersDirectoryState } from "../hooks/useUsersDirectory";

type Props = Pick<UsersDirectoryState, "filters" | "toggleFilter" | "matchedCount" | "totalUsers">;

const CHIPS = [
    { key: "adminOnly", label: "Admin", Icon: Shield, title: "Only Plex server admins" },
    {
        key: "inactiveOnly",
        label: "Inactive",
        Icon: Moon,
        title: `No plays in the last ${INACTIVE_AFTER_DAYS} days`,
    },
] as const;

export function UsersFilterChips({ filters, toggleFilter, matchedCount, totalUsers }: Props) {
    return (
        <div className="flex flex-wrap items-center gap-2 mb-6">
            {CHIPS.map(({ key, label, Icon, title }) => {
                const active = filters[key];
                return (
                    <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        title={title}
                        onClick={() => toggleFilter(key)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active
                            ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                            : "border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                            }`}
                    >
                        <Icon className="w-3.5 h-3.5" aria-hidden />
                        {label}
                    </button>
                );
            })}
            <span className="ml-auto text-xs text-white/40" aria-live="polite">
                {matchedCount === totalUsers ? `${totalUsers} users` : `${matchedCount} of ${totalUsers} users`}
            </span>
        </div>
    );
}
