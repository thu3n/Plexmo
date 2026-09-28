"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIZE_CLASS = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
} as const;

/**
 * Accessible modal shell shared by settings dialogs: portal, role=dialog,
 * Escape + backdrop close, focus trap, and focus restore on close. The
 * hand-rolled overlays it replaces did none of these, so keyboard users could
 * tab behind them and nothing closed on Escape.
 */
export function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = "lg",
    dismissible = true,
    className,
}: {
    isOpen: boolean;
    onClose: () => void;
    title?: ReactNode;
    children: ReactNode;
    size?: keyof typeof SIZE_CLASS;
    /** False while a request is in flight, so Escape/backdrop can't abandon it. */
    dismissible?: boolean;
    className?: string;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const [mounted, setMounted] = useState(false);
    const onCloseRef = useRef(onClose);
    const dismissibleRef = useRef(dismissible);

    useEffect(() => {
        onCloseRef.current = onClose;
        dismissibleRef.current = dismissible;
    });

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!isOpen) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        const first = panel?.querySelector<HTMLElement>("[autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
        (first ?? panel)?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && dismissibleRef.current) {
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (e.key !== "Tab" || !panel) return;
            const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
            if (nodes.length === 0) return;
            const firstNode = nodes[0];
            const lastNode = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === firstNode) {
                e.preventDefault();
                lastNode.focus();
            } else if (!e.shiftKey && document.activeElement === lastNode) {
                e.preventDefault();
                firstNode.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = prevOverflow;
            previouslyFocused?.focus?.();
        };
    }, [isOpen]);

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && dismissible) onClose();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                tabIndex={-1}
                className={clsx(
                    "w-full rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8 shadow-2xl relative max-h-[90dvh] overflow-y-auto focus:outline-none",
                    SIZE_CLASS[size],
                    className
                )}
            >
                {dismissible && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
                {title && (
                    <h2 id={titleId} className="text-2xl font-bold text-white mb-6 pr-8">
                        {title}
                    </h2>
                )}
                {children}
            </div>
        </div>,
        document.body
    );
}
