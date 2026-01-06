import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useLanguage } from './LanguageContext';

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
    history: RuleEvent[];
}

export function RuleHistoryModal({ isOpen, onClose, ruleName, history }: RuleHistoryModalProps) {
    const [visible, setVisible] = useState(false);
    const { t } = useLanguage();

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
            document.body.style.overflow = "hidden";
        } else {
            setVisible(false);
            document.body.style.overflow = "auto";
        }
        return () => {
            document.body.style.overflow = "auto";
        };
    }, [isOpen]);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 300); // Wait for animation
    };

    if (!isOpen && !visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className={clsx(
                    "absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300",
                    visible ? "opacity-100" : "opacity-0"
                )}
                onClick={handleClose}
            />

            {/* Modal Container */}
            <div
                className={clsx(
                    "relative w-full max-w-md transform overflow-hidden rounded-2xl bg-slate-900 border border-white/10 p-6 text-left shadow-xl transition-all duration-300",
                    visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
                )}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold leading-6 text-white">
                        {t("rules.title", { rule: ruleName })}
                    </h3>
                    <button
                        onClick={handleClose}
                        className="rounded-full bg-white/5 p-1 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mt-2 text-sm text-white/70 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {history.length === 0 ? (
                        <div className="text-white/30 text-center py-8">{t("rules.noFileFound")}</div>
                    ) : (
                        <div className="space-y-3">
                            {history.map((event) => {
                                let message = t("rules.violation");
                                try {
                                    const details = JSON.parse(event.details);
                                    if (event.ruleKey === "max_concurrent_streams") {
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
                        onClick={handleClose}
                    >
                        {t("rules.close")}
                    </button>
                </div>
            </div>
        </div>
    );
}
