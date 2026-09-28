"use client";

import Link from "next/link";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { Shield } from "lucide-react";
import type { DirectoryUser, UserActivity } from "../types";
import { avatarSrc } from "@/lib/avatar";
import { formatLastSeen, formatPlays } from "../lib/format-activity";

type Props = {
    user: DirectoryUser;
    /** Totals for the memberships in view (respects the server filter). */
    activity: UserActivity;
    now: number;
};

/** One canonical identity — memberships shown as colored server badges. */
export function UserCard({ user, activity, now }: Props) {
    return (
        <Link href={`/settings/users/${encodeURIComponent(user.username)}`} className="block">
            <SettingsCard className="h-full hover:border-amber-500/50 transition-colors group/card">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 shrink-0 rounded-full bg-slate-800 overflow-hidden ring-2 ring-white/10 group-hover/card:ring-amber-500/50 transition-all">
                        {user.thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarSrc(user.thumb, user.title)} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center font-bold text-white/30 text-lg" aria-hidden>
                                {user.title.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-white truncate group-hover/card:text-amber-400 transition-colors">{user.title}</h4>
                            {user.isAdmin && (
                                <span title="Plex server admin" className="shrink-0">
                                    <Shield className="w-3 h-3 text-amber-500" aria-label="Plex server admin" role="img" />
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-white/40 truncate mb-1.5">
                            <span className="sr-only">Last seen: </span>
                            {formatLastSeen(activity.lastPlayedAt, now)}
                            <span aria-hidden> · </span>
                            {formatPlays(activity.plays)}
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {user.servers.map((server) => (
                                <span
                                    key={server.serverId}
                                    className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50"
                                >
                                    {server.serverName}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </SettingsCard>
        </Link>
    );
}
