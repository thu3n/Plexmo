"use client";

import { useState } from "react";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { Link2, Plus, Trash2, UserPlus } from "lucide-react";
import { CreateInviteModal } from "./CreateInviteModal";
import { formatDateTime, personLabel, serverScopeLabel, type InviteItem } from "./access-types";
import { useInvites, useServerOptions } from "./useAccessManagement";
import type { InviteStatus } from "@/lib/invites";

const STATUS_BADGE: Record<InviteStatus, string> = {
    active: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    used: "text-white/40 bg-white/5 border-white/10",
    expired: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

const usageLine = (invite: InviteItem): string => {
    if (invite.status !== "used") return `Link expires ${formatDateTime(invite.expiresAt)}`;
    const who = invite.usedBy ? ` by ${personLabel(invite.usedBy)}` : "";
    return `Used ${formatDateTime(invite.usedAt)}${who}`;
};

export function InviteList() {
    const { invites, error, isLoading, revoke } = useInvites();
    const { names } = useServerOptions();
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div>
            <div className="mb-8">
                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-slate-900 font-bold hover:bg-amber-400 transition shadow-lg shadow-amber-500/20"
                >
                    <Plus className="w-5 h-5" />
                    Create invite link
                </button>
            </div>

            <div className="grid gap-4 2xl:grid-cols-2">
                {isLoading ? (
                    [1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />)
                ) : error ? (
                    <div role="alert" className="p-6 text-center text-rose-300 border border-rose-500/20 bg-rose-500/5 rounded-3xl 2xl:col-span-2">
                        Could not load invite links: {error instanceof Error ? error.message : "unknown error"}
                    </div>
                ) : invites.length === 0 ? (
                    <div className="p-8 text-center text-white/50 border border-dashed border-white/10 rounded-3xl 2xl:col-span-2">
                        No invite links yet. Create one to onboard a friend without email whitelisting.
                    </div>
                ) : (
                    invites.map((invite) => (
                        <SettingsCard key={invite.id} className="flex items-center justify-between gap-4 group">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${invite.type === "onboarding" ? "bg-amber-500/20 text-amber-400" : "bg-indigo-500/20 text-indigo-400"}`}>
                                    {invite.type === "onboarding" ? <Link2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-white truncate">
                                        {invite.label || (invite.type === "onboarding" ? "Onboarding invite" : "Access invite")}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${STATUS_BADGE[invite.status]}`}>
                                            {invite.status}
                                        </span>
                                        <span className="text-[10px] uppercase font-bold text-white/40">
                                            {invite.type === "onboarding" ? "Full onboarding" : `Access only · ${serverScopeLabel(invite.serverIds, names)}`}
                                        </span>
                                        <span className="text-[10px] text-white/30">{usageLine(invite)}</span>
                                        {invite.type === "access" && invite.status === "used" && !invite.grantId && (
                                            <span className="text-[10px] text-white/30">· no linked access</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => revoke(invite)}
                                className="p-2 shrink-0 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                aria-label={invite.grantId ? "Revoke invite and remove access" : "Revoke invite"}
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </SettingsCard>
                    ))
                )}
            </div>

            <CreateInviteModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
}
