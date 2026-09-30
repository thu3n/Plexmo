"use client";

import { Skeleton } from "@/components/Skeleton";
import { useWrapped } from "../hooks/useWrapped";
import { WrappedControls } from "./WrappedControls";
import { WrappedStory } from "./WrappedStory";

/** /wrapped — one user's year in review as a swipeable story. */
export function WrappedClient() {
    const { data, error, select } = useWrapped();

    return (
        <div className="relative min-h-dvh text-white">
            {/* Same radial-gradient orbs as the dashboard (no blur filters — iOS perf). */}
            <div className="pointer-events-none fixed inset-0 z-0">
                <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(251,191,36,0.08),transparent)]" />
                <div className="absolute right-[-10%] top-0 h-[600px] w-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(168,85,247,0.10),transparent)]" />
                <div className="absolute bottom-[-10%] left-[20%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.05),transparent)]" />
            </div>

            <main className="relative z-10 mx-auto max-w-[1600px] px-4 sm:px-6 main-safe-top pb-dock lg:pb-8">
                <header className="mb-5 flex flex-col items-center gap-3 pt-2 text-center">
                    <h1 className="text-lg font-semibold text-white/90">Wrapped</h1>
                    {data && (
                        <WrappedControls
                            year={data.wrapped.year}
                            years={data.years}
                            userId={data.wrapped.userId}
                            people={data.canPickUser ? data.people : null}
                            onSelect={select}
                        />
                    )}
                </header>

                {error ? (
                    <p className="mx-auto max-w-sm rounded-2xl border border-white/5 bg-white/[0.03] p-6 text-center text-sm text-white/60">
                        {error.message}
                    </p>
                ) : data ? (
                    <WrappedStory key={`${data.wrapped.userId}-${data.wrapped.year}`} data={data.wrapped} />
                ) : (
                    <Skeleton className="mx-auto h-[min(62dvh,640px)] w-[calc(100vw-2rem)] max-w-[380px] rounded-3xl sm:w-[360px]" />
                )}
            </main>
        </div>
    );
}
