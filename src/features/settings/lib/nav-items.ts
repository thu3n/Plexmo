import {
    Settings,
    Server,
    Users,
    ShieldCheck,
    Activity,
    UploadCloud,
    Bell,
    List,
    Info,
    type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for settings navigation — consumed by both the
 * desktop sidebar and the mobile drawer (which had drifted apart).
 * `label` is an i18n key; consumers fall back to a Title-cased segment.
 */
export type SettingsNavItem = {
    id: string;
    icon: LucideIcon;
    label: string;
    href: string;
};

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
    { id: "general", icon: Settings, label: "settings.general", href: "/settings/general" },
    { id: "servers", icon: Server, label: "settings.servers", href: "/settings/servers" },
    { id: "users", icon: Users, label: "settings.users", href: "/settings/users" },
    { id: "access", icon: ShieldCheck, label: "settings.access", href: "/settings/access" },
    { id: "notifications", icon: Bell, label: "settings.notifications", href: "/settings/notifications" },
    { id: "rules", icon: List, label: "settings.rules", href: "/settings/rules" },
    { id: "jobs", icon: Activity, label: "settings.jobs", href: "/settings/jobs" },
    { id: "import", icon: UploadCloud, label: "settings.import", href: "/settings/import" },
    { id: "about", icon: Info, label: "settings.about", href: "/settings/about" },
];
