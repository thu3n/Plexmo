"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/components/LanguageContext";
import { ServersTab } from "./components/ServersTab";
import { LibrariesTab } from "./components/LibrariesTab";
import { UsersTab } from "./components/UsersTab";
import clsx from "clsx";

function ServersContent() {
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const initialTab = (searchParams.get("tab") as "servers" | "libraries" | "users") || "servers";
    const [activeTab, setActiveTab] = useState<"servers" | "libraries" | "users">(initialTab);

    // Sync with URL param if needed or just use internal state
    // For now simple internal state

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex space-x-1 rounded-xl bg-white/5 p-1 w-fit">
                {(["servers", "libraries", "users"] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={clsx(
                            "rounded-lg py-2.5 px-6 text-sm font-medium leading-5 transition-all duration-200",
                            activeTab === tab
                                ? "bg-amber-500 text-slate-900 shadow-lg"
                                : "text-white/60 hover:bg-white/[0.12] hover:text-white"
                        )}
                    >
                        {t(`settings.${tab}`)}
                    </button>
                ))}
            </div>

            <div className="mt-2">
                {activeTab === "servers" && <ServersTab />}
                {activeTab === "libraries" && <LibrariesTab />}
                {activeTab === "users" && <UsersTab />}
            </div>
        </div>
    );
}

export default function ServersPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-white/50">Loading settings...</div>}>
            <ServersContent />
        </Suspense>
    );
}
