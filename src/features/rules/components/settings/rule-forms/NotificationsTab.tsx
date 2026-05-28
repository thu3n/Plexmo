import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import type { RuleInstance } from "@/features/rules/types";

interface Webhook {
    id: string;
    name: string;
}

interface NotificationsTabProps {
    webhooks?: Webhook[];
    formData: RuleInstance;
    setFormData: (rule: RuleInstance) => void;
}

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.118.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.085 2.176 2.419 0 1.334-.966 2.419-2.176 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.085 2.176 2.419 0 1.334-.966 2.419-2.176 2.419z" />
    </svg>
);

/**
 * Notifications tab: select which Discord webhooks fire when this rule triggers.
 * Writes selections into formData.discordWebhookIds (clearing the legacy
 * single-id field).
 */
export default function NotificationsTab({ webhooks, formData, setFormData }: NotificationsTabProps) {
    return (
        <div className="space-y-4">
            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex gap-3 text-blue-400">
                <div className="mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-sm font-bold">Notification Channels</p>
                    <p className="text-xs opacity-80 mt-1 leading-relaxed">
                        Select where alerts should be sent when this rule is triggered.
                        You can configure multiple destinations.
                    </p>
                </div>
            </div>

            <div className="space-y-2">
                {webhooks && webhooks.length > 0 ? (
                    webhooks.map(w => {
                        const isSelected = formData.discordWebhookIds?.includes(w.id) || (formData.discordWebhookId === w.id);
                        return (
                            <div
                                key={w.id}
                                className={clsx(
                                    "flex items-center justify-between p-4 rounded-xl border transition-all duration-200",
                                    isSelected
                                        ? "bg-amber-500/10 border-amber-500/20 shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)]"
                                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={clsx(
                                        "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                        isSelected ? "bg-amber-500 text-slate-900" : "bg-white/10 text-white/40"
                                    )}>
                                        <DiscordIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className={clsx("font-bold text-sm", isSelected ? "text-amber-500" : "text-white")}>
                                            {w.name}
                                        </div>
                                        <div className="text-xs text-white/40">Discord Webhook</div>
                                    </div>
                                </div>

                                <label className="flex items-center cursor-pointer relative">
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={!!isSelected}
                                        onChange={e => {
                                            const current = formData.discordWebhookIds || (formData.discordWebhookId ? [formData.discordWebhookId!] : []) || [];
                                            let next;
                                            if (e.target.checked) {
                                                next = [...current, w.id];
                                            } else {
                                                next = current.filter(id => id !== w.id);
                                            }
                                            // Remove dupes
                                            next = [...new Set(next)];
                                            setFormData({ ...formData, discordWebhookIds: next, discordWebhookId: null });
                                        }}
                                    />
                                    <div className={clsx(
                                        "w-10 h-6 rounded-full transition-colors relative shrink-0",
                                        isSelected ? "bg-amber-500" : "bg-white/10"
                                    )}>
                                        <div className={clsx(
                                            "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                                            isSelected ? "translate-x-4" : "translate-x-0"
                                        )} />
                                    </div>
                                </label>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-10 px-4 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-white/20">
                            <DiscordIcon className="w-6 h-6" />
                        </div>
                        <p className="text-white font-medium mb-1">No Webhooks Configured</p>
                        <p className="text-white/40 text-xs mb-4">Set up a Discord webhook to receive notifications.</p>
                        <a
                            href="/settings/notifications"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-900 rounded-lg text-sm font-bold hover:bg-amber-400 transition"
                        >
                            Configure Webhooks
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
