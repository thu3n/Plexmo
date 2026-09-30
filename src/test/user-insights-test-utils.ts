import { db } from "@/lib/db";

/**
 * Seed helpers shared by the user-insights tests. Callers mock `@/lib/db`
 * with an in-memory database (see db-helper.ts) before importing this.
 */

let seq = 0;

export type PlaySeed = {
    userId: string;
    startTime: number;
    stopTime?: number;
    serverId?: string;
    user?: string;
    ip?: string | null;
    location?: string | null;
    platform?: string | null;
    device?: string | null;
    percent?: number | null;
    seconds?: number;
    mediaId?: number | null;
};

const TEN_MINUTES_S = 600;

export const insertPlay = (seed: PlaySeed): void => {
    const seconds = seed.seconds ?? TEN_MINUTES_S;
    db.prepare(
        `INSERT INTO activity_history (
            id, serverId, userId, user, title, ratingKey, startTime, stopTime, duration,
            platform, device, ip, location, pausedCounter, play_duration, percent_complete, mediaId
        ) VALUES (?, ?, ?, ?, 'Test', '1', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).run(
        `ui-${seq++}`,
        seed.serverId ?? "srv-a",
        seed.userId,
        seed.user ?? `name-${seed.userId}`,
        seed.startTime,
        seed.stopTime ?? seed.startTime + seconds * 1000,
        seconds,
        seed.platform ?? null,
        seed.device ?? null,
        seed.ip ?? null,
        seed.location ?? null,
        seconds,
        seed.percent === undefined ? 90 : seed.percent,
        seed.mediaId ?? null,
    );
};

export const insertIdentity = (accountId: string, title: string, thumb: string | null = null): void => {
    db.prepare(
        `INSERT INTO user_identities (accountId, username, title, email, thumb, createdAt, updatedAt)
         VALUES (?, ?, ?, NULL, ?, '2026-01-01', '2026-01-01')`
    ).run(accountId, title, title, thumb);
};

export const insertMedia = (id: number, type: string, title: string, showMediaId: number | null = null): void => {
    db.prepare(
        `INSERT INTO media_items (id, type, title, year, showMediaId, seasonNumber, episodeNumber, createdAt, updatedAt)
         VALUES (?, ?, ?, 2026, ?, ?, ?, '2026-01-01', '2026-01-01')`
    ).run(id, type, title, showMediaId, showMediaId ? 1 : null, showMediaId ? id : null);
};

export const insertLibraryItem = (serverId: string, ratingKey: string, mediaId: number, genres: string[]): void => {
    db.prepare(
        `INSERT INTO library_items (serverId, ratingKey, sectionKey, mediaId, type, title, syncedAt)
         VALUES (?, ?, '1', ?, 'movie', 'T', 0)`
    ).run(serverId, ratingKey, mediaId);
    for (const genre of genres) {
        db.prepare("INSERT INTO library_item_genres (serverId, ratingKey, genre) VALUES (?, ?, ?)")
            .run(serverId, ratingKey, genre);
    }
};

export const resetPeopleTables = (): void => {
    seq = 0;
    for (const table of [
        "activity_history",
        "user_identities",
        "media_items",
        "library_items",
        "library_item_genres",
    ]) {
        db.prepare(`DELETE FROM ${table}`).run();
    }
};
