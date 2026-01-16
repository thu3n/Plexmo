import { X, ShieldAlert, MonitorPlay, PauseCircle, Clock } from "lucide-react";

interface RuleTypeSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: string) => void;
}

const RULE_TYPES = [
    {
        id: "max_concurrent_streams",
        name: "Max Concurrent Streams",
        description: "Limit the number of simultaneous streams a user can play.",
        icon: MonitorPlay,
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "group-hover:border-amber-500/50",
        hoverBg: "group-hover:bg-amber-500/5"
    },
    {
        id: "kill_paused_streams",
        name: "Kill Paused Stream",
        description: "Automatically stop streams that have been paused for too long.",
        icon: PauseCircle,
        color: "text-red-400",
        bg: "bg-red-500/10",
        border: "group-hover:border-red-500/50",
        hoverBg: "group-hover:bg-red-500/5"
    },
    {
        id: "scheduled_access",
        name: "Scheduled Access",
        description: "Control when users can access Plex (time-based parental control).",
        icon: Clock,
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        border: "group-hover:border-purple-500/50",
        hoverBg: "group-hover:bg-purple-500/5"
    },
    /*
    {
        id: "bandwidth_limit",
        name: "Bandwidth Limit",
        description: "Limit the total bandwidth usage per user.",
        icon: Activity,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "group-hover:border-blue-500/50",
        hoverBg: "group-hover:bg-blue-500/5"
    }
    */
];

export default function RuleTypeSelectionModal({ isOpen, onClose, onSelect }: RuleTypeSelectionModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900 shadow-2xl relative flex flex-col max-h-[90vh]">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white z-10">
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8 border-b border-white/5 shrink-0">
                    <h2 className="text-2xl font-bold text-white">Select Rule Type</h2>
                    <p className="text-white/40 mt-1">Choose a template to start with</p>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {RULE_TYPES.map((type) => (
                            <button
                                key={type.id}
                                onClick={() => onSelect(type.id)}
                                className={`group relative p-6 rounded-2xl border border-white/5 bg-white/5 ${type.hoverBg} ${type.border} transition-all duration-300 text-left hover:scale-[1.02] hover:shadow-xl`}
                            >
                                <div className={`w-12 h-12 rounded-xl ${type.bg} ${type.color} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                                    <type.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">{type.name}</h3>
                                <p className="text-sm text-white/40 leading-relaxed">{type.description}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
