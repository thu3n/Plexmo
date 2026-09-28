"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { Skeleton } from "@/components/Skeleton";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { fetchJsonOrThrow, requestJson } from "@/lib/swr-fetch";

const API_KEY_URL = "/api/settings/apikey";
const COPIED_FEEDBACK_MS = 2000;
/** Characters left visible at each end of a masked key, so owners can tell keys apart. */
const MASK_VISIBLE_CHARS = 4;

type ApiKeyResponse = { apiKey: string | null };

const maskKey = (key: string) =>
    key.length <= MASK_VISIBLE_CHARS * 2
        ? "•".repeat(key.length)
        : `${key.slice(0, MASK_VISIBLE_CHARS)}${"•".repeat(24)}${key.slice(-MASK_VISIBLE_CHARS)}`;

export function ApiKeyManager() {
    const { toast, confirm } = useFeedback();
    const { data, mutate, isLoading, error } = useSWR<ApiKeyResponse>(API_KEY_URL, fetchJsonOrThrow);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);
    const [justCopied, setJustCopied] = useState(false);
    const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
    }, []);

    const apiKey = data?.apiKey ?? null;

    const handleGenerate = async () => {
        if (apiKey) {
            const ok = await confirm({
                title: "Regenerate API key?",
                message:
                    "The current key stops working immediately. Every script, dashboard widget or other integration using it must be updated with the new key.",
                confirmLabel: "Regenerate",
                destructive: true,
            });
            if (!ok) return;
        }
        setIsGenerating(true);
        try {
            const result = await requestJson<ApiKeyResponse>(API_KEY_URL, { method: "POST" });
            await mutate(result, { revalidate: false });
            setIsRevealed(true);
            toast(apiKey ? "API key regenerated" : "API key generated");
        } catch (err) {
            toast(errorMessage(err, "Failed to generate API key"), "error");
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = async () => {
        if (!apiKey) return;
        try {
            await navigator.clipboard.writeText(apiKey);
            setJustCopied(true);
            if (copiedTimer.current) clearTimeout(copiedTimer.current);
            copiedTimer.current = setTimeout(() => setJustCopied(false), COPIED_FEEDBACK_MS);
        } catch {
            // Clipboard API is unavailable over plain HTTP and in some webviews.
            toast("Could not copy — reveal the key and copy it manually", "error");
        }
    };

    const iconButton =
        "flex items-center justify-center px-4 bg-white/5 hover:bg-white/15 hover:text-amber-400 active:scale-95 border border-white/5 rounded-xl transition-all text-white/70";

    return (
        <SettingsCard>
            <div className="flex flex-col md:flex-row gap-8 justify-between items-start">
                <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white">API Access</h3>
                    <p className="text-sm text-white/50 max-w-sm leading-relaxed">
                        Generate a secure key to allow third-party apps
                    </p>
                </div>

                <div className="w-full md:w-auto flex flex-col items-end gap-4">
                    <div className="flex items-stretch gap-2 w-full md:w-auto min-w-0">
                        {isLoading ? (
                            <Skeleton className="h-[54px] flex-1 md:min-w-[300px] rounded-xl" />
                        ) : (
                            <div
                                className={`font-mono text-sm bg-black/40 border px-5 py-4 rounded-xl flex-1 min-w-0 md:min-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-2 transition-colors ${isRevealed ? "select-all" : "select-none"} ${justCopied ? "border-emerald-400/50 text-emerald-400" : "border-white/10 text-white/80"}`}
                                aria-live="polite"
                            >
                                {error ? (
                                    <span className="text-rose-400">Failed to load API key</span>
                                ) : justCopied ? (
                                    "Copied!"
                                ) : apiKey ? (
                                    isRevealed ? apiKey : maskKey(apiKey)
                                ) : (
                                    <span className="flex items-center gap-2 text-white/50">
                                        <KeyRound className="w-4 h-4" /> No API key active
                                    </span>
                                )}
                            </div>
                        )}
                        {apiKey && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setIsRevealed((v) => !v)}
                                    className={iconButton}
                                    aria-label={isRevealed ? "Hide API key" : "Show API key"}
                                    aria-pressed={isRevealed}
                                    title={isRevealed ? "Hide" : "Show"}
                                >
                                    {isRevealed ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={copyToClipboard}
                                    className={iconButton}
                                    aria-label={justCopied ? "API key copied" : "Copy API key"}
                                    title="Copy"
                                >
                                    {justCopied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                                </button>
                            </>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isGenerating || isLoading}
                        className="text-sm font-bold text-amber-500 hover:text-amber-400 disabled:opacity-50 transition-colors px-2 py-1 flex items-center gap-2"
                    >
                        {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isGenerating ? "Generating..." : apiKey ? "Regenerate Key" : "Generate New Key"}
                    </button>
                </div>
            </div>
        </SettingsCard>
    );
}
