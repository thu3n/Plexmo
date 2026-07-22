"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import clsx from "clsx";

import { useLanguage } from "@/components/LanguageContext";
import { SETTINGS_NAV_ITEMS as navItems } from "@/features/settings/lib/nav-items";

export function SettingsHeader({ title }: { title?: string }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { t } = useLanguage();
    const [mounted, setMounted] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <header className="flex md:hidden items-center justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b border-white/5 bg-slate-950/95 sticky top-0 z-50 transition-all duration-300">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 -ml-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:bg-white/20 transition-all"
                    aria-label="Open menu"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-lg tracking-tight text-white">{title || t("settings.title") || "Settings"}</span>
                </div>
            </div>

            {mounted && createPortal(
                isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        <motion.div
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                            className="fixed inset-y-0 left-0 z-[70] w-[85%] max-w-[320px] bg-slate-950 border-r border-white/5 px-6 pb-dock pt-[calc(1.5rem+env(safe-area-inset-top))] shadow-2xl shadow-black/80 overflow-y-auto"
                        >
                            <div className="flex items-center mb-10">
                                <Link
                                    href="/"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    aria-label="Dashboard"
                                    className="h-10 w-10 flex items-center justify-center shrink-0"
                                >
                                    <img
                                        src="/images/Plexmo_icon.png"
                                        alt="Plexmo"
                                        className="h-full w-full object-contain rounded-lg transition-all duration-300"
                                    />
                                </Link>
                            </div>

                            <MobileNav onClose={() => setIsMobileMenuOpen(false)} />
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
        <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                    <Link
                        key={item.id}
                        href={item.href}
                        onClick={onClose}
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
                        <span className="relative z-10">{t(item.label) === item.label ? (item.label.split('.')[1].charAt(0).toUpperCase() + item.label.split('.')[1].slice(1)) : t(item.label)}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
