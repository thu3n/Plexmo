"use client";

import { useState } from "react";
import type { HistoryEntry } from "@/lib/history";
import type { PlexSession } from "@/lib/plex";
import type { BundleResult } from "@/components/BundlingHelpers";
import { formatDateTime, formatTime, getPlayerIcon, getSplitDisplayTitle, useLivePause, historyThumbSrc } from "./HistoryHelpers";
import clsx from "clsx";
import { ChevronDown, ChevronRight, CornerDownRight } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

export interface HistoryItemProps {
    entry: HistoryEntry;
    timeZone: string;
    locale: string;
    isEditing: boolean;
    isSelected: boolean;
    onToggle: (e: React.SyntheticEvent) => void;
    onSelect: () => void;
}

export interface BundledProps {
    bundle: BundleResult;
    timeZone: string;
    locale: string;
    isEditing: boolean;
    selectedIds: Set<string>;
    onToggle: (id: string, e?: React.SyntheticEvent) => void;
    onToggleGroup: (entries: HistoryEntry[]) => void;
    onSelect: (entry: HistoryEntry) => void;
}

export function HistoryRow({ entry, timeZone, locale, isEditing, isSelected, onToggle, onSelect }: HistoryItemProps) {
    const details = entry.meta_json ? (JSON.parse(entry.meta_json) as PlexSession) : null;
    const isTranscode = details?.decision === "transcode";
    const isActive = !entry.stopTime;
    const { mainTitle, subTitle, isTV } = getSplitDisplayTitle(entry, details, locale);
    const pausedCounter = useLivePause(entry);

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

    // Prefer pause-adjusted play time (v5 fact column); wallclock as fallback
    // keeps active sessions and pre-migration rows working.
    const activeMinutes = Math.max(0, Math.round((entry.play_duration ?? entry.duration) / 60));
    const pausedMinutes = Math.round(pausedCounter / 60);
    const pausedDisplay = pausedMinutes > 0 ? `${pausedMinutes} min` : (pausedCounter > 0 ? `${pausedCounter}s` : "-");

    // Force visual consistency: Stop = Start + Duration + Paused
    // This prevents "off-by-one minute" confusion due to seconds rounding
    let displayStopTime = entry.stopTime;
    if (!isActive) {
        const durationAdder = activeMinutes * 60 * 1000;
        // If pause is displayed in minutes, use those minutes to keep math clean
        const pauseAdder = pausedMinutes > 0 ? (pausedMinutes * 60 * 1000) : (pausedCounter * 1000);
        displayStopTime = entry.startTime + durationAdder + pauseAdder;
    }

    const startTimeResult = formatTime(entry.startTime);
    const stopTimeResult = isActive ? <span className="text-emerald-400 font-bold animate-pulse text-[10px] uppercase">Active</span> : formatTime(displayStopTime);

    return (
        <tr
            onClick={isEditing ? onToggle : onSelect}
            className={clsx(
                "group cursor-pointer transition-colors border-b border-transparent last:border-0",
                isSelected ? "bg-amber-500/10 hover:bg-amber-500/20" : "hover:bg-white/5 active:bg-white/10"
            )}
        >
            {isEditing && (
                <td className="px-6 py-4">
                    <div onClick={(e) => e.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={onToggle}
                            className="w-5 h-5 rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
                        />
                    </div>
                </td>
            )}
            <td className="px-6 py-4">
                <div className="flex items-center gap-4">
                    <div className="relative h-10 w-16 shrink-0 rounded-lg overflow-hidden bg-black/40 ring-1 ring-white/10">
                        {historyThumbSrc(entry, details) ? <img loading="lazy" src={historyThumbSrc(entry, details)!} alt="" className="w-full h-full object-cover" /> : null}
                        <div className="absolute bottom-0 inset-x-0 h-0.5 bg-black/50">
                            <div className={clsx("h-full", progress >= 90 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-white truncate max-w-[200px]" title={mainTitle}>{mainTitle}</span>
                        {subTitle && (
                            <div className="flex items-center gap-1.5 min-w-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={isTV ? "/images/libraries/show.svg" : "/images/libraries/movie.svg"}
                                    alt={isTV ? "Series" : "Movie"}
                                    className="w-3 h-3 opacity-50 shrink-0"
                                />
                                <span className="text-xs text-white/50 truncate max-w-[200px]" title={subTitle}>{subTitle}</span>
                            </div>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <span className="inline-flex items-center rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-white/70 ring-1 ring-inset ring-white/10">
                    {entry.serverName || "Unknown"}
                </span>
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 shrink-0 rounded-full bg-indigo-500/20 ring-1 ring-inset ring-indigo-500/30 overflow-hidden">
                        {details?.userThumb ? <img loading="lazy" src={details.userThumb} alt="" className="w-full h-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[8px] font-bold text-indigo-300">{entry.user.slice(0, 1)}</div>}
                    </div>
                    <span className="text-xs font-medium text-white/80">{entry.user}</span>
                </div>
            </td>
            <td className="px-6 py-4 text-xs font-mono text-white/60">{startTimeResult}</td>
            <td className="px-6 py-4 text-xs font-mono text-white/60">{stopTimeResult}</td>
            <td className="px-6 py-4 text-xs font-medium text-white/70">
                {activeMinutes} min
            </td>
            <td className="px-6 py-4 text-xs font-medium text-amber-400/70">
                {pausedDisplay}
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex justify-end gap-2">
                    {/* Icons for decision/player */}
                    {isTranscode ? (
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500" title="Transcode">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0v2.433l-.312-.312a7 7 0 00-11.712 3.139.75.75 0 001.449.39 5.5 5.5 0 019.201-2.466l.312.312h-2.433a.75.75 0 000 1.5h4.242a.75.75 0 00.53-.219z" clipRule="evenodd" /></svg>
                        </div>
                    ) : (
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500" title="Direct Play">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                        </div>
                    )}
                    {getPlayerIcon(details?.player, details?.platform, "w-7 h-7 p-1.5 rounded-lg bg-white/5 text-white/50")}
                </div>
            </td>
        </tr>
    );
}

export function BundledHistoryRow({ bundle, timeZone, locale, isEditing, selectedIds, onToggle, onToggleGroup, onSelect }: BundledProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { entry, subEntries } = bundle;

    // Check if entire bundle is selected
    const isBundleSelected = subEntries.every(e => selectedIds.has(e.id));

    // Calculate aggregated stats (pause-adjusted play time when available —
    // fall back to wallclock minus pause for pre-v5 rows)
    const totalDuration = subEntries.reduce(
        (acc, curr) => acc + (curr.play_duration ?? Math.max(0, curr.duration - (curr.pausedCounter || 0))),
        0
    );
    const totalPaused = subEntries.reduce((acc, curr) => acc + curr.pausedCounter, 0);
    // Start time is the earliest start time of the group (last in the list if sorted desc)
    const startTimeResult = formatTime(subEntries[subEntries.length - 1].startTime);
    // Stop time is the LATEST stop time of ANY sub-entry
    const maxStopTime = Math.max(...subEntries.map(e => e.stopTime));
    const stopTimeResult = formatTime(maxStopTime);

    // Assuming subEntries are sorted DESC (latest first)
    const latestDetails = entry.meta_json ? (JSON.parse(entry.meta_json) as PlexSession) : null;
    const { mainTitle, subTitle, isTV } = getSplitDisplayTitle(entry, latestDetails, locale);

    // Progress for the bundle: totalDuration is already pause-adjusted.
    let bundleProgress = 0;
    if (latestDetails?.duration) {
        // Note: totalDuration is seconds, details.duration is ms.
        bundleProgress = Math.min(100, Math.round(((totalDuration * 1000) / latestDetails.duration) * 100));
    }

    // Check if fully watched?
    const isFullyWatched = bundleProgress >= 90;

    return (
        <>
            <tr
                className={clsx(
                    "group transition-colors border-b border-transparent last:border-0",
                    isExpanded ? "bg-white/5" : "hover:bg-white/5"
                )}
            >
                {isEditing && (
                    <td className="px-6 py-4">
                        <div onClick={(e) => e.stopPropagation()}>
                            <input
                                type="checkbox"
                                checked={isBundleSelected}
                                onChange={() => onToggleGroup(subEntries)}
                                className="w-5 h-5 rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
                            />
                        </div>
                    </td>
                )}

                {/* Expand Toggle + Title */}
                <td className="px-6 py-4 cursor-pointer relative" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-white/50 transition-colors">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative h-10 w-16 shrink-0 rounded-lg overflow-hidden bg-black/40 ring-1 ring-white/10">
                            {historyThumbSrc(entry, latestDetails) ? <img loading="lazy" src={historyThumbSrc(entry, latestDetails)!} alt="" className="w-full h-full object-cover" /> : null}
                            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-black/50">
                                <div className={clsx("h-full", isFullyWatched ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${bundleProgress}%` }} />
                            </div>
                            {/* Bundle Badge */}
                            <div className="absolute top-0 right-0 bg-black/60 backdrop-blur-md px-1 py-0.5 text-[8px] font-bold text-white rounded-bl-md ring-1 ring-white/10">
                                {subEntries.length}x
                            </div>
                        </div>

                        <div className="flex flex-col min-w-0">
                            <span className="font-bold text-white truncate max-w-[200px]" title={mainTitle}>{mainTitle}</span>
                            {subTitle && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <img
                                        src={isTV ? "/images/libraries/show.svg" : "/images/libraries/movie.svg"}
                                        alt={isTV ? "Series" : "Movie"}
                                        className="w-3 h-3 opacity-50 shrink-0"
                                    />
                                    <span className="text-xs text-white/50 truncate max-w-[200px]" title={subTitle}>{subTitle}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </td>

                {/* Server */}
                <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-white/70 ring-1 ring-inset ring-white/10">
                        {entry.serverName || "Unknown"}
                    </span>
                </td>

                {/* User */}
                <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 shrink-0 rounded-full bg-indigo-500/20 ring-1 ring-inset ring-indigo-500/30 overflow-hidden">
                            {latestDetails?.userThumb ? <img loading="lazy" src={latestDetails.userThumb} alt="" className="w-full h-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[8px] font-bold text-indigo-300">{entry.user.slice(0, 1)}</div>}
                        </div>
                        <span className="text-xs font-medium text-white/80">{entry.user}</span>
                    </div>
                </td>

                <td className="px-6 py-4 text-xs font-mono text-white/60">{startTimeResult}</td>
                <td className="px-6 py-4 text-xs font-mono text-white/60">{stopTimeResult}</td>

                <td className="px-6 py-4 text-xs font-medium text-white/70">
                    {Math.round(totalDuration / 60)} min
                </td>
                <td className="px-6 py-4 text-xs font-medium text-amber-400/70">
                    {Math.round(totalPaused / 60) > 0 ? `${Math.round(totalPaused / 60)} min` : "-"}
                </td>
                <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                        {/* Icons for decision/player */}
                        {latestDetails?.decision === "transcode" ? (
                            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500" title="Transcode">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0v2.433l-.312-.312a7 7 0 00-11.712 3.139.75.75 0 001.449.39 5.5 5.5 0 019.201-2.466l.312.312h-2.433a.75.75 0 000 1.5h4.242a.75.75 0 00.53-.219z" clipRule="evenodd" /></svg>
                            </div>
                        ) : (
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500" title="Direct Play">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                            </div>
                        )}
                        {getPlayerIcon(latestDetails?.player, latestDetails?.platform, "w-7 h-7 p-1.5 rounded-lg bg-white/5 text-white/50")}
                    </div>
                </td>
            </tr>

            {/* Expanded Rows */}
            {isExpanded && subEntries.map((sub, idx) => {
                // Mark entries (except the very first played, i.e. last in list) as "Resumed"
                const isResumedSession = idx < subEntries.length - 1;

                return (
                    <tr key={sub.id} className="bg-white/[0.02] border-b border-white/5 last:border-0 hover:bg-white/[0.04]">
                        {isEditing && <td></td>}
                        <td className="px-6 py-3 pl-14">
                            <div className="flex items-center gap-3">
                                <CornerDownRight className="w-4 h-4 text-white/20" />
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium text-white/70">
                                        {isResumedSession ? "Resume from continue watching" : "Initial Session"}
                                    </span>
                                </div>
                            </div>
                        </td>
                        <td></td>
                        <td></td>

                        {/* Individual Start/Stop */}
                        <td className="px-6 py-3 text-[11px] font-mono text-white/50">
                            {formatTime(sub.startTime)}
                        </td>
                        <td className="px-6 py-3 text-[11px] font-mono text-white/50">
                            {sub.stopTime ? formatTime(sub.stopTime) : "Active"}
                        </td>
                        <td className="px-6 py-3 text-[11px] font-mono text-white/50">
                            {Math.round(sub.duration / 60)}m
                        </td>
                        <td className="px-6 py-3"></td>

                        <td className="px-6 py-3 text-right">
                            <button
                                onClick={() => onSelect(sub)}
                                className="text-[10px] uppercase font-bold tracking-wider text-white/40 hover:text-white transition-colors"
                            >
                                View Details
                            </button>
                        </td>
                    </tr>
                );
            })}
        </>
    );
}
