"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Menu, X } from "lucide-react";
import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import clsx from "clsx";

import { useLanguage } from "@/components/LanguageContext";
import { SETTINGS_NAV_ITEMS as navItems } from "@/features/settings/lib/nav-items";
import { resolveNavLabel } from "@/features/settings/lib/nav-label";

const DRAWER_ID = "settings-mobile-drawer";
const DASHBOARD_LABEL_KEY = "dashboard.title";
const noopSubscribe = () => () => {};

export function SettingsHeader({ title }: { title?: string }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { t } = useLanguage();
    // Portals need document.body, which only exists after hydration.
    const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
    const pathname = usePathname();
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const drawerRef = useRef<HTMLDivElement>(null);
    const translatedDashboard = t(DASHBOARD_LABEL_KEY);
    const dashboardLabel = translatedDashboard === DASHBOARD_LABEL_KEY ? "Dashboard" : translatedDashboard;

    // Close on navigation, adjusted during render instead of in an effect.
    const [menuPathname, setMenuPathname] = useState(pathname);
    if (pathname !== menuPathname) {
        setMenuPathname(pathname);
        setIsMobileMenuOpen(false);
    }

    // Escape closes the drawer; focus moves into it on open and back to the
    // menu button on close so keyboard users aren't stranded behind the overlay.
    useEffect(() => {
        if (!isMobileMenuOpen) return;
        const menuButton = menuButtonRef.current;
        drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsMobileMenuOpen(false);
        };
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            menuButton?.focus();
        };
    }, [isMobileMenuOpen]);

    const close = () => setIsMobileMenuOpen(false);

    return (
        <header className="flex md:hidden items-center justify-between gap-3 p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b border-white/5 bg-slate-950/95 sticky top-0 z-50 transition-all duration-300">
            <div className="flex items-center gap-4 min-w-0">
                <button
                    ref={menuButtonRef}
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 -ml-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:bg-white/20 transition-all"
                    aria-label="Open settings menu"
                    aria-expanded={isMobileMenuOpen}
                    aria-controls={DRAWER_ID}
                >
                    <Menu className="w-6 h-6" />
                </button>
                <span className="font-bold text-lg tracking-tight text-white truncate">{title || t("settings.title") || "Settings"}</span>
            </div>

            <Link
                href="/"
                className="flex items-center gap-1.5 shrink-0 rounded-full px-3 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 active:bg-white/20 transition-all"
            >
                <ArrowLeft className="w-4 h-4" />
                {dashboardLabel}
            </Link>

            {mounted && createPortal(
                isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
                            onClick={close}
                            aria-hidden
                        />
                        <motion.div
                            ref={drawerRef}
                            id={DRAWER_ID}
                            role="dialog"
                            aria-modal="true"
                            aria-label="Settings menu"
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                            className="fixed inset-y-0 left-0 z-[70] w-[85%] max-w-[320px] bg-slate-950 border-r border-white/5 px-6 pb-dock pt-[calc(1.5rem+env(safe-area-inset-top))] shadow-2xl shadow-black/80 overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-10">
                                <Link
                                    href="/"
                                    onClick={close}
                                    className="flex items-center gap-3 group"
                                >
                                    <span className="h-10 w-10 flex items-center justify-center shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src="/images/Plexmo_icon.png"
                                            alt=""
                                            className="h-full w-full object-contain rounded-lg transition-all duration-300"
                                        />
                                    </span>
                                    <span className="font-bold text-lg tracking-tight text-white group-hover:text-amber-400 transition-colors">
                                        {dashboardLabel}
                                    </span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={close}
                                    aria-label="Close settings menu"
                                    className="p-2 -mr-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <MobileNav onClose={close} />
                        </motion.div>
                    </>
                ),
                document.body
            )}
        </header>
    );
}

function MobileNav({ onClose }: { onClose: () => void }) {
    const pathname = usePathname();
    const { t } = useLanguage();

    return (
        <nav aria-label="Settings" className="flex flex-col gap-2">
            {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                    <Link
                        key={item.id}
                        href={item.href}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        className={clsx(
                            "relative flex items-center gap-4 p-4 rounded-xl text-lg font-medium transition-all duration-300 overflow-hidden",
                            isActive
                                ? "text-white"
                                : "text-white/60 hover:text-white hover:bg-white/5"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="mobile-active-bg"
                                className="absolute inset-0 bg-white/[0.08]"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            />
                        )}
                        <item.icon className={clsx("w-6 h-6 relative z-10 transition-colors", isActive ? "text-white" : "")} />
                        <span className="relative z-10">{resolveNavLabel(t, item.label)}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
