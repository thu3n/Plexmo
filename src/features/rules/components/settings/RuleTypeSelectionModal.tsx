import clsx from "clsx";
import { Modal } from "@/components/ui/Modal";
import { RULE_TYPE, ruleTypeLabel } from "@/features/rules/constants";
import { ruleTheme } from "./ruleTheme";

interface RuleTypeSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: string) => void;
}

const RULE_TYPE_OPTIONS = [
    {
        id: RULE_TYPE.MAX_CONCURRENT,
        description: "Limit the number of simultaneous streams a user can play.",
    },
    {
        id: RULE_TYPE.KILL_PAUSED,
        description: "Automatically stop streams that have been paused for too long.",
    },
    {
        id: RULE_TYPE.SCHEDULED,
        description: "Control when users can access Plex (time-based parental control).",
    },
];

export default function RuleTypeSelectionModal({ isOpen, onClose, onSelect }: RuleTypeSelectionModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Select Rule Type" size="xl">
            <p className="text-white/40 -mt-4 mb-6">Choose a template to start with</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {RULE_TYPE_OPTIONS.map((option) => {
                    const theme = ruleTheme(option.id);
                    const Icon = theme.icon;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => onSelect(option.id)}
                            className={clsx(
                                "group relative p-6 rounded-2xl border border-white/5 bg-white/5 transition-all duration-300 text-left hover:scale-[1.02] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
                                theme.hoverBg,
                                theme.hoverBorder
                            )}
                        >
                            <div
                                className={clsx(
                                    "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
                                    theme.iconBg,
                                    theme.iconText
                                )}
                            >
                                <Icon className="w-6 h-6" aria-hidden />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">{ruleTypeLabel(option.id)}</h3>
                            <p className="text-sm text-white/40 leading-relaxed">{option.description}</p>
                        </button>
                    );
                })}
            </div>
        </Modal>
    );
}
