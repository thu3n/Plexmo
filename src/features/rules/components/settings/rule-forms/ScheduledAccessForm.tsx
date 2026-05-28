import clsx from "clsx";
import { Trash2, Plus } from "lucide-react";
import type { RuleInstance } from "@/features/rules/types";

interface ScheduledAccessFormProps {
    formData: RuleInstance;
    setFormData: (rule: RuleInstance) => void;
}

const DAY_OPTIONS = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
];

/**
 * Configuration sub-form for the `scheduled_access` rule type: block/allow toggle,
 * a list of editable time windows (start/end/days), custom message, and enforce.
 */
export default function ScheduledAccessForm({ formData, setFormData }: ScheduledAccessFormProps) {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-white/60 mb-2 uppercase tracking-wider">Schedule Type</label>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setFormData({
                            ...formData,
                            settings: {
                                ...formData.settings,
                                schedule: { ...formData.settings.schedule!, type: 'block' }
                            }
                        })}
                        className={clsx(
                            "flex-1 py-2 px-4 rounded-lg border font-medium text-sm transition-all",
                            formData.settings.schedule?.type === 'block'
                                ? "bg-red-500/10 border-red-500/20 text-red-400"
                                : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                        )}
                    >
                        Block During Hours
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormData({
                            ...formData,
                            settings: {
                                ...formData.settings,
                                schedule: { ...formData.settings.schedule!, type: 'allow' }
                            }
                        })}
                        className={clsx(
                            "flex-1 py-2 px-4 rounded-lg border font-medium text-sm transition-all",
                            formData.settings.schedule?.type === 'allow'
                                ? "bg-green-500/10 border-green-500/20 text-green-400"
                                : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                        )}
                    >
                        Allow Only During Hours
                    </button>
                </div>
            </div>

            {/* Time Windows List */}
            <div className="space-y-4">
                {formData.settings.schedule?.timeWindows?.map((window, idx) => (
                    <div key={idx} className="space-y-3 p-4 bg-black/20 rounded-lg border border-white/5 relative group">
                        <button
                            type="button"
                            onClick={() => {
                                const newWindows = [...(formData.settings.schedule?.timeWindows || [])];
                                newWindows.splice(idx, 1);
                                setFormData({
                                    ...formData,
                                    settings: {
                                        ...formData.settings,
                                        schedule: { ...formData.settings.schedule!, timeWindows: newWindows }
                                    }
                                });
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove time window"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="grid grid-cols-2 gap-3 pr-8">
                            <div>
                                <label className="block text-xs font-bold text-white/40 mb-1">Start Time</label>
                                <input
                                    type="time"
                                    value={window.startTime}
                                    onChange={(e) => {
                                        const newWindows = [...(formData.settings.schedule?.timeWindows || [])];
                                        newWindows[idx] = { ...newWindows[idx], startTime: e.target.value };
                                        setFormData({
                                            ...formData,
                                            settings: {
                                                ...formData.settings,
                                                schedule: { ...formData.settings.schedule!, timeWindows: newWindows }
                                            }
                                        });
                                    }}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/40 mb-1">End Time</label>
                                <input
                                    type="time"
                                    value={window.endTime}
                                    onChange={(e) => {
                                        const newWindows = [...(formData.settings.schedule?.timeWindows || [])];
                                        newWindows[idx] = { ...newWindows[idx], endTime: e.target.value };
                                        setFormData({
                                            ...formData,
                                            settings: {
                                                ...formData.settings,
                                                schedule: { ...formData.settings.schedule!, timeWindows: newWindows }
                                            }
                                        });
                                    }}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-white/40 mb-2">Active Days</label>
                            <div className="flex flex-wrap gap-2">
                                {DAY_OPTIONS.map((day) => {
                                    const isSelected = window.days.includes(day.value);
                                    return (
                                        <button
                                            key={day.value}
                                            type="button"
                                            onClick={() => {
                                                const newWindows = [...(formData.settings.schedule?.timeWindows || [])];
                                                const currentDays = [...newWindows[idx].days];
                                                if (isSelected) {
                                                    newWindows[idx].days = currentDays.filter(d => d !== day.value);
                                                } else {
                                                    newWindows[idx].days = [...currentDays, day.value].sort();
                                                }
                                                setFormData({
                                                    ...formData,
                                                    settings: {
                                                        ...formData.settings,
                                                        schedule: { ...formData.settings.schedule!, timeWindows: newWindows }
                                                    }
                                                });
                                            }}
                                            className={clsx(
                                                "w-10 h-10 rounded-lg font-bold text-xs transition-all",
                                                isSelected
                                                    ? "bg-purple-500 text-white shadow-lg"
                                                    : "bg-white/5 text-white/40 hover:bg-white/10"
                                            )}
                                        >
                                            {day.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}

                <button
                    type="button"
                    onClick={() => {
                        const newWindows = [...(formData.settings.schedule?.timeWindows || [])];
                        newWindows.push({
                            startTime: "22:00",
                            endTime: "07:00",
                            days: [0, 1, 2, 3, 4, 5, 6]
                        });
                        setFormData({
                            ...formData,
                            settings: {
                                ...formData.settings,
                                schedule: { ...formData.settings.schedule!, timeWindows: newWindows }
                            }
                        });
                    }}
                    className="w-full py-3 rounded-lg border border-dashed border-white/10 text-white/40 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Add Time Window
                </button>
            </div>

            <div className="pt-4 border-t border-white/5">
                <label className="block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider">Custom Termination Message</label>
                <input
                    value={formData.settings.message}
                    onChange={e => setFormData({ ...formData, settings: { ...formData.settings, message: e.target.value } })}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-purple-500 focus:outline-none placeholder:text-white/20 text-sm"
                    placeholder="Access blocked during scheduled hours. Try again later."
                />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div>
                    <div className="font-medium text-white text-sm">Enforce scheduled access restrictions</div>
                    <div className="text-xs text-white/40 mt-0.5">Terminate streams when users access during blocked time windows</div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                    <div className={clsx("w-10 h-6 rounded-full transition-colors relative shrink-0", formData.settings.enforce ? "bg-amber-500" : "bg-white/10")}>
                        <div className={clsx("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", formData.settings.enforce ? "translate-x-4" : "translate-x-0")} />
                    </div>
                    <input type="checkbox" className="hidden" checked={formData.settings.enforce} onChange={e => setFormData({ ...formData, settings: { ...formData.settings, enforce: e.target.checked } })} />
                </label>
            </div>
        </div>
    );
}
