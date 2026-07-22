"use client";

import { Flame } from "lucide-react";
import type { UserStats } from "@/lib/user_stats";

export function UserStreakBanner({ streaks }: { streaks: UserStats["streaks"] }) {
    return (
        <div className="rounded-2xl bg-orange-500/10 border border-orange-500/20 p-6 flex items-center justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Flame className="h-32 w-32 text-orange-500" />
            </div>

            <div className="flex gap-8 sm:gap-12 relative z-10">
                <div>
                    <h3 className="text-sm font-medium text-orange-200/60 uppercase tracking-wider mb-1">Current Streak</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-orange-500">{streaks?.current || 0}</span>
                        <span className="text-sm font-bold text-orange-400">days</span>
                    </div>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-orange-200/60 uppercase tracking-wider mb-1">Longest Streak</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-orange-500/50">{streaks?.longest || 0}</span>
                        <span className="text-sm font-bold text-orange-400/50">days</span>
                    </div>
                </div>
            </div>

            <div className="text-right max-w-md hidden sm:block relative z-10">
                <p className="text-orange-200/80 text-sm italic">
                    &quot;Watch at least 10 minutes of playback each day to keep your streak alive!&quot;
                </p>
            </div>
        </div>
    );
}
