"use client";

import { useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { useWebhooks } from "../hooks/useWebhooks";
import type { WebhookSummary } from "../types";
import { WebhookCard } from "./WebhookCard";
import { WebhookModal } from "./WebhookModal";

const GRID_CLASS = "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 min-[1800px]:grid-cols-4";
const SKELETON_COUNT = 2;

/** Undefined = modal closed; null = adding; a webhook = editing it. */
type EditorTarget = WebhookSummary | null | undefined;

export function WebhookList() {
    const { webhooks, error, isLoading, retry, save, remove, sendTest } = useWebhooks();
    const [editing, setEditing] = useState<EditorTarget>(undefined);

    if (isLoading) {
        return (
            <div className={GRID_CLASS} aria-busy="true">
                {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                    <div key={i} className="h-48 animate-pulse rounded-3xl bg-white/5 border border-white/5" />
                ))}
            </div>
        );
    }

    if (error && !webhooks) {
        return (
            <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-300">
                <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
                <p className="text-sm flex-1">Couldn&apos;t load webhooks: {error.message}</p>
                <button type="button" onClick={() => retry()} className="text-sm font-bold text-white hover:text-amber-400">
                    Retry
                </button>
            </div>
        );
    }

    const list = webhooks ?? [];

    return (
        <>
            {list.length === 0 && (
                <p className="text-sm text-white/50 mb-4">
                    No webhooks yet. Add a Discord webhook to get notified about streams, rule violations and server outages.
                </p>
            )}
            <div className={GRID_CLASS}>
                {list.map((webhook) => (
                    <WebhookCard
                        key={webhook.id}
                        webhook={webhook}
                        onEdit={() => setEditing(webhook)}
                        onDelete={() => remove(webhook)}
                        onTest={() => sendTest(webhook)}
                    />
                ))}

                <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="group relative flex flex-col items-center justify-center min-h-[200px] rounded-3xl border border-dashed border-white/10 bg-white/5 transition-all hover:bg-white/10 hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
                >
                    <div className="p-4 rounded-full bg-amber-500/10 text-amber-500 mb-4 group-hover:scale-110 transition-transform">
                        <Plus className="w-8 h-8" aria-hidden="true" />
                    </div>
                    <span className="font-bold text-white group-hover:text-amber-400 transition-colors">Add Webhook</span>
                </button>
            </div>

            {editing !== undefined && (
                <WebhookModal
                    key={editing?.id ?? "new"}
                    webhook={editing}
                    onClose={() => setEditing(undefined)}
                    onSave={save}
                    onTestStored={sendTest}
                />
            )}
        </>
    );
}
