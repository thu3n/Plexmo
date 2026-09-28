"use client";

import clsx from "clsx";
import {
    Clapperboard,
    Film,
    Home,
    Monitor,
    Play,
    Repeat,
    Server,
    Tv,
    User,
    Waves,
    Zap,
    type LucideIcon,
} from "lucide-react";
import { useAuthMe } from "@/lib/use-auth-me";
import { avatarSrc } from "@/lib/avatar";

type NavEntry = { label: string; anchor: string; icon: LucideIcon };
type NavGroup = { heading?: string; items: NavEntry[] };

/** In-page anchors — the prototype is one page, so the sidebar scrolls to sections. */
const NAV_GROUPS: NavGroup[] = [
    {
        items: [
            { label: "Overview", anchor: "overview", icon: Home },
            { label: "Activity", anchor: "activity", icon: Waves },
        ],
    },
    {
        heading: "Content",
        items: [
            { label: "Movies", anchor: "movies", icon: Film },
            { label: "Shows", anchor: "shows", icon: Tv },
            { label: "Episodes", anchor: "episodes", icon: Clapperboard },
        ],
    },
    { heading: "Users", items: [{ label: "Users", anchor: "users", icon: User }] },
    { heading: "Devices", items: [{ label: "Devices", anchor: "devices", icon: Monitor }] },
    { heading: "Servers", items: [{ label: "Servers", anchor: "servers", icon: Server }] },
    {
        heading: "Playback",
        items: [
            { label: "Direct Play", anchor: "stream-quality", icon: Play },
            { label: "Direct Stream", anchor: "stream-quality", icon: Zap },
            { label: "Transcoding", anchor: "transcoding", icon: Repeat },
        ],
    },
];

export function Sidebar({ active, updatedAt }: { active: string; updatedAt: string }) {
    const { user } = useAuthMe();

    return (
        <aside className="sticky top-0 hidden h-dvh w-[186px] shrink-0 flex-col border-r border-[#16213a] bg-[#0b1324] lg:flex">
            <div className="flex items-center gap-2 px-5 pb-6 pt-4">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-[#f5a524]">
                    <Play className="h-3 w-3 fill-black text-black" />
                </span>
                <span className="text-lg font-semibold text-white">Plexmo</span>
            </div>

            <nav aria-label="Statistics sections" className="flex-1 space-y-4 overflow-y-auto px-2 no-scrollbar">
                {NAV_GROUPS.map((group, gi) => (
                    <div key={gi}>
                        {group.heading && (
                            <p className="mb-1.5 px-3 text-xs font-medium text-white/70">{group.heading}</p>
                        )}
                        {group.items.map((item) => (
                            <a
                                key={item.label}
                                href={`#${item.anchor}`}
                                className={clsx(
                                    "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                                    active === item.anchor && item.label !== "Direct Stream"
                                        ? "border-l-2 border-[#3b82f6] bg-[#15254a] text-white"
                                        : "text-white/80 hover:bg-white/5",
                                )}
                            >
                                <item.icon className="h-4 w-4 text-white/70" />
                                {item.label}
                            </a>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="border-t border-[#16213a] px-4 py-4">
                <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={avatarSrc(user?.thumb, user?.username ?? "?")}
                        alt=""
                        className="h-8 w-8 rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-white">{user?.username ?? "—"}</p>
                        <p className="text-xs text-white/60">Statistics</p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-emerald-400" aria-label="Online" />
                </div>
                <p className="mt-3 text-[11px] text-white/50">{updatedAt}</p>
            </div>
        </aside>
    );
}
