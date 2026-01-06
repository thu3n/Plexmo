import { Edit2, ShieldAlert, Trash2, Power, Bell, Globe, Users, Server, MonitorPlay, PauseCircle, Clock, Play, Square, CalendarClock, LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { SettingsCard } from "../../components/SettingsComponents";

interface RuleInstance {
    id: string;
    type: string; // "max_concurrent_streams"
    name: string;
    enabled: boolean;
    settings: {
        limit: number;
        enforce: boolean;
        kill_all: boolean;

        message: string;
        notify?: boolean;
        schedule?: {
            type: 'block' | 'allow';
            timeWindows: Array<{
                startTime: string;
                endTime: string;
                days: number[];
            }>;
        };
    };
    discordWebhookId: string | null;
    discordWebhookIds?: string[];
    global?: boolean;
    serverCount?: number;
    userCount?: number;
    serverNames?: string[];
    userNames?: string[];
}

interface RuleCardProps {
    rule: RuleInstance;
    onEdit: (rule: RuleInstance) => void;
    onDelete: (id: string, name: string) => void;
    onToggle: (id: string, enabled: boolean) => void;
}

export default function RuleCard({ rule, onEdit, onDelete, onToggle }: RuleCardProps) {
    // Calculate effective webhook count
    const webhookCount = (rule.discordWebhookIds || []).length + (rule.discordWebhookId ? 1 : 0);
    const showNotificationBadge = rule.settings.notify !== false && webhookCount > 0;

    // Theme definition
    const typeThemes: Record<string, { borderColor: string; iconBg: string; iconText: string; activeColor: string; icon: LucideIcon }> = {
        'max_concurrent_streams': {
            borderColor: "border-l-amber-500",
            iconBg: "bg-amber-500/10",
            iconText: "text-amber-500",
            activeColor: "bg-amber-500",
            icon: MonitorPlay
        },
        'kill_paused_streams': {
            borderColor: "border-l-rose-500",
            iconBg: "bg-rose-500/10",
            iconText: "text-rose-500",
            activeColor: "bg-rose-500",
            icon: PauseCircle
        },
        'scheduled_access': {
            borderColor: "border-l-indigo-500",
            iconBg: "bg-indigo-500/10",
            iconText: "text-indigo-500",
            activeColor: "bg-indigo-500",
            icon: Clock
        }
    };

    const theme = typeThemes[rule.type] || {
        borderColor: "border-l-white/10",
        iconBg: "bg-white/10",
        iconText: "text-white",
        activeColor: "bg-white",
        icon: ShieldAlert
    };

    // Get human-readable rule type name (re-adding helper if needed or just inline it? Inline is fine or use map)
    const getRuleTypeName = (type: string): string => {
        const typeMap: Record<string, string> = {
            'max_concurrent_streams': 'Max Concurrent Streams',
            'kill_paused_streams': 'Kill Paused Stream',
            'scheduled_access': 'Scheduled Access',
        };
        return typeMap[type] || type;
    };

    const ThemeIcon = theme.icon;

    return (
        <SettingsCard className="flex flex-col h-full min-h-[200px] !p-6">
            <div className="flex-1">
                <div className="flex items-start justify-between mb-4">
                    <div className={clsx("p-3 rounded-2xl shrink-0", theme.iconBg, theme.iconText)}>
                        <ThemeIcon className="w-6 h-6" />
                    </div>

                    {/* Hover Actions */}
                    <div className="flex gap-1 transition-all duration-200 opacity-100 translate-x-0 lg:opacity-0 lg:translate-x-4 lg:group-hover:opacity-100 lg:group-hover:translate-x-0">
                        <button
                            onClick={() => onToggle(rule.id, !rule.enabled)}
                            className={clsx(
                                "p-2 rounded-lg transition-colors",
                                rule.enabled
                                    ? "text-emerald-400 hover:bg-emerald-500/10"
                                    : "text-white/40 hover:text-white hover:bg-white/10"
                            )}
                            title={rule.enabled ? "Disable Rule" : "Enable Rule"}
                        >
                            <Power className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onEdit(rule)}
                            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                            title="Edit Rule"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onDelete(rule.id, rule.name)}
                            className="p-2 rounded-lg text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete Rule"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div>
                    <h3 className="text-xl font-bold text-white mb-1 leading-tight">{rule.name}</h3>
                    <p className="text-xs text-white/40 font-mono font-medium uppercase tracking-wider truncate mb-2">
                        {getRuleTypeName(rule.type)}
                    </p>

                    {/* Value Badges */}
                    {rule.type === 'max_concurrent_streams' && rule.settings.limit > 0 && (
                        <div className="flex">
                            <span className="text-[10px] font-bold px-1.5 py-1 rounded uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                {rule.settings.limit} {rule.settings.limit === 1 ? 'Stream' : 'Streams'}
                            </span>
                        </div>
                    )}
                    {rule.type === 'kill_paused_streams' && rule.settings.limit > 0 && (
                        <div className="flex">
                            <span className="text-[10px] font-bold px-1.5 py-1 rounded uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                {rule.settings.limit} {rule.settings.limit === 1 ? 'Minute' : 'Minutes'}
                            </span>
                        </div>
                    )}

                    {/* Scheduled Access Details */}
                    {rule.type === 'scheduled_access' && rule.settings.schedule && (
                        <div className="flex items-start gap-2 mt-2">
                            <span className={clsx(
                                "shrink-0 text-[10px] font-bold px-1.5 py-1 rounded uppercase tracking-wider h-fit mt-0.5",
                                rule.settings.schedule.type === 'allow'
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            )}>
                                {rule.settings.schedule.type === 'allow' ? 'Allow' : 'Block'}
                            </span>

                            <div className="flex flex-col gap-1.5 w-full min-w-0">
                                {rule.settings.schedule.timeWindows.slice(0, 3).map((window, i) => {
                                    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                                    const isDaily = window.days.length === 7;
                                    const isWeekdays = window.days.length === 5 && !window.days.includes(0) && !window.days.includes(6);
                                    const isWeekends = window.days.length === 2 && window.days.includes(0) && window.days.includes(6);

                                    let dayText = "";
                                    if (isDaily) dayText = "Daily";
                                    else if (isWeekdays) dayText = "Weekdays";
                                    else if (isWeekends) dayText = "Weekends";
                                    else dayText = window.days.map(d => dayNames[d]).join(", ");

                                    return (
                                        <div key={i} className="flex items-center justify-between text-xs text-white/70 bg-white/5 rounded-md px-2 py-1 border border-white/5">
                                            <span className="font-mono font-bold text-indigo-300">{window.startTime} - {window.endTime}</span>
                                            <span className="text-[10px] text-white/40 uppercase tracking-wide truncate ml-2">{dayText}</span>
                                        </div>
                                    );
                                })}
                                {(rule.settings.schedule.timeWindows.length > 3) && (
                                    <p className="text-[10px] text-white/30 italic text-right">+{rule.settings.schedule.timeWindows.length - 3} more</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between gap-4">

                {/* Status Dot */}
                <div className="flex items-center gap-2.5">
                    <div className={clsx(
                        "w-2 h-2 rounded-full shadow-[0_0_10px] transition-all duration-300",
                        rule.enabled ? clsx("bg-emerald-500 shadow-emerald-500/50") : "bg-white/20 shadow-none"
                    )} />
                    <span className={clsx(
                        "text-xs font-bold uppercase tracking-wider transition-colors duration-300",
                        rule.enabled ? "text-emerald-400" : "text-white/30"
                    )}>
                        {rule.enabled ? "Active" : "Disabled"}
                    </span>
                </div>

                {/* Metadata Pills */}
                <div className="flex items-center gap-2">
                    {/* Global/Server/User Counts */}
                    {(rule.global) ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/10">
                            <Globe className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Global</span>
                        </div>
                    ) : (
                        <>
                            {(rule.serverCount || 0) > 0 && (
                                <div className="group/server relative">
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 text-white/50 border border-white/5 cursor-help">
                                        <Server className="w-3 h-3" />
                                        <span className="text-[10px] font-bold">{rule.serverCount}</span>
                                    </div>
                                    {/* Server Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-slate-900 border border-white/10 shadow-xl rounded-lg p-3 z-50 pointer-events-none opacity-0 group-hover/server:opacity-100 transition-opacity duration-200">
                                        <div className="text-[10px] font-bold text-white mb-1 uppercase tracking-wider">Servers</div>
                                        <div className="text-xs text-white/70 leading-relaxed">
                                            {rule.serverNames?.join(', ') || 'Unknown'}
                                        </div>
                                        {/* Arrow */}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
                                    </div>
                                </div>
                            )}
                            {(rule.userCount || 0) > 0 && (
                                <div className="group/user relative">
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 text-white/50 border border-white/5 cursor-help">
                                        <Users className="w-3 h-3" />
                                        <span className="text-[10px] font-bold">{rule.userCount}</span>
                                    </div>
                                    {/* User Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-slate-900 border border-white/10 shadow-xl rounded-lg p-3 z-50 pointer-events-none opacity-0 group-hover/user:opacity-100 transition-opacity duration-200">
                                        <div className="text-[10px] font-bold text-white mb-1 uppercase tracking-wider">Assigned Users</div>
                                        <div className="space-y-1">
                                            {rule.userNames?.map((name, i) => (
                                                <div key={i} className="text-xs text-white/70">{name}</div>
                                            ))}
                                            {(rule.userCount! > (rule.userNames?.length || 0)) && (
                                                <div className="text-xs text-white/40 italic pt-1border-t border-white/5">
                                                    + {rule.userCount! - (rule.userNames?.length || 0)} more
                                                </div>
                                            )}
                                        </div>
                                        {/* Arrow */}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Notification Badge */}
                    {showNotificationBadge && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/10">
                            <Bell className="w-3 h-3" />
                        </div>
                    )}
                </div>
            </div>
        </SettingsCard>
    );
}
