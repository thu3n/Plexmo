import { Clock, MonitorPlay, PauseCircle, ShieldAlert, type LucideIcon } from "lucide-react";
import { RULE_TYPE } from "@/features/rules/constants";

export interface RuleTheme {
    icon: LucideIcon;
    iconBg: string;
    iconText: string;
    /** Switch/track colour when on. */
    activeColor: string;
    /** Hover accents for the type picker. */
    hoverBorder: string;
    hoverBg: string;
}

/** One palette per rule type, shared by the rule cards and the type picker. */
const THEMES: Record<string, RuleTheme> = {
    [RULE_TYPE.MAX_CONCURRENT]: {
        icon: MonitorPlay,
        iconBg: "bg-amber-500/10",
        iconText: "text-amber-500",
        activeColor: "bg-amber-500",
        hoverBorder: "hover:border-amber-500/50",
        hoverBg: "hover:bg-amber-500/5",
    },
    [RULE_TYPE.KILL_PAUSED]: {
        icon: PauseCircle,
        iconBg: "bg-rose-500/10",
        iconText: "text-rose-500",
        activeColor: "bg-rose-500",
        hoverBorder: "hover:border-rose-500/50",
        hoverBg: "hover:bg-rose-500/5",
    },
    [RULE_TYPE.SCHEDULED]: {
        icon: Clock,
        iconBg: "bg-indigo-500/10",
        iconText: "text-indigo-500",
        activeColor: "bg-indigo-500",
        hoverBorder: "hover:border-indigo-500/50",
        hoverBg: "hover:bg-indigo-500/5",
    },
};

const FALLBACK: RuleTheme = {
    icon: ShieldAlert,
    iconBg: "bg-white/10",
    iconText: "text-white",
    activeColor: "bg-white",
    hoverBorder: "hover:border-white/20",
    hoverBg: "hover:bg-white/5",
};

export const ruleTheme = (type: string): RuleTheme => THEMES[type] ?? FALLBACK;
