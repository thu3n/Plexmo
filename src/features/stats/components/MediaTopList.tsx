"use client";

import { useState } from "react";
import { useLanguage } from "@/components/LanguageContext";
import { TopList } from "./TopList";
import { useTopMediaBoth, type MediaTypeKey, type TopMediaSort } from "../hooks/useOverviewData";
import { mapTopMediaToRows, type MediaListRow } from "../lib/top-media-list";

const TITLE_KEY_BY_TYPE: Record<MediaTypeKey, string> = {
    movie: "statistics.lists.topMovies",
    show: "statistics.lists.topShows",
    episode: "statistics.lists.topEpisodes",
};

const METRICS: TopMediaSort[] = ["users", "plays"];

function MetricToggle({
    metric,
    onChange,
}: {
    metric: TopMediaSort;
    onChange: (metric: TopMediaSort) => void;
}) {
    const { t } = useLanguage();
    return (
        <div className="flex items-center gap-1 rounded-full border border-white/5 bg-white/5 p-0.5">
            {METRICS.map((m) => (
                <button
                    key={m}
                    onClick={() => onChange(m)}
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${metric === m ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                >
                    {t(m === "users" ? "statistics.sections.popular" : "statistics.sections.mostWatched")}
                </button>
            ))}
        </div>
    );
}

function MediaListThumb({ src, alt }: { src: string | null; alt: string }) {
    // NEVER add loading="lazy" here: the inactive metric variant renders inside a
    // display:none subtree, and lazy images in hidden subtrees are never fetched —
    // that would silently kill the "all posters preload up-front" requirement.
    return src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-9 w-6 shrink-0 rounded bg-slate-800 object-cover" />
    ) : (
        <div className="h-9 w-6 shrink-0 rounded bg-white/5" />
    );
}

/**
 * Top Movies / Top Shows / Top Episodes card for the merged statistics page:
 * the graphs list GUI with a Popular/Most Watched toggle. BOTH metric variants
 * are fetched eagerly and pre-rendered (inactive one hidden) so every poster
 * is loaded before the user ever switches the toggle.
 */
export function MediaTopList({
    type,
    days,
    serverId,
}: {
    type: MediaTypeKey;
    days: number;
    serverId: string | null;
}) {
    const { t } = useLanguage();
    const [metric, setMetric] = useState<TopMediaSort>("users");
    // One request carries both rankings — the server runs the aggregation once.
    const { data, error, isLoading } = useTopMediaBoth(type, days, serverId);

    const formatValueLabel = (count: number, m: TopMediaSort) =>
        t(m === "users" ? "statistics.lists.users" : "statistics.lists.plays", {
            n: String(count),
        });

    const toTopListItem = (row: MediaListRow) => ({
        key: row.key,
        label: row.label,
        sublabel: row.sublabel,
        value: row.value,
        valueLabel: row.valueLabel,
        icon: <MediaListThumb src={row.thumbSrc} alt="" />,
    });

    const variants = [
        { metric: "users" as const, items: data?.byUsers },
        { metric: "plays" as const, items: data?.byPlays },
    ];

    return (
        <div>
            {variants.map((variant) => (
                <div
                    key={variant.metric}
                    className={variant.metric === metric ? undefined : "hidden"}
                    aria-hidden={variant.metric !== metric}
                >
                    <TopList
                        title={t(TITLE_KEY_BY_TYPE[type])}
                        emptyText={error ? error.message : t("statistics.empty")}
                        isLoading={isLoading && !data}
                        headerExtra={<MetricToggle metric={metric} onChange={setMetric} />}
                        items={mapTopMediaToRows(
                            variant.items,
                            variant.metric,
                            type,
                            formatValueLabel,
                        ).map(toTopListItem)}
                    />
                </div>
            ))}
        </div>
    );
}
