import clsx from "clsx";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import type { RuleInstance } from "@/features/rules/types";

interface EnforcementFormProps {
    formData: RuleInstance;
    setFormData: (rule: RuleInstance) => void;
}

/**
 * Configuration sub-form for the enforcement-based rule types
 * (`max_concurrent_streams`, `kill_paused_streams`): the enforce toggle,
 * exclude-same-IP option, kill-all option, and custom message. The
 * scheduled_access type uses ScheduledAccessForm instead.
 */
export default function EnforcementForm({ formData, setFormData }: EnforcementFormProps) {
    return (
        <>
            {/* Regular enforcement settings for other rule types */}
            <div className="space-y-4">
                {!formData.settings.enforce && (
                    <div className="flex items-start gap-2 text-blue-400/80 text-xs bg-blue-500/5 p-3 rounded-lg border border-blue-500/10">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>When enforcement is disabled, violations will only be logged. Streams will NOT be terminated.</p>
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="font-medium text-white text-sm">
                            {formData.type === 'kill_paused_streams'
                                ? 'Kill streams when paused too long'
                                : 'Kill Stream when exceed limits'}
                        </div>
                        <div className="text-xs text-white/40 mt-0.5">
                            {formData.type === 'kill_paused_streams'
                                ? 'Automatically terminate streams exceeding pause limit'
                                : 'Automatically kill streams exceeding limit'}
                        </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <div className={clsx("w-10 h-6 rounded-full transition-colors relative shrink-0", formData.settings.enforce ? "bg-amber-500" : "bg-white/10")}>
                            <div className={clsx("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", formData.settings.enforce ? "translate-x-4" : "translate-x-0")} />
                        </div>
                        <input type="checkbox" className="hidden" checked={formData.settings.enforce} onChange={e => setFormData({ ...formData, settings: { ...formData.settings, enforce: e.target.checked } })} />
                    </label>
                </div>

                {formData.type === "max_concurrent_streams" && (
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div>
                            <div className="font-medium text-white text-sm">Exclude Same IP</div>
                            <div className="text-xs text-white/40 mt-0.5">Allow multiple streams from the same public IP (e.g. same household) without penalty</div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <div className={clsx("w-10 h-6 rounded-full transition-colors relative shrink-0", formData.settings.exclude_same_ip ? "bg-emerald-500" : "bg-white/10")}>
                                <div className={clsx("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", formData.settings.exclude_same_ip ? "translate-x-4" : "translate-x-0")} />
                            </div>
                            <input type="checkbox" className="hidden" checked={!!formData.settings.exclude_same_ip} onChange={e => setFormData({ ...formData, settings: { ...formData.settings, exclude_same_ip: e.target.checked } })} />
                        </label>
                    </div>
                )}
            </div>

            {formData.settings.enforce && formData.type === "max_concurrent_streams" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-medium text-white text-sm">Kill All Streams</div>
                            <div className="text-xs text-white/40 mt-0.5">Kill ALL user streams on violation instead of just the newest</div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <div className={clsx("w-10 h-6 rounded-full transition-colors relative shrink-0", formData.settings.kill_all ? "bg-red-500" : "bg-white/10")}>
                                <div className={clsx("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", formData.settings.kill_all ? "translate-x-4" : "translate-x-0")} />
                            </div>
                            <input type="checkbox" className="hidden" checked={formData.settings.kill_all} onChange={e => setFormData({ ...formData, settings: { ...formData.settings, kill_all: e.target.checked } })} />
                        </label>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Custom Termination Message</label>
                        <input
                            value={formData.settings.message}
                            onChange={e => setFormData({ ...formData, settings: { ...formData.settings, message: e.target.value } })}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-amber-500 focus:outline-none placeholder:text-white/20 text-sm"
                            placeholder="Stream Limit Exceeded"
                        />
                    </div>
                </motion.div>
            )}

            {formData.settings.enforce && formData.type === "kill_paused_streams" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 pt-4 border-t border-white/5">
                    <div>
                        <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Custom Termination Message</label>
                        <input
                            value={formData.settings.message}
                            onChange={e => setFormData({ ...formData, settings: { ...formData.settings, message: e.target.value } })}
                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-amber-500 focus:outline-none placeholder:text-white/20 text-sm"
                            placeholder="Stream paused for too long"
                        />
                        <p className="text-xs text-white/40 mt-1.5">
                            You can use <code className="px-1.5 py-0.5 bg-white/10 rounded text-amber-400">$time</code> to show the configured pause duration (e.g. "3 minuter")
                        </p>
                    </div>
                </motion.div>
            )}
        </>
    );
}
