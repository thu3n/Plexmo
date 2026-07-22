import { AlertTriangle } from "lucide-react";

interface ImpactedUser {
    username: string;
    oldLimit: any;
    newLimit: any;
}

interface SaveConfirmationDialogProps {
    /** Whether the rule has no specific user/server assignments (applies to everyone). */
    isGlobalScope: boolean;
    ruleType: string;
    impactData: ImpactedUser[];
    onCancel: () => void;
    onConfirm: () => void;
}

/**
 * Confirmation overlay shown before saving a rule. Surfaces the "global rule"
 * warning and the impact analysis (which existing users get a stricter limit).
 */
export default function SaveConfirmationDialog({
    isGlobalScope,
    ruleType,
    impactData,
    onCancel,
    onConfirm,
}: SaveConfirmationDialogProps) {
    return (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-md w-full shadow-2xl scale-in-center flex flex-col max-h-[80vh]">
                <div className="flex items-center gap-3 mb-4 text-amber-500 shrink-0">
                    <AlertTriangle className="w-8 h-8" />
                    <h3 className="text-xl font-bold text-white">Confirm Rule Changes</h3>
                </div>

                <div className="overflow-y-auto custom-scrollbar flex-1 mb-6">
                    {/* Global Warning */}
                    {isGlobalScope && (
                        <div className="mb-6">
                            <p className="text-white/80 leading-relaxed font-medium">
                                You are creating a <span className="text-blue-400 font-bold">Global Rule</span>.
                            </p>
                            <p className="text-white/60 text-sm mt-1">
                                Since no specific users or servers are selected, this rule will apply to <strong>EVERYONE</strong>.
                            </p>
                        </div>
                    )}

                    {/* Impact Analysis */}
                    {impactData.length > 0 ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-white/80 uppercase tracking-wider">Impact Analysis</h4>
                                <span className="text-xs font-mono bg-amber-500/10 text-amber-500 px-2 py-1 rounded-md border border-amber-500/20">
                                    {impactData.length} Users Affected
                                </span>
                            </div>
                            <p className="text-xs text-white/50">
                                The following users will have a <strong>stricter limit</strong> applied by this rule:
                            </p>
                            <div className="bg-black/40 rounded-xl overflow-hidden border border-white/5 divide-y divide-white/5">
                                {impactData.slice(0, 10).map((user, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 text-sm">
                                        <div className="font-medium text-white">{user.username}</div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-white/40">{user.oldLimit}</span>
                                            <span className="text-white/20">→</span>
                                            <span className="text-amber-500 font-bold">{user.newLimit}</span>
                                        </div>
                                    </div>
                                ))}
                                {impactData.length > 10 && (
                                    <div className="p-2 text-center text-xs text-white/40 italic">
                                        ...and {impactData.length - 10} more
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        ruleType === 'max_concurrent_streams' ? (
                            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center gap-3 text-emerald-400">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                <p className="text-sm font-medium">
                                    No existing user limits will be negatively impacted by this change.
                                </p>
                            </div>
                        ) : (
                            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-center gap-3 text-blue-400">
                                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                <p className="text-sm font-medium">
                                    This rule will automatically manage paused streams for all users.
                                </p>
                            </div>
                        )
                    )}
                </div>

                <div className="flex gap-3 shrink-0">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold transition"
                    >
                        Confirm Save
                    </button>
                </div>
            </div>
        </div>
    );
}
