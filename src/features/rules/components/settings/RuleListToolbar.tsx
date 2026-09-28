import { Search } from "lucide-react";
import { RULE_SORT_OPTIONS, type RuleSortKey } from "@/features/rules/utils/ruleList";

interface RuleListToolbarProps {
    query: string;
    onQueryChange: (value: string) => void;
    sort: RuleSortKey;
    onSortChange: (value: RuleSortKey) => void;
}

export default function RuleListToolbar({ query, onQueryChange, sort, onSortChange }: RuleListToolbarProps) {
    return (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" aria-hidden />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Search rules..."
                    aria-label="Search rules"
                    className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none placeholder:text-white/20"
                />
            </div>
            <label className="flex items-center gap-2 text-sm text-white/50">
                Sort by
                <select
                    value={sort}
                    onChange={(e) => onSortChange(e.target.value as RuleSortKey)}
                    className="bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                    {RULE_SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value} className="bg-slate-900">
                            {o.label}
                        </option>
                    ))}
                </select>
            </label>
        </div>
    );
}
