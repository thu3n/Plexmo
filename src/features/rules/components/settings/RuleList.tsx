import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { PersistedRule } from "@/features/rules/hooks/useRuleManagement";
import { filterAndSortRules, type RuleSortKey } from "@/features/rules/utils/ruleList";
import RuleCard from "./RuleCard";
import RuleListToolbar from "./RuleListToolbar";

const GRID_CLASS = "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 min-[1800px]:grid-cols-4";
const SKELETON_COUNT = 3;

interface RuleListProps {
    rules?: PersistedRule[];
    isLoading: boolean;
    error?: Error;
    onRetry: () => void;
    onCreate: () => void;
    onEdit: (rule: PersistedRule) => void;
    onDelete: (id: string, name: string) => void;
    onToggle: (id: string, enabled: boolean) => void;
    onDuplicate: (rule: PersistedRule) => void;
    onShowHistory: (rule: PersistedRule) => void;
}

export default function RuleList({ rules, isLoading, error, onRetry, onCreate, ...cardActions }: RuleListProps) {
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<RuleSortKey>("name");
    const visible = useMemo(() => filterAndSortRules(rules ?? [], query, sort), [rules, query, sort]);

    if (isLoading) {
        return (
            <div className={GRID_CLASS} role="status" aria-label="Loading rules">
                {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                    <div key={i} className="h-[200px] animate-pulse rounded-3xl bg-white/5 border border-white/5" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div role="alert" className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <p className="font-bold text-rose-300">Could not load rules</p>
                    <p className="text-sm text-white/50 mt-1">{error.message}</p>
                </div>
                <button type="button" onClick={onRetry} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition">
                    Retry
                </button>
            </div>
        );
    }

    const hasRules = (rules?.length ?? 0) > 0;

    return (
        <div className="space-y-6">
            {hasRules && <RuleListToolbar query={query} onQueryChange={setQuery} sort={sort} onSortChange={setSort} />}

            {!hasRules && (
                <p className="text-sm text-white/40">No rules yet. Create one to limit streams, stop paused sessions, or schedule access.</p>
            )}
            {hasRules && visible.length === 0 && (
                <p className="text-sm text-white/40" role="status">
                    No rules match &ldquo;{query}&rdquo;.
                </p>
            )}

            <div className={GRID_CLASS}>
                {visible.map((rule) => (
                    <div key={rule.id} className="h-full">
                        <RuleCard rule={rule} {...cardActions} />
                    </div>
                ))}

                <button
                    type="button"
                    onClick={onCreate}
                    className="group relative flex flex-col items-center justify-center min-h-[200px] rounded-3xl border border-dashed border-white/10 bg-white/5 transition-all hover:bg-white/10 hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                >
                    <div className="p-4 rounded-full bg-amber-500/10 text-amber-500 mb-4 group-hover:scale-110 transition-transform">
                        <Plus className="w-8 h-8" aria-hidden />
                    </div>
                    <span className="font-bold text-white group-hover:text-amber-400 transition-colors">Add New Rule</span>
                </button>
            </div>
        </div>
    );
}
