import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { ImpactedUser } from "@/features/rules/types";
import { RULE_TYPE } from "@/features/rules/constants";

const MAX_LISTED_USERS = 10;

const NO_IMPACT_MESSAGES: Record<string, string> = {
    [RULE_TYPE.KILL_PAUSED]: "This rule will automatically manage paused streams for users in scope.",
    [RULE_TYPE.SCHEDULED]: "This rule will enforce the configured schedule for users in scope.",
};
const DEFAULT_NO_IMPACT_MESSAGE = "This rule will apply to users in scope.";

interface SaveConfirmationDialogProps {
    /** Whether the rule has no specific user/server assignments (applies to everyone). */
    isGlobalScope: boolean;
    isOpen: boolean;
    isSubmitting: boolean;
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
    isOpen,
    isSubmitting,
    ruleType,
    impactData,
    onCancel,
    onConfirm,
}: SaveConfirmationDialogProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            dismissible={!isSubmitting}
            size="md"
            title={
                <span className="flex items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" aria-hidden />
                    Confirm Rule Changes
                </span>
            }
        >
            <div className="flex flex-col">
                <div className="mb-6">
                    {/* Global Warning */}
                    {isGlobalScope && (
                        <div className="mb-6">
                            <p className="text-white/80 leading-relaxed font-medium">
                                This will be a <span className="text-blue-400 font-bold">Global Rule</span>.
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
                                {impactData.slice(0, MAX_LISTED_USERS).map((user, i) => (
                                    <div key={`${user.username}-${i}`} className="flex items-center justify-between p-3 text-sm">
                                        <div className="font-medium text-white">{user.username}</div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-white/40">{user.oldLimit}</span>
                                            <span className="text-white/20">→</span>
                                            <span className="text-amber-500 font-bold">{user.newLimit}</span>
                                        </div>
                                    </div>
                                ))}
                                {impactData.length > MAX_LISTED_USERS && (
                                    <div className="p-2 text-center text-xs text-white/40 italic">
                                        ...and {impactData.length - MAX_LISTED_USERS} more
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        ruleType === RULE_TYPE.MAX_CONCURRENT ? (
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
                                    {NO_IMPACT_MESSAGES[ruleType] ?? DEFAULT_NO_IMPACT_MESSAGE}
                                </p>
                            </div>
                        )
                    )}
                </div>

                <div className="flex gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="disabled:opacity-50 flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        autoFocus
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className="disabled:opacity-50 flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold transition"
                    >
                        {isSubmitting ? "Saving..." : "Confirm Save"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
