"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { motion } from "framer-motion";
import {
    Settings,
    Server,
    Library,
    Users,
    ShieldCheck,
    Activity,
    UploadCloud,
    Bell,
    List,
    Info
} from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { useLanguage } from "@/components/LanguageContext";

const navItems = [
    { id: "general", icon: Settings, label: "settings.general", href: "/settings/general" },
    { id: "servers", icon: Server, label: "settings.servers", href: "/settings/servers" },
    { id: "access", icon: ShieldCheck, label: "settings.access", href: "/settings/access" },
    { id: "notifications", icon: Bell, label: "settings.notifications", href: "/settings/notifications" },
    { id: "rules", icon: List, label: "settings.rules", href: "/settings/rules" },
    { id: "jobs", icon: Activity, label: "settings.jobs", href: "/settings/jobs" },
    { id: "import", icon: UploadCloud, label: "settings.import", href: "/settings/import" },
    { id: "about", icon: Info, label: "settings.about", href: "/settings/about" },
];

export function SettingsSidebar() {
    const pathname = usePathname();
    const { t } = useLanguage();

    return (
        <aside className="w-64 shrink-0 hidden md:flex flex-col border-r border-white/5 bg-slate-950/30 backdrop-blur-md h-screen sticky top-0 overflow-hidden">
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                <Link href="/" className="flex items-center gap-3 mb-10 group px-2">
                    <div className="h-10 w-10 flex items-center justify-center shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/images/Plexmo_icon.png"
                            alt="Plexmo"
                            className="h-full w-full object-contain rounded-lg shadow-lg shadow-amber-500/20 group-hover:scale-110 group-hover:shadow-amber-500/40 transition-all duration-300"
                        />
                    </div>
                    <span className="font-bold text-xl tracking-tight text-white group-hover:text-amber-400 transition-colors">
                        Dashboard
                    </span>
                </Link>

                <nav className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.id}
                                href={item.href}
                                className={clsx(
                                    "relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group overflow-hidden",
                                    isActive
                                        ? "text-white"
                                        : "text-white/60 hover:text-white hover:bg-white/5"
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebar-active"
                                        className="absolute inset-0 bg-white/[0.08]"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-r-full" />
                                    </motion.div>
                                )}
                                <item.icon className={clsx("w-5 h-5 relative z-10 transition-colors duration-300", isActive ? "text-amber-400" : "group-hover:text-white/80")} />
                                <span className="relative z-10">
                                    {(() => {
                                        const translated = t(item.label);
                                        if (translated !== item.label) return translated;
                                        // Fallback: try to format settings.key -> Key
                                        const parts = item.label.split('.');
                                        if (parts.length > 1) {
                                            return parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
                                        }
                                        return item.label;
                                    })()}
                                </span>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="p-4 border-t border-white/5 bg-slate-900/20">
                <div className="flex items-center justify-between">
                    <UserMenu align="bottom-left" />
                </div>
            </div>
        </aside>
    );
}
