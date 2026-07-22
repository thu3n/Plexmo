"use client";

import { useState } from "react";
import useSWR from "swr";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";

const fetchJson = async <T,>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch");
    return response.json();
};

export function ApiKeyManager() {
    const { data, mutate, isLoading } = useSWR<{ apiKey: string | null }>("/api/settings/apikey", fetchJson);
    const [isGenerating, setIsGenerating] = useState(false);
    const [justCopied, setJustCopied] = useState(false);

    const handleGenerate = async () => {
        if (data?.apiKey && !confirm("Are you sure? This will invalidate the old key.")) return;
        setIsGenerating(true);
        try {
            await fetch("/api/settings/apikey", { method: "POST" });
            await mutate();
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = () => {
        if (data?.apiKey) {
            navigator.clipboard.writeText(data.apiKey);
            setJustCopied(true);
            setTimeout(() => setJustCopied(false), 2000);
        }
    };

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
                        <div
                            onClick={data?.apiKey ? copyToClipboard : undefined}
                            className={`font-mono text-sm bg-black/40 border px-5 py-4 rounded-xl flex-1 min-w-0 md:min-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap flex items-center select-all transition-colors ${data?.apiKey ? "cursor-pointer hover:bg-black/60 active:bg-black/70" : ""} ${justCopied ? "border-emerald-400/50 text-emerald-400" : "border-white/10 text-white/80"}`}
                            title={data?.apiKey ? "Tap to copy" : undefined}
                        >
                            {isLoading ? "Loading..." : justCopied ? "Copied!" : (data?.apiKey || "No API Key active")}
                        </div>
                        {data?.apiKey && (
                            <button
                                type="button"
                                onClick={copyToClipboard}
                                className="hidden sm:flex items-center justify-center px-5 bg-white/5 hover:bg-white/15 hover:text-amber-400 active:scale-95 border border-white/5 rounded-xl transition-all text-white/70"
                                title="Copy"
                            >
                                {justCopied ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                )}
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="text-sm font-bold text-amber-500 hover:text-amber-400 disabled:opacity-50 transition-colors px-2 py-1"
                    >
                        {isGenerating ? "Generating..." : (data?.apiKey ? "Regenerate Key" : "Generate New Key")}
                    </button>
                </div>
            </div>
        </SettingsCard>
    );
}
