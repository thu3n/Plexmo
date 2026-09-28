import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { formatDateTime } from "@/lib/format";
import { useRuleEvents } from "@/features/rules/hooks/useRuleEvents";
import { describeEventAction, describeEventContext } from "@/features/rules/utils/ruleEventFormat";
import { RULE_EVENTS_PAGE_SIZE } from "@/features/rules/constants";

interface RuleEventsModalProps {
    rule: { id: string; name: string } | null;
    onClose: () => void;
}

/** Per-rule enforcement log: when, who, where, and what the rule did. */
export default function RuleEventsModal({ rule, onClose }: RuleEventsModalProps) {
    const { events, error, isLoading, retry } = useRuleEvents(rule?.id ?? null);

    return (
        <Modal isOpen={rule !== null} onClose={onClose} title={rule ? `History: ${rule.name}` : undefined} size="xl">
            <p className="text-sm text-white/40 -mt-4 mb-4">Most recent {RULE_EVENTS_PAGE_SIZE} times this rule triggered.</p>

            {isLoading && (
                <div className="py-10 flex flex-col items-center text-white/40" role="status">
                    <Loader2 className="w-6 h-6 animate-spin mb-2 text-amber-500" aria-hidden />
                    Loading history...
                </div>
            )}

            {error && (
                <div role="alert" className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-sm text-rose-300 flex items-center justify-between gap-4">
                    <span>Could not load history: {error.message}</span>
                    <button type="button" onClick={retry} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium">
                        Retry
                    </button>
                </div>
            )}

            {events && events.length === 0 && (
                <div className="p-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-white/40 text-sm">
                    This rule has not triggered yet.
                </div>
            )}

            {events && events.length > 0 && (
                <ul className="divide-y divide-white/5 rounded-xl border border-white/5 bg-black/20">
                    {events.map((e) => {
                        const context = describeEventContext(e);
                        return (
                            <li key={e.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
                                <time dateTime={e.triggeredAt} className="text-white/50 font-mono text-xs shrink-0 sm:w-40">
                                    {formatDateTime(e.triggeredAt)}
                                </time>
                                <div className="min-w-0 flex-1">
                                    <div className="text-white font-medium truncate">{e.username ?? e.userId}</div>
                                    <div className="text-xs text-white/40 truncate">
                                        {[e.serverName ?? (e.serverId ? "Unknown server" : "All servers"), context].filter(Boolean).join(" · ")}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {e.endedAt === null && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                            Ongoing
                                        </span>
                                    )}
                                    <span
                                        className={clsx(
                                            "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                                            e.enforced ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-white/5 text-white/50 border-white/10"
                                        )}
                                    >
                                        {describeEventAction(e)}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Modal>
    );
}
