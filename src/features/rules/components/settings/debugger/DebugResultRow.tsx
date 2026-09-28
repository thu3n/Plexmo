import clsx from "clsx";
import { Globe, Server, User } from "lucide-react";
import type { DebugRow, DebugRowStatus } from "@/features/rules/utils/debuggerLogic";

const ROW_STYLE: Record<DebugRowStatus, string> = {
    effective: "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_-5px_var(--tw-shadow-color)] shadow-emerald-500/10",
    applied: "bg-emerald-500/5 border-emerald-500/10",
    overridden: "bg-orange-500/5 border-orange-500/10 opacity-80",
    mismatch: "bg-white/5 border-white/5 opacity-50",
    disabled: "bg-white/5 border-white/5 opacity-50",
};

const STATUS_BADGE: Record<DebugRowStatus, { label: string; className: string }> = {
    effective: { label: "Active Limit", className: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold" },
    applied: { label: "Active", className: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
    overridden: { label: "Overridden", className: "bg-orange-500/10 text-orange-400 border border-orange-500/20" },
    mismatch: { label: "Scope Mismatch", className: "bg-white/5 text-white/40 border border-white/10" },
    disabled: { label: "Disabled Rule", className: "bg-slate-500/20 text-slate-400" },
};

const REASON_CHIP = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase border";

export default function DebugResultRow({ row }: { row: DebugRow }) {
    const { result, status, valueLabel } = row;
    const isActive = status === "effective" || status === "applied";
    const badge = STATUS_BADGE[status];

    return (
        <li className={clsx("flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all", ROW_STYLE[status])}>
            <div className="mb-3 sm:mb-0">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={clsx("font-bold", isActive ? "text-white" : "text-white/60")}>{result.rule.name}</span>
                    <span className={clsx("text-xs px-2 py-0.5 rounded", badge.className)}>{badge.label}</span>
                </div>
                {valueLabel && <div className={clsx("text-sm mt-1", isActive ? "text-white/60" : "text-white/30")}>{valueLabel}</div>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {result.applies && result.rule.enabled ? (
                    <>
                        {result.reasons.global && (
                            <span className={clsx(REASON_CHIP, "bg-blue-500/10 text-blue-400 border-blue-500/20")}>
                                <Globe className="w-3 h-3" aria-hidden />
                                Global
                            </span>
                        )}
                        {result.reasons.user && (
                            <span className={clsx(REASON_CHIP, "bg-emerald-500/10 text-emerald-400 border-emerald-500/20")}>
                                <User className="w-3 h-3" aria-hidden />
                                Assigned
                            </span>
                        )}
                        {result.reasons.servers.length > 0 && (
                            <span className={clsx(REASON_CHIP, "bg-amber-500/10 text-amber-500 border-amber-500/20")} title={result.reasons.servers.join(", ")}>
                                <Server className="w-3 h-3" aria-hidden />
                                Server
                            </span>
                        )}
                    </>
                ) : (
                    <span className="text-xs font-medium text-white/20 uppercase tracking-wider px-2">Not Applied</span>
                )}
            </div>
        </li>
    );
}
