"use client";

import type { HistoryEntry } from "@/lib/history";
import { formatDate } from "@/lib/format";
import { useState } from "react";
import { useLanguage } from "@/components/LanguageContext";
import { HistoryModal } from "./HistoryModal";
import clsx from "clsx";
import { Trash2, AlertCircle } from "lucide-react";
import { bundleHistoryEntries } from "@/components/BundlingHelpers";

import { HistoryRow, BundledHistoryRow } from "./HistoryRow";
import { MobileHistoryCard, MobileBundledCard } from "./MobileHistoryCard";
import { useHistorySelection } from "../hooks/useHistorySelection";
import { SkeletonRows } from "@/components/Skeleton";

export function HistoryList({
    history,
    timeZone,
    isEditing,
    onToggleEdit,
    onOpenStats
}: {
    history: HistoryEntry[];
    timeZone: string;
    isEditing: boolean;
    onToggleEdit: (editing: boolean) => void;
    onOpenStats?: (config: { title: string; seriesTitle?: string; year?: string; originalTitle?: string }) => void;
}) {
    const { t } = useLanguage();
    const locale = 'en-US';

    const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);

    // Use the extracted hook for selection state
    const {
        selectedIds,
        isDeleting,
        toggleSelection,
        toggleGroupSelection,
        deleteSelected
    } = useHistorySelection(() => onToggleEdit(false));

    if (!history) return <SkeletonRows count={8} rowClassName="h-16 rounded-2xl" />;
    if (history.length === 0) return (
        <div className="flex flex-col items-center justify-center p-20 text-center rounded-3xl border border-dashed border-white/10 bg-white/5">
            <div className="p-4 rounded-full bg-white/5 mb-4">
                <AlertCircle className="w-8 h-8 text-white/30" />
            </div>
            <h3 className="text-xl font-bold text-white">{t("dashboard.quiet")}</h3>
            <p className="text-white/50 mt-2">No playback history found matching your criteria.</p>
        </div>
    );

    const groupedHistory = history.reduce((groups, entry) => {
        const dateKey = formatDate(entry.startTime);
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(entry);
        return groups;
    }, {} as Record<string, HistoryEntry[]>);

    const sortedKeys = Object.keys(groupedHistory).sort((a, b) => {
        const timeA = groupedHistory[a][0]?.startTime || 0;
        const timeB = groupedHistory[b][0]?.startTime || 0;
        return timeB - timeA;
    });

    return (
        <>
            <div className="space-y-12 pb-24">
                {sortedKeys.map((date) => {
                    const bundles = bundleHistoryEntries(groupedHistory[date]);

                    return (
                        <div key={date} className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                            {/* Date Header */}
                            <div className="flex items-center gap-4 mb-6">
                                {isEditing && (
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
                                        checked={groupedHistory[date].every(e => selectedIds.has(e.id))}
                                        onChange={() => toggleGroupSelection(groupedHistory[date])}
                                    />
                                )}{" "}
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                <h3 className="text-sm font-bold uppercase tracking-widest text-white/60 whitespace-nowrap flex items-baseline gap-2">
                                    {date}
                                    <span className="text-[10px] font-medium normal-case tracking-normal text-white/30">
                                        {groupedHistory[date].length} {t("history.plays")}
                                    </span>
                                </h3>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            </div>

                            {/* Mobile Grid/List View */}
                            <div className="md:hidden grid gap-3 sm:grid-cols-2">
                                {bundles.map((bundle) => (
                                    bundle.type === 'bundle' ? (
                                        <MobileBundledCard
                                            key={bundle.entry.id}
                                            bundle={bundle}
                                            timeZone={timeZone}
                                            locale={locale}
                                            isEditing={isEditing}
                                            selectedIds={selectedIds}
                                            onToggle={toggleSelection}
                                            onToggleGroup={toggleGroupSelection}
                                            onSelect={(e) => !isEditing && setSelectedEntry(e)}
                                        />
                                    ) : (
                                        <MobileHistoryCard
                                            key={bundle.entry.id}
                                            entry={bundle.entry}
                                            timeZone={timeZone}
                                            locale={locale}
                                            isEditing={isEditing}
                                            isSelected={selectedIds.has(bundle.entry.id)}
                                            onToggle={(e: React.SyntheticEvent) => toggleSelection(bundle.entry.id, e)}
                                            onSelect={() => !isEditing && setSelectedEntry(bundle.entry)}
                                        />
                                    )
                                ))}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-hidden rounded-3xl border border-white/5 bg-white/5 backdrop-blur-sm">
                                <table className="w-full text-left text-sm text-white/80">
                                    <thead className="bg-white/5 text-xs font-bold uppercase tracking-wider text-white/50">
                                        <tr>
                                            {isEditing && <th className="w-12 px-6 py-4"></th>}
                                            <th className="px-6 py-4 w-[35%]">{t("session.stream")}</th>
                                            <th className="px-6 py-4 w-[10%]">{t("session.server")}</th>
                                            <th className="px-6 py-4 w-[15%]">User</th>
                                            <th className="px-6 py-4 w-[10%]">{t("common.start")}</th>
                                            <th className="px-6 py-4 w-[10%]">{t("common.end")}</th>
                                            <th className="px-6 py-4 w-[10%]">Duration</th>
                                            <th className="px-6 py-4 w-[5%]">Paused</th>
                                            <th className="px-6 py-4 w-[5%] text-right">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {bundles.map((bundle) => (
                                            bundle.type === 'bundle' ? (
                                                <BundledHistoryRow
                                                    key={bundle.entry.id}
                                                    bundle={bundle}
                                                    timeZone={timeZone}
                                                    locale={locale}
                                                    isEditing={isEditing}
                                                    selectedIds={selectedIds}
                                                    onToggle={toggleSelection}
                                                    onToggleGroup={toggleGroupSelection}
                                                    onSelect={(e) => !isEditing && setSelectedEntry(e)}
                                                />
                                            ) : (
                                                <HistoryRow
                                                    key={bundle.entry.id}
                                                    entry={bundle.entry}
                                                    timeZone={timeZone}
                                                    locale={locale}
                                                    isEditing={isEditing}
                                                    isSelected={selectedIds.has(bundle.entry.id)}
                                                    onToggle={(e: React.SyntheticEvent) => toggleSelection(bundle.entry.id, e)}
                                                    onSelect={() => !isEditing && setSelectedEntry(bundle.entry)}
                                                />
                                            )
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Selection/Deletion Bar — raised above the global dock on mobile. */}
            <div className={clsx(
                "fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] lg:bottom-[calc(2rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 transition-all duration-300 transform",
                isEditing && selectedIds.size > 0 ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
            )}>
                <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 rounded-2xl px-8 py-4 flex items-center gap-8 min-w-[320px]">
                    <span className="text-white font-bold">{selectedIds.size} selected</span>
                    <div className="h-6 w-px bg-white/10"></div>
                    <button
                        onClick={deleteSelected}
                        disabled={isDeleting}
                        className="flex items-center gap-2 text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider text-xs disabled:opacity-50 transition-colors ml-auto"
                    >
                        <Trash2 className={clsx("w-4 h-4", isDeleting && "animate-bounce")} />
                        {isDeleting ? "Deleting..." : "Delete Selection"}
                    </button>
                </div>
            </div>

            {selectedEntry && (
                <HistoryModal
                    entry={selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                    onOpenStats={onOpenStats}
                />
            )}
        </>
    );
}
