// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", async () => {
    const { createTestDb } = await import("@/test/db-helper");
    return { db: createTestDb() };
});

import { db } from "@/lib/db";
import { getHistory } from "@/lib/history/history-read";

let seq = 0;
const insertRow = (title: string, subtitle: string | null, mediaId: number | null) => {
    db.prepare(
        `INSERT INTO activity_history (id, serverId, userId, user, title, subtitle, ratingKey, startTime, stopTime, duration, pausedCounter, mediaId)
         VALUES (?, 'srv-a', '100', 'u', ?, ?, '1', ?, ?, 600, 0, ?)`
    ).run(`hs-${seq}`, title, subtitle, 1000 + seq, 2000 + seq++, mediaId);
};

beforeEach(() => {
    seq = 0;
    db.prepare("DELETE FROM activity_history").run();
    db.prepare("DELETE FROM media_items").run();
    db.prepare("DELETE FROM library_items").run();
});

describe("getHistory search", () => {
    it("matches frozen row title and subtitle", () => {
        insertRow("Sunny Side - Season 4", "S4 E5", null);
        insertRow("Other Show", "Victors förhållande", null);
        insertRow("Unrelated", "S1 E1", null);

        expect(getHistory({ search: "Sunny Side" }).data).toHaveLength(1);
        expect(getHistory({ search: "Victors" }).data).toHaveLength(1);
        expect(getHistory({ search: "nomatch" }).data).toHaveLength(0);
    });

    it("matches the canonical show title even when the row text uses another name", () => {
        const showId = Number(
            db.prepare(
                `INSERT INTO media_items (type, title, year, createdAt, updatedAt)
                 VALUES ('show', 'Solsidan', 2010, '2026-01-01', '2026-01-01')`
            ).run().lastInsertRowid
        );
        const epId = Number(
            db.prepare(
                `INSERT INTO media_items (type, title, year, showMediaId, seasonNumber, episodeNumber, createdAt, updatedAt)
                 VALUES ('episode', 'Victors förhållande', 2011, ?, 4, 5, '2026-01-01', '2026-01-01')`
            ).run(showId).lastInsertRowid
        );
        insertRow("Sunny Side - Season 4 • Victors förhållande", "S4 E5", epId);

        const result = getHistory({ search: "Solsidan" });
        expect(result.data).toHaveLength(1);
        expect(result.data[0].title).toContain("Sunny Side");
    });

    it("matches any server's library title (language aliases)", () => {
        const showId = Number(
            db.prepare(
                `INSERT INTO media_items (type, title, year, createdAt, updatedAt)
                 VALUES ('show', 'Money Heist', 2017, '2026-01-01', '2026-01-01')`
            ).run().lastInsertRowid
        );
        const epId = Number(
            db.prepare(
                `INSERT INTO media_items (type, title, year, showMediaId, seasonNumber, episodeNumber, createdAt, updatedAt)
                 VALUES ('episode', 'Episodio 1', 2017, ?, 1, 1, '2026-01-01', '2026-01-01')`
            ).run(showId).lastInsertRowid
        );
        // Another server's library lists the show under its Spanish title.
        db.prepare(
            `INSERT INTO library_items (serverId, ratingKey, sectionKey, mediaId, type, title, syncedAt, thumb)
             VALUES ('srv-b', '9', '1', ?, 'show', 'La Casa de Papel', 0, '/t')`
        ).run(showId);
        insertRow("Money Heist - Season 1", "S1 E1", epId);

        expect(getHistory({ search: "La Casa de Papel" }).data).toHaveLength(1);
        expect(getHistory({ search: "Money Heist" }).data).toHaveLength(1);
    });
});
