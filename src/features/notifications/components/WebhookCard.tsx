"use client";

import { useState } from "react";
import clsx from "clsx";
import { Bell, Edit2, Send, Trash2 } from "lucide-react";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import type { WebhookSummary } from "../types";

const ACTION_CLASS = "p-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 disabled:opacity-50";

/**
 * Actions are always visible below lg (touch has no hover) and on lg+ appear on
 * hover or when anything in the card has keyboard focus.
 */
export function WebhookCard({
    webhook,
    onEdit,
    onDelete,
    onTest,
}: {
    webhook: WebhookSummary;
    onEdit: () => void;
    onDelete: () => void;
    onTest: () => Promise<void>;
}) {
    const [isTesting, setIsTesting] = useState(false);
    const eventCount = webhook.events.length;

    const handleTest = async () => {
        setIsTesting(true);
        try {
            await onTest();
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <SettingsCard className="group relative flex flex-col justify-between min-h-[200px]">
            <div>
                <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-2xl bg-[#5865F2]/10 text-[#5865F2]">
                        <Bell className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <div className="flex gap-1 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={isTesting}
                            aria-label={`Send test to ${webhook.name}`}
                            title="Send test"
                            className={clsx(ACTION_CLASS, "hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200")}
                        >
                            <Send className={clsx("w-4 h-4", isTesting && "animate-pulse")} />
                        </button>
                        <button
                            type="button"
                            onClick={onEdit}
                            aria-label={`Edit ${webhook.name}`}
                            title="Edit"
                            className={clsx(ACTION_CLASS, "hover:bg-white/10 text-white/70 hover:text-white")}
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onDelete}
                            aria-label={`Delete ${webhook.name}`}
                            title="Delete"
                            className={clsx(ACTION_CLASS, "hover:bg-rose-500/20 text-rose-400 hover:text-rose-300")}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-1 break-words">{webhook.name}</h3>
                <p className="text-xs text-white/40 truncate font-mono" title="Webhook URL is hidden">{webhook.maskedUrl}</p>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className={clsx("text-xs font-bold uppercase tracking-wider", webhook.enabled ? "text-emerald-500" : "text-white/40")}>
                    {webhook.enabled ? "Active" : "Disabled"}
                </span>
                <div className="text-xs font-medium text-white/40 bg-white/5 px-2 py-1 rounded-md">
                    {eventCount} {eventCount === 1 ? "Event" : "Events"}
                </div>
            </div>
        </SettingsCard>
    );
}
