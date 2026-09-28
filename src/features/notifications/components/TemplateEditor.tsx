"use client";

import { useId, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";
import { NOTIFICATION_EVENTS, getEventDefinition, type MessageTemplate, type NotificationEventId } from "../lib/events";
import { DISCORD_LIMITS, MAX_TEMPLATE_LENGTH, resolveTemplate, type TemplateOverrides } from "../lib/templates";
import { useTemplates } from "../hooks/useTemplates";
import { TemplatePreview } from "./TemplatePreview";

const FIELD_CLASS =
    "w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none";
const LABEL_CLASS = "block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider";

/** Global message templates: pick an event, edit title/description, preview, save or reset. */
export function TemplateEditor() {
    const { overrides, error, isLoading, retry, saveTemplate } = useTemplates();
    const [event, setEvent] = useState<NotificationEventId>(NOTIFICATION_EVENTS[0].id);
    const selectId = useId();

    if (error && !overrides) {
        return (
            <div role="alert" className="flex items-center gap-4 p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-300">
                <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
                <p className="text-sm flex-1">Couldn&apos;t load templates: {error.message}</p>
                <button type="button" onClick={() => retry()} className="text-sm font-bold text-white hover:text-amber-400">Retry</button>
            </div>
        );
    }
    if (isLoading || !overrides) {
        return <div className="h-64 animate-pulse rounded-3xl bg-white/5 border border-white/5" aria-busy="true" />;
    }

    const stored = overrides[event];
    return (
        <SettingsCard className="space-y-4">
            <div>
                <label htmlFor={selectId} className={LABEL_CLASS}>Event</label>
                <select id={selectId} value={event} onChange={(e) => setEvent(e.target.value as NotificationEventId)} className={FIELD_CLASS}>
                    {NOTIFICATION_EVENTS.map((def) => (
                        <option key={def.id} value={def.id} className="bg-slate-900">
                            {def.label}{overrides[def.id] ? " (custom)" : ""}
                        </option>
                    ))}
                </select>
            </div>
            {/* Keyed remount re-initialises the draft when the event or its saved value changes. */}
            <TemplateForm
                key={`${event}:${stored?.title ?? ""}:${stored?.description ?? ""}`}
                event={event}
                overrides={overrides}
                isCustom={Boolean(stored)}
                onSave={(template) => saveTemplate(event, template)}
            />
        </SettingsCard>
    );
}

function TemplateForm({
    event,
    overrides,
    isCustom,
    onSave,
}: {
    event: NotificationEventId;
    overrides: TemplateOverrides;
    isCustom: boolean;
    onSave: (template: MessageTemplate | null) => Promise<boolean>;
}) {
    const [draft, setDraft] = useState<MessageTemplate>(() => resolveTemplate(event, overrides));
    const [isSaving, setIsSaving] = useState(false);
    const ids = { title: useId(), description: useId(), hint: useId() };
    const definition = getEventDefinition(event);

    const persist = async (template: MessageTemplate | null) => {
        setIsSaving(true);
        await onSave(template);
        setIsSaving(false);
    };

    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
                <div>
                    <label htmlFor={ids.title} className={LABEL_CLASS}>Title</label>
                    <input
                        id={ids.title}
                        value={draft.title}
                        maxLength={DISCORD_LIMITS.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        aria-describedby={ids.hint}
                        className={FIELD_CLASS}
                    />
                </div>
                <div>
                    <label htmlFor={ids.description} className={LABEL_CLASS}>Description</label>
                    <textarea
                        id={ids.description}
                        value={draft.description}
                        maxLength={MAX_TEMPLATE_LENGTH}
                        rows={4}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        aria-describedby={ids.hint}
                        className={FIELD_CLASS}
                    />
                </div>
                <p id={ids.hint} className="text-xs text-white/50">
                    Placeholders for this event:{" "}
                    {definition.placeholders.map((p) => (
                        <code key={p} className="mr-1 rounded bg-white/10 px-1 py-0.5 text-amber-300">{`{${p}}`}</code>
                    ))}
                    . Blank fields fall back to the default.
                </p>
                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={() => persist(draft)}
                        disabled={isSaving}
                        className="px-5 py-2.5 rounded-xl bg-amber-500 font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
                    >
                        {isSaving ? "Saving..." : "Save template"}
                    </button>
                    <button
                        type="button"
                        onClick={() => persist(null)}
                        disabled={isSaving || !isCustom}
                        className="px-5 py-2.5 rounded-xl bg-white/5 font-bold text-white/80 hover:bg-white/10 disabled:opacity-40"
                    >
                        Reset to default
                    </button>
                </div>
            </div>
            <div>
                <p className={LABEL_CLASS}>Preview</p>
                <TemplatePreview event={event} template={draft} />
            </div>
        </div>
    );
}
