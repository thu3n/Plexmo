"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Menu, Settings, Server, ShieldCheck, Activity, UploadCloud, Bell, List } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import clsx from "clsx";

import { useLanguage } from "@/components/LanguageContext";

const navItems = [
    { id: "general", icon: Settings, label: "settings.general", href: "/settings/general" },
    { id: "servers", icon: Server, label: "settings.servers", href: "/settings/servers" },
    { id: "access", icon: ShieldCheck, label: "settings.access", href: "/settings/access" },
    { id: "notifications", icon: Bell, label: "settings.notifications", href: "/settings/notifications" },
    { id: "rules", icon: List, label: "settings.rules", href: "/settings/rules" },
    { id: "jobs", icon: Activity, label: "settings.jobs", href: "/settings/jobs" },
    { id: "import", icon: UploadCloud, label: "settings.import", href: "/settings/import" },
];

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
        <header className="flex md:hidden items-center justify-between p-4 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50 transition-all duration-300">
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
                            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        <motion.div
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                            className="fixed inset-y-0 left-0 z-[110] w-[85%] max-w-[320px] bg-slate-950 border-r border-white/5 p-6 shadow-2xl shadow-black/80 overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-10">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 flex items-center justify-center shrink-0">
                                        <img
                                            src="/images/Plexmo_icon.png"
                                            alt="Plexmo"
                                            className="h-full w-full object-contain rounded-lg shadow-lg shadow-amber-500/20 transition-all duration-300"
                                        />
                                    </div>
                                    {/* Menu title removed as requested */}
                                </div>
                                <Link
                                    href="/"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20 transition-all text-white/70 hover:text-white"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="text-sm font-medium">Dashboard</span>
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
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />
                            </motion.div>
                        )}
                        <item.icon className={clsx("w-6 h-6 relative z-10 transition-colors", isActive ? "text-amber-500" : "")} />
                        <span className="relative z-10">{t(item.label) === item.label ? (item.label.split('.')[1].charAt(0).toUpperCase() + item.label.split('.')[1].slice(1)) : t(item.label)}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
