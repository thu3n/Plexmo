"use client";

import { useId, useState, type FormEvent } from "react";
import clsx from "clsx";
import { Modal } from "@/components/ui/Modal";
import { errorMessage, useFeedback } from "@/components/ui/Feedback";
import { requestJson } from "@/lib/swr-fetch";
import { DEFAULT_WEBHOOK_EVENTS, type NotificationEventId } from "../lib/events";
import type { WebhookFormValues, WebhookSummary } from "../types";
import { EventPicker } from "./EventPicker";
import { Switch } from "./Switch";

const INPUT_CLASS =
    "w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none placeholder:text-white/20";
const LABEL_CLASS = "block text-xs font-bold text-white/60 mb-1 uppercase tracking-wider";

type TestState = { tone: "success" | "error"; message: string } | null;

/**
 * Add/edit dialog. Mount it fresh per open (keyed by webhook id) so the form
 * initialises from the target webhook. On edit the URL field starts blank:
 * the stored URL is a secret the API never sends back, and blank keeps it.
 */
export function WebhookModal({
    webhook,
    onClose,
    onSave,
    onTestStored,
}: {
    webhook: WebhookSummary | null;
    onClose: () => void;
    onSave: (values: WebhookFormValues, id?: string) => Promise<void>;
    onTestStored: (webhook: WebhookSummary) => Promise<void>;
}) {
    const { toast } = useFeedback();
    const ids = { name: useId(), url: useId(), urlHint: useId() };
    const [values, setValues] = useState<WebhookFormValues>({
        name: webhook?.name ?? "",
        url: "",
        events: webhook?.events ?? [...DEFAULT_WEBHOOK_EVENTS],
        enabled: webhook?.enabled ?? true,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testState, setTestState] = useState<TestState>(null);

    const toggleEvent = (event: NotificationEventId) =>
        setValues((prev) => ({
            ...prev,
            events: prev.events.includes(event) ? prev.events.filter((e) => e !== event) : [...prev.events, event],
        }));

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSave(values, webhook?.id);
            onClose();
        } catch (err) {
            toast(errorMessage(err, "Failed to save webhook"), "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTest = async () => {
        setIsTesting(true);
        setTestState(null);
        try {
            const typedUrl = values.url.trim();
            if (typedUrl) {
                await requestJson("/api/notifications/test", { method: "POST", body: { targetUrl: typedUrl } });
                setTestState({ tone: "success", message: "Test notification sent!" });
            } else if (webhook) {
                await onTestStored(webhook);
            }
        } catch (err) {
            setTestState({ tone: "error", message: errorMessage(err, "Failed to send test.") });
        } finally {
            setIsTesting(false);
        }
    };

    const canTest = Boolean(values.url.trim() || webhook);

    return (
        <Modal isOpen onClose={onClose} title={webhook ? "Edit Webhook" : "Add Webhook"} dismissible={!isSubmitting}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor={ids.name} className={LABEL_CLASS}>Name</label>
                    <input
                        id={ids.name}
                        value={values.name}
                        onChange={(e) => setValues({ ...values, name: e.target.value })}
                        className={INPUT_CLASS}
                        placeholder="My Discord Server"
                        required
                    />
                </div>
                <div>
                    <label htmlFor={ids.url} className={LABEL_CLASS}>Webhook URL</label>
                    <input
                        id={ids.url}
                        type="url"
                        value={values.url}
                        onChange={(e) => setValues({ ...values, url: e.target.value })}
                        className={clsx(INPUT_CLASS, "font-mono text-sm")}
                        placeholder={webhook ? webhook.maskedUrl : "https://discord.com/api/webhooks/..."}
                        aria-describedby={webhook ? ids.urlHint : undefined}
                        required={!webhook}
                        autoComplete="off"
                    />
                    {webhook && (
                        <p id={ids.urlHint} className="mt-1 text-xs text-white/40">
                            Leave blank to keep the current URL.
                        </p>
                    )}
                </div>

                <EventPicker selected={values.events} onToggle={toggleEvent} />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-white/5 mt-4 gap-4">
                    <Switch checked={values.enabled} onChange={(enabled) => setValues({ ...values, enabled })} label="Enable Webhook" />
                    <div className="flex items-center gap-4 self-end sm:self-auto">
                        <span aria-live="polite" className={clsx("text-sm font-bold", testState?.tone === "error" ? "text-rose-400" : "text-emerald-400")}>
                            {testState?.message}
                        </span>
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={isTesting || !canTest}
                            className="text-sm font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                        >
                            {isTesting ? "Testing..." : "Test"}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 rounded-xl bg-amber-500 font-bold text-slate-900 hover:bg-amber-400 transition disabled:opacity-50 mt-4 shadow-lg shadow-amber-500/20"
                >
                    {isSubmitting ? "Saving..." : "Save Webhook"}
                </button>
            </form>
        </Modal>
    );
}
