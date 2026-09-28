import { Edit2, Trash2, Bell, Globe, Users, Server, Copy, History } from "lucide-react";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import type { RuleInstance } from "@/features/rules/types";
import { ruleTypeLabel } from "@/features/rules/constants";
import { ruleTheme } from "./ruleTheme";
import RuleCardDetails from "./RuleCardDetails";
import ScopePill from "./ScopePill";
import RuleSwitch from "./ui/RuleSwitch";

type PersistedRule = RuleInstance & { id: string };

interface RuleCardProps {
    rule: PersistedRule;
    onEdit: (rule: PersistedRule) => void;
    onDelete: (id: string, name: string) => void;
    onToggle: (id: string, enabled: boolean) => void;
    onDuplicate: (rule: PersistedRule) => void;
    onShowHistory: (rule: PersistedRule) => void;
}

const ActionButton = ({ label, onClick, className, children }: { label: string; onClick: () => void; className: string; children: ReactNode }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className={clsx("p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70", className)}
    >
        {children}
    </button>
);

export default function RuleCard({ rule, onEdit, onDelete, onToggle, onDuplicate, onShowHistory }: RuleCardProps) {
    const webhookCount = (rule.discordWebhookIds || []).length + (rule.discordWebhookId ? 1 : 0);
    const showNotificationBadge = rule.settings.notify !== false && webhookCount > 0;
    const theme = ruleTheme(rule.type);
    const ThemeIcon = theme.icon;
    const serverCount = rule.serverCount ?? 0;
    const userCount = rule.userCount ?? 0;
    const hiddenUserCount = userCount - (rule.userNames?.length ?? 0);

    return (
        <SettingsCard className="flex flex-col h-full min-h-[200px] !p-6">
            <div className="flex-1">
                <div className="flex items-start justify-between mb-4">
                    <div className={clsx("p-3 rounded-2xl shrink-0", theme.iconBg, theme.iconText)}>
                        <ThemeIcon className="w-6 h-6" aria-hidden />
                    </div>

                    {/* Revealed on hover for pointer users; always shown on touch and when focused. */}
                    <div className="flex gap-1 transition-all duration-200 opacity-100 translate-x-0 lg:opacity-0 lg:translate-x-4 lg:group-hover:opacity-100 lg:group-hover:translate-x-0 lg:group-focus-within:opacity-100 lg:group-focus-within:translate-x-0">
                        <ActionButton label={`Enforcement history for ${rule.name}`} onClick={() => onShowHistory(rule)} className="text-white/60 hover:text-white hover:bg-white/10">
                            <History className="w-4 h-4" aria-hidden />
                        </ActionButton>
                        <ActionButton label={`Duplicate ${rule.name}`} onClick={() => onDuplicate(rule)} className="text-white/60 hover:text-white hover:bg-white/10">
                            <Copy className="w-4 h-4" aria-hidden />
                        </ActionButton>
                        <ActionButton label={`Edit ${rule.name}`} onClick={() => onEdit(rule)} className="text-white/60 hover:text-white hover:bg-white/10">
                            <Edit2 className="w-4 h-4" aria-hidden />
                        </ActionButton>
                        <ActionButton label={`Delete ${rule.name}`} onClick={() => onDelete(rule.id, rule.name)} className="text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10">
                            <Trash2 className="w-4 h-4" aria-hidden />
                        </ActionButton>
                    </div>
                </div>

                <div>
                    <h3 className="text-xl font-bold text-white mb-1 leading-tight break-words">{rule.name}</h3>
                    <p className="text-xs text-white/40 font-mono font-medium uppercase tracking-wider truncate mb-2">{ruleTypeLabel(rule.type)}</p>
                    <RuleCardDetails rule={rule} />
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <RuleSwitch
                        size="sm"
                        checked={rule.enabled}
                        onChange={(on) => onToggle(rule.id, on)}
                        label={`Enable ${rule.name}`}
                        activeClassName="bg-emerald-500"
                    />
                    <span
                        aria-hidden
                        className={clsx(
                            "text-xs font-bold uppercase tracking-wider transition-colors duration-300",
                            rule.enabled ? "text-emerald-500" : "text-white/30"
                        )}
                    >
                        {rule.enabled ? "Active" : "Disabled"}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {rule.global ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/10">
                            <Globe className="w-3 h-3" aria-hidden />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Global</span>
                        </div>
                    ) : (
                        <>
                            {serverCount > 0 && (
                                <ScopePill icon={<Server className="w-3 h-3" aria-hidden />} count={serverCount} label={`${serverCount} servers`} title="Servers">
                                    <div className="text-xs text-white/70 leading-relaxed">{rule.serverNames?.join(", ") || "Unknown"}</div>
                                </ScopePill>
                            )}
                            {userCount > 0 && (
                                <ScopePill icon={<Users className="w-3 h-3" aria-hidden />} count={userCount} label={`${userCount} users`} title="Assigned Users">
                                    <div className="space-y-1">
                                        {rule.userNames?.map((name, i) => (
                                            <div key={i} className="text-xs text-white/70">{name}</div>
                                        ))}
                                        {hiddenUserCount > 0 && (
                                            <div className="text-xs text-white/40 italic pt-1 border-t border-white/5">+ {hiddenUserCount} more</div>
                                        )}
                                    </div>
                                </ScopePill>
                            )}
                        </>
                    )}

                    {showNotificationBadge && (
                        <div
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/10"
                            role="img"
                            aria-label={`Notifies ${webhookCount} webhook${webhookCount === 1 ? "" : "s"}`}
                        >
                            <Bell className="w-3 h-3" aria-hidden />
                        </div>
                    )}
                </div>
            </div>
        </SettingsCard>
    );
}
