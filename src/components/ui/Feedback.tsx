"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import clsx from "clsx";
import { Modal } from "@/components/ui/Modal";

/**
 * App-wide replacements for window.alert/confirm: non-blocking toasts and a
 * promise-based confirm dialog styled like the rest of the app. Native dialogs
 * freeze the page, can't be styled, and are suppressed entirely in some PWA
 * contexts on iOS.
 */

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; tone: ToastTone; message: string };

type ConfirmOptions = {
    title: string;
    message?: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Red confirm button for irreversible actions. */
    destructive?: boolean;
};

type FeedbackApi = {
    toast: (message: string, tone?: ToastTone) => void;
    confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const TOAST_DURATION_MS = 4000;
const ERROR_TOAST_DURATION_MS = 7000;

const FeedbackContext = createContext<FeedbackApi | null>(null);

const TONE_STYLE: Record<ToastTone, { className: string; Icon: typeof Info }> = {
    success: { className: "border-emerald-500/30 text-emerald-300", Icon: CheckCircle2 },
    error: { className: "border-rose-500/30 text-rose-300", Icon: XCircle },
    info: { className: "border-white/10 text-white/80", Icon: Info },
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [pending, setPending] = useState<ConfirmOptions | null>(null);
    const resolverRef = useRef<((value: boolean) => void) | null>(null);
    const nextId = useRef(0);

    const toast = useCallback((message: string, tone: ToastTone = "success") => {
        const id = ++nextId.current;
        setToasts((prev) => [...prev, { id, tone, message }]);
        setTimeout(
            () => setToasts((prev) => prev.filter((t) => t.id !== id)),
            tone === "error" ? ERROR_TOAST_DURATION_MS : TOAST_DURATION_MS
        );
    }, []);

    const confirm = useCallback((options: ConfirmOptions) => {
        // A second confirm while one is open resolves the first as cancelled.
        resolverRef.current?.(false);
        setPending(options);
        return new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
        });
    }, []);

    const settle = (value: boolean) => {
        resolverRef.current?.(value);
        resolverRef.current = null;
        setPending(null);
    };

    return (
        <FeedbackContext.Provider value={{ toast, confirm }}>
            {children}

            <Modal isOpen={pending !== null} onClose={() => settle(false)} title={pending?.title} size="md">
                {pending?.message && <div className="text-sm text-white/60 leading-relaxed mb-6">{pending.message}</div>}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => settle(false)}
                        className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition"
                    >
                        {pending?.cancelLabel ?? "Cancel"}
                    </button>
                    <button
                        type="button"
                        autoFocus
                        onClick={() => settle(true)}
                        className={clsx(
                            "flex-1 py-3 rounded-xl font-bold transition",
                            pending?.destructive
                                ? "bg-rose-500 hover:bg-rose-400 text-white"
                                : "bg-amber-500 hover:bg-amber-400 text-slate-900"
                        )}
                    >
                        {pending?.confirmLabel ?? "Confirm"}
                    </button>
                </div>
            </Modal>

            <div
                aria-live="polite"
                className="fixed z-[200] left-1/2 -translate-x-1/2 bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-8 flex flex-col items-center gap-2 w-[calc(100%-2rem)] max-w-md pointer-events-none"
            >
                {toasts.map((t) => {
                    const { className, Icon } = TONE_STYLE[t.tone];
                    return (
                        <div
                            key={t.id}
                            role={t.tone === "error" ? "alert" : "status"}
                            className={clsx(
                                "pointer-events-auto w-full flex items-start gap-3 rounded-2xl border bg-slate-900/95 backdrop-blur px-4 py-3 text-sm font-medium shadow-2xl shadow-black/60 animate-in fade-in slide-in-from-bottom-2",
                                className
                            )}
                        >
                            <Icon className="w-5 h-5 shrink-0 mt-px" />
                            <span className="min-w-0 break-words">{t.message}</span>
                        </div>
                    );
                })}
            </div>
        </FeedbackContext.Provider>
    );
}

export function useFeedback(): FeedbackApi {
    const ctx = useContext(FeedbackContext);
    if (!ctx) throw new Error("useFeedback must be used inside FeedbackProvider");
    return ctx;
}

/** Error → user-facing message, for catch blocks around requestJson. */
export const errorMessage = (err: unknown, fallback: string): string =>
    err instanceof Error && err.message ? err.message : fallback;
