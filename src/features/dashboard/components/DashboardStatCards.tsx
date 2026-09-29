"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/components/LanguageContext";
import type { DashboardSummary } from "../utils/sessionSummary";
import { formatMbps } from "../utils/sessionSummary";
import { BandwidthIcon, DirectPlayIcon, DirectStreamIcon, StreamsIcon, TranscodeIcon } from "./DashboardIcons";
import { SplitBar } from "./SplitBar";

const LEGEND_ICON = "w-3.5 h-3.5 shrink-0";

function StatCardShell({
    icon,
    accent,
    label,
    value,
    aside,
    children,
    className = "",
}: {
    icon: ReactNode;
    accent: string;
    label: string;
    value: string;
    aside?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={`glass-panel flex flex-col gap-5 rounded-2xl p-5 ${className}`}>
            <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 ${accent}`}>
                    {icon}
                </div>
                <div className="flex min-w-0 flex-col">
                    <span className="mb-0.5 truncate text-[10px] font-bold uppercase leading-tight tracking-wider text-white/40">{label}</span>
                    <span className="flex items-baseline gap-2">
                        <span className="truncate text-2xl font-bold leading-none tracking-tight text-white tabular-nums">{value}</span>
                        {aside}
                    </span>
                </div>
            </div>
            <div className="mt-auto">{children}</div>
        </div>
    );
}

/** Total streams plus how Plex is delivering them — the three decisions always sum to the total. */
export function StreamsOverviewCard({ summary, className }: { summary: DashboardSummary; className?: string }) {
    const { t } = useLanguage();
    return (
        <StatCardShell
            className={className}
            icon={<StreamsIcon />}
            accent="text-amber-400"
            label={t("dashboard.streams")}
            value={summary.active.toString()}
            aside={
                summary.paused > 0 ? (
                    <span className="text-xs font-medium text-white/40">
                        {summary.paused} {t("dashboard.paused")}
                    </span>
                ) : null
            }
        >
            <SplitBar
                emptyLabel={t("dashboard.noActiveSessions")}
                segments={[
                    { key: "direct-play", label: t("dashboard.directPlay"), value: summary.directPlay, barClass: "bg-emerald-400", textClass: "text-emerald-400", icon: <DirectPlayIcon className={LEGEND_ICON} /> },
                    { key: "direct-stream", label: t("dashboard.directStream"), value: summary.directStream, barClass: "bg-sky-400", textClass: "text-sky-400", icon: <DirectStreamIcon className={LEGEND_ICON} /> },
                    { key: "transcode", label: t("dashboard.transcode"), value: summary.transcoding, barClass: "bg-rose-400", textClass: "text-rose-400", icon: <TranscodeIcon className={LEGEND_ICON} /> },
                ]}
            />
        </StatCardShell>
    );
}

/** Total bandwidth split by where it goes — WAN is what loads the server's uplink. */
export function BandwidthCard({ summary, className }: { summary: DashboardSummary; className?: string }) {
    const { t } = useLanguage();
    return (
        <StatCardShell
            className={className}
            icon={<BandwidthIcon />}
            accent="text-cyan-400"
            label={t("dashboard.bandwidth")}
            value={formatMbps(summary.bandwidth)}
        >
            <SplitBar
                emptyLabel={t("dashboard.networkLoad")}
                segments={[
                    { key: "lan", label: t("session.lan"), value: summary.lanBandwidth, display: formatMbps(summary.lanBandwidth), barClass: "bg-cyan-400", textClass: "text-cyan-400" },
                    { key: "wan", label: t("session.wan"), value: summary.wanBandwidth, display: formatMbps(summary.wanBandwidth), barClass: "bg-violet-400", textClass: "text-violet-400" },
                ]}
            />
        </StatCardShell>
    );
}
