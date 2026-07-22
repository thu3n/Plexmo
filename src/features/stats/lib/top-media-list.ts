import type { MediaTypeKey, TopMediaItem, TopMediaSort } from "../hooks/useOverviewData";
import type { ThumbRef } from "@/lib/stats/media-thumbs";

/**
 * Pure mapping from /api/stats/overview/top-media items to TopList-shaped rows
 * for the merged statistics page. Unit-tested in src/test/top-media-list.test.ts.
 */

export type MediaListRow = {
    key: number;
    label: string;
    sublabel?: string;
    value: number;
    valueLabel: string;
    thumbSrc: string | null;
};

/** h-9 w-6 render size (36x24 CSS px); 90x135 keeps a clean 2:3 covering >3x DPR. */
export const POSTER_THUMB_WIDTH = 90;
export const POSTER_THUMB_HEIGHT = 135;

/** The /api/image proxy appends the Plex token server-side; w/h engage the PMS photo transcoder. */
export const buildThumbUrl = (
    thumb: ThumbRef | null,
    size?: { w: number; h: number },
): string | null =>
    thumb
        ? `/api/image?path=${encodeURIComponent(thumb.path)}&serverId=${encodeURIComponent(thumb.serverId)}${size ? `&w=${size.w}&h=${size.h}` : ""}`
        : null;

export function mapTopMediaToRows(
    items: TopMediaItem[] | undefined,
    metric: TopMediaSort,
    type: MediaTypeKey,
    formatValueLabel: (count: number, metric: TopMediaSort) => string,
): MediaListRow[] {
    if (!items) return [];
    return items.map((item) => {
        const value = metric === "users" ? item.uniqueUsers : item.plays;
        // Episodes carry the series poster, so the show title leads and the episode
        // identifies itself in the sublabel — same hierarchy as the old poster cards.
        const isEpisode = type === "episode";
        return {
            key: item.mediaId,
            label: isEpisode ? (item.showTitle ?? item.title) : item.title,
            sublabel: isEpisode
                ? `S${item.seasonNumber ?? "?"}E${item.episodeNumber ?? "?"} · ${item.title}`
                : item.year
                  ? String(item.year)
                  : undefined,
            value,
            valueLabel: formatValueLabel(value, metric),
            thumbSrc: buildThumbUrl(item.thumb, {
                w: POSTER_THUMB_WIDTH,
                h: POSTER_THUMB_HEIGHT,
            }),
        };
    });
}
