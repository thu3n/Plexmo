"use client";

import { Search, Loader2 } from "lucide-react";
import { useRuleDebugger } from "@/features/rules/hooks/useRuleDebugger";
import UserCombobox from "./debugger/UserCombobox";
import DebugResultRow from "./debugger/DebugResultRow";

export default function RuleDebugger() {
    const { users, usersError, selectedUser, selectUser, clear, retry, loading, error, summary } = useRuleDebugger();

    return (
        // Rows here are `justify-between` label/value pairs; capped so they do not
        // spread across the full settings width.
        <div className="space-y-6 2xl:max-w-6xl">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Search className="w-5 h-5 text-amber-500" aria-hidden />
                    Find User
                </h3>
                <UserCombobox users={users} selected={selectedUser} onSelect={selectUser} onClear={clear} />
                {usersError && (
                    <p role="alert" className="text-sm text-rose-400 mt-3">
                        Could not load users: {usersError.message}
                    </p>
                )}
            </div>

            {selectedUser && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" aria-live="polite">
                    {loading && (
                        <div className="p-12 flex flex-col items-center justify-center text-white/40" role="status">
                            <Loader2 className="w-8 h-8 animate-spin mb-4 text-amber-500" aria-hidden />
                            <p>Analyzing rules...</p>
                        </div>
                    )}

                    {error && (
                        <div role="alert" className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <p className="font-bold text-rose-300">Could not analyze rules for {selectedUser.username}</p>
                                <p className="text-sm text-white/50 mt-1">{error}</p>
                            </div>
                            <button type="button" onClick={retry} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition">
                                Retry
                            </button>
                        </div>
                    )}

                    {summary && (
                        <div className="space-y-6">
                            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-6 rounded-2xl flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-1">Effective Stream Limit</div>
                                    <div className="text-3xl font-bold text-white leading-none">
                                        {summary.effectiveStreamLimit ?? "Unlimited"}
                                        {summary.effectiveStreamLimit !== null && (
                                            <span className="text-lg text-white/40 font-normal ml-2">
                                                {summary.effectiveStreamLimit === 1 ? "stream" : "streams"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-medium text-white/60">Active Rules</div>
                                    <div className="text-2xl font-bold text-white">{summary.activeRuleCount}</div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider pl-1">All Rules Analysis</h3>
                                {summary.rows.length > 0 ? (
                                    <ul className="space-y-3">
                                        {summary.rows.map((row) => (
                                            <DebugResultRow key={row.result.rule.id} row={row} />
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="p-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-white/40">
                                        No rules found in system.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
