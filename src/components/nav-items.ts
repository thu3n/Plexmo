import { Home, History, BarChart3, Library, Settings, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; icon: LucideIcon; label: string; exact?: boolean };

/**
 * The app's primary navigation, shared by the global dock and the optional
 * desktop header buttons. Labels are i18n keys. Settings is last so surfaces
 * that want only the four content pages can slice it off.
 */
export const PRIMARY_NAV_ITEMS: NavItem[] = [
    { href: "/", icon: Home, label: "dashboard.title", exact: true },
    { href: "/history", icon: History, label: "dashboard.history" },
    { href: "/statistics", icon: BarChart3, label: "dashboard.statistics" },
    { href: "/libraries", icon: Library, label: "dashboard.libraries" },
    { href: "/settings", icon: Settings, label: "dashboard.settings" },
];

export const isNavItemActive = (item: NavItem, pathname: string): boolean =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);
