import { Modal } from "@/components/ui/Modal";
import { useLanguage } from "@/components/LanguageContext";
import { RULE_TYPE } from "@/features/rules/constants";

interface RuleEvent {
    id: number;
    ruleKey: string;
    triggeredAt: string;
    endedAt?: string;
    details: string;
}

interface RuleHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    ruleName: string;
    /** Event rows only carry the rule instance id, so the type comes from the caller. */
    ruleType?: string;
    history: RuleEvent[];
}

export function RuleHistoryModal({ isOpen, onClose, ruleName, ruleType, history }: RuleHistoryModalProps) {
    const { t } = useLanguage();

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t("rules.title", { rule: ruleName })} size="md">
            <div>
                <div className="mt-2 text-sm text-white/70 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {history.length === 0 ? (
                        <div className="text-white/30 text-center py-8">{t("rules.noFileFound")}</div>
                    ) : (
                        <div className="space-y-3">
                            {history.map((event) => {
                                let message = t("rules.violation");
                                try {
                                    const details = JSON.parse(event.details);
                                    if (ruleType === RULE_TYPE.MAX_CONCURRENT) {
                                        message = t("rules.limitExceeded", { count: details.count, limit: details.limit });
                                    }
                                } catch { }

                                const startTime = new Date(event.triggeredAt);
                                const endTime = event.endedAt ? new Date(event.endedAt) : null;
                                const duration = endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60) : 0;
                                const durationStr = duration < 1 ? "< 1 min" : `${duration} min`;

                                return (
                                    <div key={event.id} className="flex flex-col gap-1 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                                        <div className="flex justify-between items-start">
                                            <span className="text-sm font-medium text-rose-300">{message}</span>
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs text-white/40 whitespace-nowrap">{startTime.toLocaleString()}</span>
                                                {endTime ? (
                                                    <span className="text-[10px] text-white/30">{t("common.end")} {endTime.toLocaleTimeString()} ({durationStr})</span>
                                                ) : (
                                                    <span className="text-[10px] text-emerald-400 font-bold animate-pulse">{t("rules.ongoing")}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        className="inline-flex justify-center rounded-lg border border-transparent bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                        onClick={onClose}
                    >
                        {t("rules.close")}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
