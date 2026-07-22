"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Check, Copy, Link2, UserPlus } from "lucide-react";

const EXPIRY_PRESETS = [
    { label: "1 hour", hours: 1 },
    { label: "24 hours", hours: 24 },
    { label: "7 days", hours: 24 * 7 },
    { label: "30 days", hours: 24 * 30 },
];

export function CreateInviteModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { mutate } = useSWRConfig();
    const [type, setType] = useState<"onboarding" | "access">("onboarding");
    const [label, setLabel] = useState("");
    const [expiryHours, setExpiryHours] = useState(24 * 7);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdUrl, setCreatedUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const reset = () => {
        setType("onboarding");
        setLabel("");
        setExpiryHours(24 * 7);
        setCreatedUrl(null);
        setCopied(false);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/settings/invites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type,
                    label: label || null,
                    expiresAt: new Date(Date.now() + expiryHours * 3600_000).toISOString(),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed to create invite");
            setCreatedUrl(data.inviteUrl);
            mutate("/api/settings/invites");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create invite");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopy = async () => {
        if (!createdUrl) return;
        await navigator.clipboard.writeText(createdUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl relative">
                {createdUrl ? (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white">Invite created</h2>
                        <p className="text-sm text-amber-400/90 font-medium">
                            Copy this link now - it will not be shown again.
                        </p>
                        <div className="flex items-center gap-2">
                            <input
                                readOnly
                                value={createdUrl}
                                onFocus={(e) => e.target.select()}
                                className="min-w-0 flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/80 font-mono focus:outline-none"
                            />
                            <button
                                onClick={handleCopy}
                                className="shrink-0 p-3 rounded-xl bg-amber-500 text-slate-900 hover:bg-amber-400 transition"
                                aria-label="Copy invite link"
                            >
                                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                            </button>
                        </div>
                        <button
                            onClick={() => { reset(); onClose(); }}
                            className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        <h2 className="text-2xl font-bold text-white mb-6">Create invite link</h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid gap-3">
                                {([
                                    { key: "onboarding", icon: Link2, title: "Full onboarding", desc: "They sign in with Plex and connect their own server to this instance." },
                                    { key: "access", icon: UserPlus, title: "Access only", desc: "They become a viewer on your servers, like the email whitelist." },
                                ] as const).map((option) => (
                                    <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => setType(option.key)}
                                        className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${type === option.key ? "border-amber-500/50 bg-amber-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                                    >
                                        <option.icon className={`mt-0.5 h-5 w-5 shrink-0 ${type === option.key ? "text-amber-400" : "text-white/40"}`} />
                                        <span>
                                            <span className="block text-sm font-bold text-white">{option.title}</span>
                                            <span className="block text-xs text-white/50">{option.desc}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Label (optional)</label>
                                <input
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    placeholder="For Erik"
                                    maxLength={100}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Expires after</label>
                                <div className="flex flex-wrap gap-2">
                                    {EXPIRY_PRESETS.map((preset) => (
                                        <button
                                            key={preset.hours}
                                            type="button"
                                            onClick={() => setExpiryHours(preset.hours)}
                                            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${expiryHours === preset.hours ? "bg-white text-black" : "bg-white/5 text-white/60 hover:text-white"}`}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {error && <p className="text-sm text-rose-400">{error}</p>}
                            <div className="flex gap-4">
                                <button type="button" onClick={() => { reset(); onClose(); }} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold transition disabled:opacity-50">Create link</button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
