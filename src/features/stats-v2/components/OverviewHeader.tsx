"use client";

import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { HeaderNav } from "@/components/HeaderNav";
import { StatsPeriodPills } from "@/features/stats/components/StatsPeriodPills";
import type { StatsPeriodKey } from "@/features/stats/lib/stats-periods";
import { getServerColor } from "@/lib/serverColors";
import type { PublicServer } from "@/lib/servers";

/** Once the page has scrolled this far, the sticky filter bar gets a backdrop. */
const SCROLLED_THRESHOLD_PX = 10;

/**
 * The app-wide page chrome (fixed black header with nav, same height as
 * Dashboard / History / Libraries so the nav never jumps) plus the sticky
 * period + server filter bar used by the v1 statistics page.
 */
export function OverviewHeader({
    period,
    onPeriodChange,
    dateRange,
    servers,
    serverId,
    onServerChange,
    children,
}: {
    period: StatsPeriodKey;
    onPeriodChange: (p: StatsPeriodKey) => void;
    dateRange: string;
    servers: PublicServer[];
    serverId: string | null;
    onServerChange: (id: string | null) => void;
    /** Extra row inside the sticky bar (the section tabs). */
    children?: ReactNode;
}) {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > SCROLLED_THRESHOLD_PX);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <>
            <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-black/80 safe-top">
                <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
                    <h1 className="text-xl font-bold tracking-tight text-white/90">Statistics</h1>
                    <div className="flex items-center gap-4">
                        <HeaderNav />
                        <UserMenu align="top-right" />
                    </div>
                </div>
            </header>

            <div
                id="overview"
                className={clsx(
                    "sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-40 -mx-3 -mt-3 mb-3 flex flex-wrap items-center gap-2 rounded-3xl p-3 transition-all duration-300",
                    scrolled && "bg-slate-950/95 shadow-2xl",
                )}
            >
                <div className="max-w-full overflow-x-auto no-scrollbar">
                    <StatsPeriodPills period={period} onPeriodChange={onPeriodChange} />
                </div>
                {servers.length > 1 && (
                    <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/5 bg-white/5 p-1 no-scrollbar">
                        <button
                            type="button"
                            onClick={() => onServerChange(null)}
                            className={clsx(
                                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                                serverId === null ? "bg-white text-black" : "text-white/60 hover:text-white",
                            )}
                        >
                            All
                        </button>
                        {servers.map((server) => {
                            const isActive = serverId === server.id;
                            return (
                                <button
                                    key={server.id}
                                    type="button"
                                    onClick={() => onServerChange(isActive ? null : server.id)}
                                    className={clsx(
                                        "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all",
                                        isActive ? "text-white ring-1 ring-white/20" : "text-white/60 hover:text-white",
                                    )}
                                    style={{ backgroundColor: isActive ? getServerColor(server.id, server.color) : "transparent" }}
                                >
                                    {server.name}
                                </button>
                            );
                        })}
                    </div>
                )}
                {dateRange && <span className="px-2 text-xs text-white/40 tabular-nums">{dateRange}</span>}
                {/* Wrapped lives outside the dock's five items; stats is where people look for it. */}
                <Link
                    href="/wrapped"
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-400/20"
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    Your Wrapped
                </Link>
                {children}
            </div>
        </>
    );
}
