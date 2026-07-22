"use client";

import { useState } from "react";
import useSWR from "swr";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { Link2, Plus, Trash2, UserPlus } from "lucide-react";
import { CreateInviteModal } from "./CreateInviteModal";
import type { InviteStatus, InviteType } from "@/lib/invites";

type InviteItem = {
    id: string;
    type: InviteType;
    label: string | null;
    createdAt: string;
    expiresAt: string;
    usedAt: string | null;
    usedByAccountId: string | null;
    status: InviteStatus;
};

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed");
    return response.json();
};

const STATUS_BADGE: Record<InviteStatus, string> = {
    active: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    used: "text-white/40 bg-white/5 border-white/10",
    expired: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

export function InviteList() {
    const { data, mutate, isLoading } = useSWR<{ invites: InviteItem[] }>("/api/settings/invites", fetchJson);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const locale = "en-US";

    const handleRevoke = async (id: string) => {
        if (!confirm("Revoke this invite link?")) return;
        await fetch(`/api/settings/invites?id=${id}`, { method: "DELETE" });
        mutate();
    };

    return (
        <div>
            <div className="mb-8">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-slate-900 font-bold hover:bg-amber-400 transition shadow-lg shadow-amber-500/20"
                >
                    <Plus className="w-5 h-5" />
                    Create invite link
                </button>
            </div>

            <div className="grid gap-4">
                {isLoading ? (
                    [1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />)
                ) : !data || data.invites.length === 0 ? (
                    <div className="p-8 text-center text-white/50 border border-dashed border-white/10 rounded-3xl">
                        No invite links yet. Create one to onboard a friend without email whitelisting.
                    </div>
                ) : (
                    data.invites.map((invite) => (
                        <SettingsCard key={invite.id} className="flex items-center justify-between group">
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
                                            {invite.type === "onboarding" ? "Full onboarding" : "Access only"}
                                        </span>
                                        <span className="text-[10px] text-white/30">
                                            {invite.status === "used" && invite.usedAt
                                                ? `Used ${new Date(invite.usedAt).toLocaleString(locale)}`
                                                : `Expires ${new Date(invite.expiresAt).toLocaleString(locale)}`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleRevoke(invite.id)}
                                className="p-2 shrink-0 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                aria-label="Revoke invite"
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
