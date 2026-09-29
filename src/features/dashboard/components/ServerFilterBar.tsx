"use client";

import type { PublicServer } from "@/lib/servers";
import { getServerColor } from "@/lib/serverColors";
import { useDragScroll } from "@/lib/use-drag-scroll";
import { edgeMaskClass, useScrollEdges } from "@/lib/use-scroll-edges";
import type { ServerStreamCount } from "../hooks/useDashboardStatistics";

/**
 * The dashboard's server filter — one row instead of the same tags repeated
 * on every stat card. Clicking a server filters the dashboard to it; clicking
 * the highlighted one clears back to all. Also the home of the
 * unreachable-server warning.
 */
export function ServerFilterBar({
    label,
    data,
    servers,
    selectedServerId,
    onSelect,
}: {
    label: string;
    data: Record<string, ServerStreamCount>;
    servers: PublicServer[];
    selectedServerId: string | null;
    onSelect: (id: string | null) => void;
}) {
    const { ref: dragRef, handlers: dragHandlers } = useDragScroll<HTMLDivElement>();
    const edges = useScrollEdges(dragRef, [data]);
    return (
        <div className="flex items-center gap-3 min-w-0">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</span>
            <div
                ref={dragRef}
                {...dragHandlers}
                className={`flex gap-2 min-w-0 overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing ${edgeMaskClass(edges)}`}
            >
                {Object.entries(data)
                    .sort(([, a], [, b]) => b.count - a.count)
                    .map(([id, stats]) => {
                        const server = servers.find((s) => s.id === id);
                        const isActive = selectedServerId === id;
                        const isUnreachable = server?.status === "unreachable";
                        const color = getServerColor(id, server?.color);
                        return (
                            <button
                                key={id}
                                onClick={() => onSelect(isActive ? null : id)}
                                aria-pressed={isActive}
                                title={isUnreachable ? server?.statusMessage : undefined}
                                className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${isActive
                                    ? "text-white ring-1 ring-white/20 shadow-sm"
                                    : "glass-panel text-white/70 hover:bg-white/10 hover:text-white"
                                    }`}
                                style={{ backgroundColor: isActive ? color : undefined }}
                            >
                                {isUnreachable ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-amber-400">
                                        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    !isActive && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                )}
                                {stats.name}
                                <span className={`font-bold tabular-nums ${isActive ? "text-white" : "text-white/90"}`}>
                                    {stats.count}
                                </span>
                            </button>
                        );
                    })}
            </div>
        </div>
    );
}
