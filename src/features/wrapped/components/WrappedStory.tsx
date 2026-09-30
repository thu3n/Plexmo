"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { WrappedData } from "@/lib/stats/wrapped";
import { buildStoryCards, type StoryCardKey } from "../lib/wrapped-format";
import { useStoryNavigation } from "../hooks/useStoryNavigation";
import { IntroCard, RhythmCard, TimeCard } from "./cards/TimeCards";
import { BingeCard, TopTitlesCard } from "./cards/TitleCards";
import { DevicesCard, GenresCard } from "./cards/TasteCards";
import { OutroCard } from "./cards/OutroCard";

const renderCard = (key: StoryCardKey, data: WrappedData): ReactNode => {
    switch (key) {
        case "intro":
            return <IntroCard data={data} />;
        case "time":
            return <TimeCard data={data} />;
        case "shows":
            return <TopTitlesCard eyebrow="Your top shows" tone="violet" titles={data.topShows} />;
        case "movies":
            return <TopTitlesCard eyebrow="Your top movies" tone="sky" titles={data.topMovies} />;
        case "binge":
            return data.longestBinge && <BingeCard binge={data.longestBinge} />;
        case "rhythm":
            return <RhythmCard data={data} />;
        case "devices":
            return <DevicesCard devices={data.devices} />;
        case "genres":
            return data.genres && <GenresCard genres={data.genres} />;
        case "outro":
            return <OutroCard data={data} />;
    }
};

function NavButton({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
    const Icon = side === "left" ? ChevronLeft : ChevronRight;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={side === "left" ? "Previous card" : "Next card"}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 disabled:opacity-30 sm:flex"
        >
            <Icon className="h-5 w-5" />
        </button>
    );
}

/** Swipeable card sequence: scroll-snap on touch, arrows/keys on desktop, progress segments on top. */
export function WrappedStory({ data }: { data: WrappedData }) {
    const cards = buildStoryCards(data);
    const { stripRef, active, goTo } = useStoryNavigation(cards.length);

    return (
        <div>
            <div className="mx-auto flex max-w-[380px] gap-1 sm:max-w-[360px]" role="tablist" aria-label="Wrapped cards">
                {cards.map((key, i) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={i === active}
                        aria-label={`Card ${i + 1} of ${cards.length}`}
                        onClick={() => goTo(i)}
                        className="h-1 flex-1 rounded-full bg-white/10"
                    >
                        <span className={clsx("block h-full rounded-full transition-colors", i <= active ? "bg-amber-400" : "bg-transparent")} />
                    </button>
                ))}
            </div>

            <div className="mt-4 flex items-center justify-center gap-4">
                <NavButton side="left" disabled={active === 0} onClick={() => goTo(active - 1)} />
                <div
                    ref={stripRef}
                    className="relative flex w-full max-w-[1200px] snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-[max(0px,calc(50%-190px))] pb-2 [scrollbar-width:none] sm:px-[calc(50%-180px)] [&::-webkit-scrollbar]:hidden"
                >
                    {cards.map((key) => (
                        <div key={key} className="shrink-0 snap-center">
                            {renderCard(key, data)}
                        </div>
                    ))}
                </div>
                <NavButton side="right" disabled={active === cards.length - 1} onClick={() => goTo(active + 1)} />
            </div>
        </div>
    );
}
