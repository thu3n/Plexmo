"use client";

import { usePathname } from "next/navigation";
import { SettingsSidebar } from "@/features/settings/components/layout/SettingsSidebar";
import { SettingsHeader } from "@/features/settings/components/layout/SettingsHeader";

// Data-dense pages (user directory + per-user statistics) get the app's wide
// dashboard width; form-style settings pages stay comfortably narrow.
const WIDE_PREFIX = "/settings/users";

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const maxWidth = pathname.startsWith(WIDE_PREFIX) ? "max-w-[1600px]" : "max-w-6xl";
    return (
        <div className="flex min-h-dvh safe-x bg-slate-950 text-white selection:bg-amber-500/30 font-sans">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[40rem] h-[40rem] rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.10),transparent)] opacity-40 mix-blend-screen" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[40rem] h-[40rem] rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.05),transparent)] opacity-40 mix-blend-screen" />
            </div>

            <SettingsSidebar />

            <div className="flex-1 flex flex-col min-w-0 relative z-10">
                <SettingsHeader />
                <main className={`flex-1 p-4 md:p-8 lg:p-12 pb-dock ${maxWidth} mx-auto w-full`}>
                    {children}
                </main>
            </div>
        </div>
    );
}
