"use client";

import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, ChevronDown, Search } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { HeaderNav } from "@/components/HeaderNav";
import { STATS_PERIODS, type StatsPeriodKey } from "@/features/stats/lib/stats-periods";
import type { PublicServer } from "@/lib/servers";

export function OverviewHeader({
    period,
    onPeriodChange,
    dateRange,
    servers,
    serverId,
    onServerChange,
}: {
    period: StatsPeriodKey;
    onPeriodChange: (p: StatsPeriodKey) => void;
    dateRange: string;
    servers: PublicServer[];
    serverId: string | null;
    onServerChange: (id: string | null) => void;
}) {
    return (
        <header id="overview" className="flex flex-wrap items-start justify-between gap-4 pb-5 pt-2 safe-top">
            <div>
                <h1 className="text-[28px] font-semibold leading-tight text-white">Overview</h1>
                <p className="text-sm text-white/70">Your Plex server at a glance</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-0.5 overflow-x-auto rounded-lg border border-[#1b2742] bg-[#131d33] p-1 no-scrollbar">
                    {STATS_PERIODS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => onPeriodChange(p.key)}
                            className={clsx(
                                "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                                p.key === period ? "bg-[#1f3a78] text-white" : "text-white/75 hover:text-white",
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* The date chip doubles as the server filter — the screenshot has no
                    dedicated server picker, and multi-server is core to Plexmo. */}
                <label className="relative flex items-center gap-2 rounded-lg border border-[#1b2742] bg-[#131d33] py-2 pl-3 pr-8 text-xs text-white">
                    <CalendarDays className="h-3.5 w-3.5 text-white/70" />
                    <span className="whitespace-nowrap">{dateRange}</span>
                    {servers.length > 1 && (
                        <select
                            aria-label="Server"
                            value={serverId ?? ""}
                            onChange={(e) => onServerChange(e.target.value || null)}
                            className="ml-1 cursor-pointer appearance-none bg-transparent pr-4 text-white/70 outline-none"
                        >
                            <option value="" className="bg-[#0f1729]">All servers</option>
                            {servers.map((s) => (
                                <option key={s.id} value={s.id} className="bg-[#0f1729]">{s.name}</option>
                            ))}
                        </select>
                    )}
                    <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-white/60" />
                </label>

                <HeaderNav />
                <Link href="/history" aria-label="Search history" className="p-2 text-white/80 hover:text-white">
                    <Search className="h-5 w-5" />
                </Link>
                <UserMenu align="top-right" />
            </div>
        </header>
    );
}
