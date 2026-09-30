"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import type { WrappedData } from "@/lib/stats/wrapped";
import { buildShareUrl, formatWrappedHours } from "../../lib/wrapped-format";
import { StoryCard } from "./StoryCard";

const COPIED_RESET_MS = 2000;

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-3">
            <p className="text-[10px] uppercase tracking-wide text-white/45">{label}</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
        </div>
    );
}

export function OutroCard({ data }: { data: WrappedData }) {
    const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
    const hours = formatWrappedHours(data.totals.seconds);

    const copy = async () => {
        const url = buildShareUrl(window.location.origin, data.userId, data.year);
        try {
            await navigator.clipboard.writeText(url);
            setCopied("ok");
        } catch {
            // Clipboard is unavailable on plain-HTTP LAN origins; the URL bar holds the same link.
            setCopied("failed");
        }
        setTimeout(() => setCopied(null), COPIED_RESET_MS);
    };

    return (
        <StoryCard eyebrow={`That was ${data.year}`} tone="amber">
            <p className="text-3xl font-bold leading-tight text-white">Thanks for watching, {data.userName}.</p>
            <div className="mt-6 grid grid-cols-2 gap-2">
                <Stat label="Watch time" value={`${hours.value} ${hours.unit}`} />
                <Stat label="Plays" value={data.totals.plays.toLocaleString("en-US")} />
                <Stat label="Top show" value={data.topShows[0]?.title ?? "—"} />
                <Stat label="Top movie" value={data.topMovies[0]?.title ?? "—"} />
            </div>
            <div className="mt-auto">
                <button
                    type="button"
                    onClick={copy}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-amber-300"
                >
                    {copied === "ok" ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                    {copied === "ok" ? "Link copied" : copied === "failed" ? "Copy failed — use the address bar" : "Copy link"}
                </button>
                <p className="mt-2 text-center text-[11px] text-white/40">Opens for you and the Plexmo owner once signed in; other viewers only ever see their own Wrapped.</p>
            </div>
        </StoryCard>
    );
}
