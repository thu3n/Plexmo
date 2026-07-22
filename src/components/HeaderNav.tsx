"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useLanguage } from "@/components/LanguageContext";
import { useDesktopNavMode } from "@/lib/desktop-nav-preference";
import { PRIMARY_NAV_ITEMS, isNavItemActive } from "@/components/nav-items";

// Settings stays out of the pills — it lives in the user dropdown in this mode.
const HEADER_NAV_ITEMS = PRIMARY_NAV_ITEMS.filter((item) => item.href !== "/settings");

/**
 * Always-visible nav buttons for page headers — the "header" desktop nav
 * mode. Self-gating: renders nothing in the other modes and below lg, so
 * every header can mount it unconditionally.
 */
export function HeaderNav() {
    const pathname = usePathname();
    const { t } = useLanguage();
    const [navMode] = useDesktopNavMode();

    if (navMode !== "header") return null;

    return (
        <nav
            aria-label="Primary"
            className="hidden lg:flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/5"
        >
            {HEADER_NAV_ITEMS.map((item) => {
                const active = isNavItemActive(item, pathname);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={clsx(
                            "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                            active
                                ? "bg-white/[0.12] text-white"
                                : "text-white/60 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <item.icon className="h-4 w-4" />
                        {t(item.label)}
                    </Link>
                );
            })}
        </nav>
    );
}
