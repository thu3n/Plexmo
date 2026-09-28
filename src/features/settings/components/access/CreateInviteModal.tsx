"use client";

import { useState } from "react";
import { Check, Copy, Link2, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { ServerScopePicker } from "./ServerScopePicker";
import { useCreateInvite, useServerOptions, type NewInvite } from "./useAccessManagement";

const EXPIRY_PRESETS = [
    { label: "1 hour", hours: 1 },
    { label: "24 hours", hours: 24 },
    { label: "7 days", hours: 24 * 7 },
    { label: "30 days", hours: 24 * 30 },
];
const DEFAULT_EXPIRY_HOURS = 24 * 7;
const COPIED_FEEDBACK_MS = 2000;

const TYPE_OPTIONS = [
    { key: "onboarding", icon: Link2, title: "Full onboarding", desc: "They sign in with Plex and connect their own server to this instance." },
    { key: "access", icon: UserPlus, title: "Access only", desc: "They become a viewer on your servers, like the email whitelist." },
] as const;

const INITIAL: NewInvite = { type: "onboarding", label: "", expiryHours: DEFAULT_EXPIRY_HOURS, serverIds: [] };

const inputClass = "w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none";
const labelClass = "block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider";

export function CreateInviteModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const createInvite = useCreateInvite();
    const servers = useServerOptions();
    const { toast } = useFeedback();
    const [form, setForm] = useState<NewInvite>(INITIAL);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdUrl, setCreatedUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const update = (patch: Partial<NewInvite>) => setForm((prev) => ({ ...prev, ...patch }));

    const close = () => {
        setForm(INITIAL);
        setCreatedUrl(null);
        setCopied(false);
        setError(null);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            setCreatedUrl(await createInvite(form));
        } catch (err) {
            setError(errorMessage(err, "Failed to create invite"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopy = async () => {
        if (!createdUrl) return;
        try {
            await navigator.clipboard.writeText(createdUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
        } catch {
            toast("Could not copy automatically - select the link and copy it manually.", "error");
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={close}
            size="md"
            dismissible={!isSubmitting}
            title={createdUrl ? "Invite created" : "Create invite link"}
        >
            {createdUrl ? (
                <div className="space-y-6">
                    <p className="text-sm text-amber-400/90 font-medium">
                        Copy this link now - it will not be shown again.
                    </p>
                    <div className="flex items-center gap-2">
                        <input
                            readOnly
                            value={createdUrl}
                            aria-label="Invite link"
                            onFocus={(e) => e.target.select()}
                            className="min-w-0 flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/80 font-mono focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="shrink-0 p-3 rounded-xl bg-amber-500 text-slate-900 hover:bg-amber-400 transition"
                            aria-label="Copy invite link"
                        >
                            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                        </button>
                    </div>
                    <button type="button" onClick={close} className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition">
                        Done
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-3" role="radiogroup" aria-label="Invite type">
                        {TYPE_OPTIONS.map((option) => {
                            const isOn = form.type === option.key;
                            return (
                                <button
                                    key={option.key}
                                    type="button"
                                    role="radio"
                                    aria-checked={isOn}
                                    onClick={() => update({ type: option.key })}
                                    className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${isOn ? "border-amber-500/50 bg-amber-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                                >
                                    <option.icon className={`mt-0.5 h-5 w-5 shrink-0 ${isOn ? "text-amber-400" : "text-white/40"}`} />
                                    <span>
                                        <span className="block text-sm font-bold text-white">{option.title}</span>
                                        <span className="block text-xs text-white/50">{option.desc}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    {form.type === "access" && (
                        <ServerScopePicker
                            servers={servers.selectable}
                            selected={form.serverIds}
                            onChange={(serverIds) => update({ serverIds })}
                            isLoading={servers.isLoading}
                            error={servers.error}
                        />
                    )}
                    <div>
                        <label htmlFor="invite-label" className={labelClass}>Label (optional)</label>
                        <input
                            id="invite-label"
                            value={form.label}
                            onChange={(e) => update({ label: e.target.value })}
                            placeholder="For Erik"
                            maxLength={100}
                            className={inputClass}
                        />
                    </div>
                    <fieldset>
                        <legend className={labelClass}>Link expires after</legend>
                        <div className="flex flex-wrap gap-2">
                            {EXPIRY_PRESETS.map((preset) => (
                                <button
                                    key={preset.hours}
                                    type="button"
                                    aria-pressed={form.expiryHours === preset.hours}
                                    onClick={() => update({ expiryHours: preset.hours })}
                                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${form.expiryHours === preset.hours ? "bg-white text-black" : "bg-white/5 text-white/60 hover:text-white"}`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                    {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
                    <div className="flex gap-4">
                        <button type="button" onClick={close} disabled={isSubmitting} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition disabled:opacity-50">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold transition disabled:opacity-50">
                            {isSubmitting ? "Creating..." : "Create link"}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
