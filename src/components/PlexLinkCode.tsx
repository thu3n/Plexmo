"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

const COPIED_RESET_MS = 2000;

/**
 * Device-code sign-in for installed PWAs: show the plex.tv/link code instead of
 * opening the OAuth popup (an out-of-scope popup navigation kicks iOS out of
 * standalone mode). The user authorizes on plex.tv/link — the in-app overlay
 * dismisses back into standalone and the existing PIN poll completes login.
 */
export function PlexLinkCode({ code }: { code: string }) {
    const { t } = useLanguage();
    const [copied, setCopied] = useState(false);

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), COPIED_RESET_MS);
        } catch {
            // Clipboard unavailable (http / permissions) — the code is visible anyway.
        }
    };

    return (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs text-white/60">{t("login.linkInstruction")}</p>
            <p className="font-mono text-3xl font-bold tracking-[0.3em] text-white">{code}</p>
            <div className="flex items-center justify-center gap-2">
                <button
                    onClick={copyCode}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? t("login.copied") : t("login.copyCode")}
                </button>
                <a
                    href="https://plex.tv/link"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
                >
                    {t("login.linkOpen")}
                </a>
            </div>
        </div>
    );
}
