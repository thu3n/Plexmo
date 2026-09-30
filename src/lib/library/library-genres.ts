import { db } from "../db";
import { decodePlexString, toArray } from "../plex/plex-client";

/**
 * Plex genre tags on library items (migration v18). The section listing
 * (`/library/sections/{key}/all`) carries `<Genre tag="..."/>` children per
 * item; Plex trims them to the first few in listings, which is enough for
 * profile/genre stats. XML from Plex is untrusted — only string tags of sane
 * length survive, and an item can contribute a bounded number of rows.
 */

/** Longest genre name kept; real Plex genres are short words ("Science Fiction"). */
export const MAX_GENRE_LENGTH = 64;
/** Upper bound of genre rows per item — guards against a malformed/hostile payload. */
export const MAX_GENRES_PER_ITEM = 20;

type GenreTag = { tag?: unknown };

/** Extract a de-duplicated, validated genre list from a parsed Plex metadata item. */
export const parsePlexGenres = (item: unknown): string[] => {
    if (!item || typeof item !== "object") return [];
    const raw = (item as { Genre?: GenreTag | GenreTag[] }).Genre;
    const genres = new Set<string>();
    for (const entry of toArray(raw)) {
        if (!entry || typeof entry !== "object") continue;
        const tag = entry.tag;
        if (typeof tag !== "string" && typeof tag !== "number") continue;
        const name = decodePlexString(String(tag)).trim();
        if (!name || name.length > MAX_GENRE_LENGTH) continue;
        genres.add(name);
        if (genres.size >= MAX_GENRES_PER_ITEM) break;
    }
    return [...genres];
};

const deleteItemGenres = db.prepare(
    "DELETE FROM library_item_genres WHERE serverId = ? AND ratingKey = ?"
);

const insertGenre = db.prepare(
    "INSERT OR IGNORE INTO library_item_genres (serverId, ratingKey, genre) VALUES (?, ?, ?)"
);

const deleteOrphanGenres = db.prepare(`
  DELETE FROM library_item_genres
  WHERE serverId = ? AND NOT EXISTS (
    SELECT 1 FROM library_items li
    WHERE li.serverId = library_item_genres.serverId AND li.ratingKey = library_item_genres.ratingKey
  )
`);

/**
 * Replace one item's genres. Must run inside the caller's sync transaction so
 * an item never sits half-updated.
 */
export const replaceItemGenres = (serverId: string, ratingKey: string, genres: string[]): void => {
    deleteItemGenres.run(serverId, ratingKey);
    for (const genre of genres) insertGenre.run(serverId, ratingKey, genre);
};

/** Drop genre rows whose library item vanished (run after the vanished-item sweep). */
export const pruneOrphanGenres = (serverId: string): void => {
    deleteOrphanGenres.run(serverId);
};
