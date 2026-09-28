import { Sparkles } from "lucide-react";
import { SettingsCard } from "@/features/settings/components/ui/SettingsShell";

const ROWS: { label: string; value: string }[] = [
    { label: "License", value: "MIT License" },
    { label: "Tech Stack", value: "Next.js 16 · TypeScript · Tailwind CSS 4" },
    { label: "Database", value: "better-sqlite3 · SQLite" },
];

export function ProjectInfoCard() {
    return (
        <SettingsCard>
            <div className="space-y-4">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white">Project Information</h3>
                        <p className="text-sm text-white/50 max-w-xl leading-relaxed">
                            Plexmo is a free and open source monitoring and analytics dashboard for your Plex ecosystem
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 text-sm">
                    {ROWS.map((row) => (
                        <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/5">
                            <span className="text-white/50">{row.label}</span>
                            <span className="text-white font-medium">{row.value}</span>
                        </div>
                    ))}
                    <div className="flex items-center justify-between py-2">
                        <span className="text-white/50">Development Philosophy</span>
                        <span className="text-white font-medium flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-400" />
                            Vibe Coded
                        </span>
                    </div>
                </div>

                <div className="pt-4 text-xs text-white/30 italic">
                    This project is developed independently and is not affiliated with Plex Inc.
                </div>
            </div>
        </SettingsCard>
    );
}
