"use client";

import { SettingsSidebar } from "./components/SettingsSidebar";
import { SettingsHeader } from "./components/SettingsHeader";

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-slate-950 text-white selection:bg-amber-500/30 font-sans">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[40rem] h-[40rem] bg-indigo-500/10 rounded-full blur-3xl opacity-40 mix-blend-screen" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[40rem] h-[40rem] bg-amber-500/5 rounded-full blur-3xl opacity-40 mix-blend-screen" />
            </div>

            <SettingsSidebar />

            <div className="flex-1 flex flex-col min-w-0 relative z-10">
                <SettingsHeader />
                <main className="flex-1 p-4 md:p-8 lg:p-12 max-w-6xl mx-auto w-full">
                    {children}
                </main>
            </div>
        </div>
    );
}
