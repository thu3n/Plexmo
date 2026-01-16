"use client";

import { useState } from "react";
import type { PlexSession } from "@/lib/plex";
import { formatDateTime, getPlayerIcon, getSplitDisplayTitle, useLivePause } from "./HistoryHelpers";
import clsx from "clsx";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type HistoryItemProps, type BundledProps } from "./HistoryRow";

export function MobileHistoryCard({ entry, timeZone, locale, isEditing, isSelected, onToggle, onSelect }: HistoryItemProps) {
    const details = entry.meta_json ? (JSON.parse(entry.meta_json) as PlexSession) : null;
    const { mainTitle, subTitle, isTV } = getSplitDisplayTitle(entry, details, locale);
    const pausedCounter = useLivePause(entry);
    const isActive = !entry.stopTime;

    let progress = 0;
    if (details?.duration) {
        let rawProgress = 0;
        if (isActive && details) {
            const elapsed = (Date.now() - entry.startTime) / 1000 - pausedCounter;
            rawProgress = Math.round((elapsed / (details.duration / 1000)) * 100);
        } else {
            const viewedDuration = (entry.stopTime - entry.startTime) - (entry.pausedCounter * 1000);
            rawProgress = Math.round((viewedDuration / details.duration) * 100);
        }
        progress = Math.min(100, Math.max(0, rawProgress));
    }

    const relativeTime = (() => {
        const now = new Date();
        const start = new Date(entry.startTime);
        const diffMs = now.getTime() - start.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHrs < 24) {
            const diffMins = Math.floor(diffMs / (1000 * 60));
            return diffHrs === 0 ? `${diffMins}m ago` : `${diffHrs}h ago`;
        }
        return formatDateTime(entry.startTime).split(" ")[0];
    })();

    const pausedMinutes = Math.round(pausedCounter / 60);
    const pausedDisplay = pausedMinutes > 0 ? `${pausedMinutes} min` : (pausedCounter > 0 ? `${pausedCounter}s` : null);

    return (
        <div
            onClick={isEditing ? onToggle : onSelect}
            className={clsx(
                "relative flex items-center gap-4 p-4 rounded-3xl border transition-all cursor-pointer overflow-hidden",
                isSelected
                    ? "bg-amber-500/10 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                    : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
            )}
        >
            {isEditing && (
                <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onToggle}
                        className="w-5 h-5 rounded-full border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
                    />
                </div>
            )}

            <div className="relative shrink-0 w-16 h-24 rounded-xl overflow-hidden bg-black/40 shadow-lg ring-1 ring-white/10">
                {details?.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/image?path=${encodeURIComponent(details.thumb)}&serverId=${details.serverId || ""}`} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={isTV ? "/images/libraries/show.svg" : "/images/libraries/movie.svg"} alt="" className="w-8 h-8 opacity-20" />
                    </div>
                )}
                {/* Progress Bar Overlay */}
                <div className="absolute bottom-0 inset-x-0 h-1 bg-black/50">
                    <div className={clsx("h-full", progress >= 90 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="flex-1 min-w-0 py-1">
                <h4 className="text-sm font-bold text-white truncate">{mainTitle}</h4>
                <div className="flex items-center gap-1.5 mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={isTV ? "/images/libraries/show.svg" : "/images/libraries/movie.svg"}
                        alt={isTV ? "Series" : "Movie"}
                        className="w-3 h-3 opacity-50 shrink-0"
                    />
                    <p className="text-xs text-white/50 truncate flex-1" title={subTitle}>{subTitle || '\u00A0'}</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/5">
                        <div className="h-4 w-4 rounded-full overflow-hidden bg-white/10">
                            {details?.userThumb ? <img src={details.userThumb} alt="" className="w-full h-full object-cover" /> : <div className="text-[8px] flex items-center justify-center font-bold h-full">{entry.user.slice(0, 1)}</div>}
                        </div>
                        <span className="text-[10px] font-bold text-white/70 max-w-[60px] truncate">{entry.user}</span>
                    </div>
                    {isActive ? (
                        <span className="text-[10px] font-bold text-emerald-400 animate-pulse uppercase tracking-wider">Playing</span>
                    ) : (
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-medium text-white/30">{relativeTime}</span>
                            {pausedDisplay && <span className="text-[9px] text-amber-400/70 font-mono">Paused: {pausedDisplay}</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export function MobileBundledCard({ bundle, timeZone, locale, isEditing, selectedIds, onToggle, onToggleGroup, onSelect }: BundledProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { entry, subEntries } = bundle;

    const isBundleSelected = subEntries.every(e => selectedIds.has(e.id));

    // Same aggregated logic
    const totalDuration = subEntries.reduce((acc, curr) => acc + curr.duration, 0);

    const latestDetails = entry.meta_json ? (JSON.parse(entry.meta_json) as PlexSession) : null;
    const { mainTitle, subTitle } = getSplitDisplayTitle(entry, latestDetails, locale);

    // Just use MobileHistoryCard style but with expansion
    return (
        <div className="flex flex-col gap-1">
            <div
                className={clsx(
                    "relative flex items-center gap-4 p-4 rounded-3xl border bg-white/5 border-white/5 hover:bg-white/10",
                    isEditing && isBundleSelected ? "bg-amber-500/10 border-amber-500/50" : ""
                )}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {isEditing && (
                    <div className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={isBundleSelected}
                            onChange={() => onToggleGroup(subEntries)}
                            className="w-5 h-5 rounded-full border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
                        />
                    </div>
                )}
                {/* Simplified Card for Bundle Header */}
                <div className="relative shrink-0 w-16 h-24 rounded-xl overflow-hidden bg-black/40 shadow-lg ring-1 ring-white/10">
                    {latestDetails?.thumb ? <img src={`/api/image?path=${encodeURIComponent(latestDetails.thumb)}&serverId=${latestDetails.serverId || ""}`} alt="" className="w-full h-full object-cover" /> : null}
                    <div className="absolute top-0 right-0 bg-amber-500 text-black font-bold text-[9px] px-1.5 py-0.5 rounded-bl-lg">
                        {subEntries.length}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{mainTitle}</h4>
                    <span className="text-xs text-white/50">{subEntries.length} Sessions • {Math.round(totalDuration / 60)} min total</span>
                </div>

                <div className="p-2">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-white/50" /> : <ChevronRight className="w-5 h-5 text-white/50" />}
                </div>
            </div>

            {isExpanded && (
                <div className="pl-4 space-y-2 border-l-2 border-white/5 ml-4">
                    {subEntries.map(sub => (
                        <div key={sub.id} className="scale-95 origin-left">
                            <MobileHistoryCard
                                entry={sub}
                                timeZone={timeZone}
                                locale={locale}
                                isEditing={isEditing}
                                isSelected={selectedIds.has(sub.id)}
                                onToggle={(e: React.SyntheticEvent) => onToggle(sub.id, e)}
                                onSelect={() => onSelect(sub)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
