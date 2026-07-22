"use client";

import Link from "next/link";
import useSWR from "swr";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useLanguage } from "@/components/LanguageContext";
import { useDesktopNavMode } from "@/lib/desktop-nav-preference";
import { PRIMARY_NAV_ITEMS, isNavItemActive } from "@/components/nav-items";

type DockUser = { username: string; thumb: string };

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const HIDDEN_PREFIXES = ["/login", "/setup"];

/**
 * App-wide floating bottom navigation. Always visible below lg; on desktop
 * only when the user picks the "dock" nav mode (Settings → General). Hides
 * itself on the unauthenticated routes and whenever /api/auth/me has no
 * user — the same auth signal UserMenu uses.
 */
export function GlobalDock() {
    const pathname = usePathname();
    const { t } = useLanguage();
    const [navMode] = useDesktopNavMode();
    const { data } = useSWR<{ user: DockUser }>("/api/auth/me", fetcher);

    const user = data?.user;
    if (!user || HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

    const activeIndex = PRIMARY_NAV_ITEMS.findIndex((item) => isNavItemActive(item, pathname));

    return (
        <div className="fixed bottom-0 inset-x-0 z-[80] flex justify-center pointer-events-none">
            <nav
                aria-label="Primary"
                className={clsx(
                    // Solid translucency, no backdrop-blur: a persistent fixed
                    // backdrop-filter forces iOS WebKit to recomposite the blur
                    // against the swapping route content on every transition frame.
                    "pointer-events-auto relative mb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-1 rounded-full bg-slate-950/95 border border-white/10 px-3 py-2 shadow-2xl shadow-black/40",
                    navMode !== "dock" && "lg:hidden"
                )}
            >
                {/* Active pill: CSS transform + transition (GPU-composited) instead of a
                    framer-motion layout spring — the spring ran per-frame JS on the main
                    thread exactly while the destination page was mounting, delaying taps.
                    Step = item width 2.75rem + gap 0.25rem = 3rem. */}
                {activeIndex >= 0 && (
                    <div
                        aria-hidden
                        className="absolute left-3 top-2 h-11 w-11 rounded-full bg-white/[0.12] transition-transform duration-300 ease-out"
                        style={{ transform: `translateX(${activeIndex * 3}rem)` }}
                    />
                )}
                {PRIMARY_NAV_ITEMS.map((item) => {
                    const active = isNavItemActive(item, pathname);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-label={t(item.label)}
                            aria-current={active ? "page" : undefined}
                            className="relative flex h-11 w-11 items-center justify-center rounded-full"
                        >
                            <item.icon className={clsx("relative z-10 h-5 w-5", active ? "text-white" : "text-white/50")} />
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
