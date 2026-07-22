import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { db as appDb } from "@/lib/db";
import { addHistoryEntry, hasHistoryNear, withTransaction } from "@/lib/history";
import { findExistingImported, enrichExistingRow } from "@/lib/tautulli-enrich";
import { mapTautulliToPlexmo, type TautulliFullEntry } from "@/lib/tautulli-mapper";
import { updateJob } from "@/lib/jobs";
import { Logger } from "@/lib/logger";

/**
 * Tautulli database-file import: reads session_history JOINed with
 * session_history_media_info + session_history_metadata straight from a
 * tautulli.db file. This is the COMPLETE import path — the API cannot deliver
 * codecs/resolutions/bitrates in bulk (get_stream_data is one call per row,
 * and real-world instances return null row ids), and the fork's API lacks
 * guid/location/bandwidth entirely.
 *
 * Rows already imported via the API are UPDATED in place (re-enrichment,
 * matched on serverId + importRef + start-time sanity window) instead of
 * skipped — this retroactively restores the data the API import never had,
 * including the copy/direct-stream distinction.
 */

const BATCH_SIZE = 500;
const INSERT_DEDUP_WINDOW_MS = 60 * 1000;

export type TautulliDbInfo = {
    rowCount: number;
    hasServerColumn: boolean;
    /** Fork multi-server DBs: source servers with Plex machineIdentifier. */
    servers: { id: number; name: string; identifier: string | null }[];
    /** Suggested mapping sourceServerId -> Plexmo serverId, via machineIdentifier. */
    suggestedMapping: Record<string, string>;
};

const REQUIRED_TABLES = ["session_history", "session_history_media_info", "session_history_metadata"];

const openSource = (path: string): Database.Database =>
    new Database(path, { readonly: true, fileMustExist: true });

const columnsOf = (src: Database.Database, table: string): Set<string> =>
    new Set((src.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));

/** Validate the file and report servers + row count for the mapping step. */
export const inspectTautulliDb = (path: string): TautulliDbInfo => {
    const src = openSource(path);
    try {
        for (const table of REQUIRED_TABLES) {
            if (!src.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(table)) {
                throw new Error(`Not a Tautulli database: missing table ${table}`);
            }
        }

        const rowCount = (src.prepare("SELECT COUNT(*) as c FROM session_history").get() as { c: number }).c;
        const hasServerColumn = columnsOf(src, "session_history").has("server_id");

        let servers: TautulliDbInfo["servers"] = [];
        if (hasServerColumn && src.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='servers'").get()) {
            servers = (src.prepare(
                "SELECT id, pms_name as name, pms_identifier as identifier FROM servers WHERE pms_is_deleted = 0"
            ).all() as TautulliDbInfo["servers"]);
        }

        // Auto-map via Plex machineIdentifier — the shared natural key.
        const suggestedMapping: Record<string, string> = {};
        const plexmoServers = appDb.prepare(
            "SELECT id, machineIdentifier FROM servers WHERE archivedAt IS NULL"
        ).all() as { id: string; machineIdentifier: string | null }[];
        for (const source of servers) {
            const match = source.identifier
                ? plexmoServers.find((s) => s.machineIdentifier === source.identifier)
                : undefined;
            suggestedMapping[String(source.id)] = match ? match.id : "ignore";
        }

        return { rowCount, hasServerColumn, servers, suggestedMapping };
    } finally {
        src.close();
    }
};

/** Desired -> actual column selection (schema drifts across Tautulli versions). */
const buildSelect = (src: Database.Database): string => {
    const sh = columnsOf(src, "session_history");
    const mi = columnsOf(src, "session_history_media_info");
    const md = columnsOf(src, "session_history_metadata");

    const pick = (table: string, have: Set<string>, wanted: string[], aliases: Record<string, string> = {}) =>
        wanted.filter((c) => have.has(c)).map((c) => `${table}.${c} as ${aliases[c] ?? c}`);

    const parts = [
        ...pick("sh", sh, [
            "id", "reference_id", "started", "stopped", "server_id", "rating_key", "user_id", "user",
            "ip_address", "paused_counter", "player", "product", "platform", "media_type", "view_offset",
            "bandwidth", "location", "quality_profile",
        ]),
        ...pick("mi", mi, [
            "video_decision", "audio_decision", "transcode_decision", "container", "transcode_container",
            "video_codec", "audio_codec", "transcode_video_codec", "transcode_audio_codec",
            "width", "height", "transcode_width", "transcode_height", "transcode_audio_channels",
            "audio_channels", "stream_container", "stream_video_codec", "stream_audio_codec",
            "stream_video_decision", "stream_audio_decision", "bitrate", "stream_bitrate",
            "video_resolution", "stream_video_resolution",
        ]),
        ...pick("md", md, [
            "title", "parent_title", "grandparent_title", "original_title", "year", "thumb",
            "parent_thumb", "grandparent_thumb", "media_index", "parent_media_index",
            "duration", "guid", "parent_rating_key", "grandparent_rating_key",
        ]),
    ];

    return `
        SELECT ${parts.join(", ")}
        FROM session_history sh
        LEFT JOIN session_history_media_info mi ON mi.id = sh.id
        LEFT JOIN session_history_metadata md ON md.id = sh.id
        ORDER BY sh.id
        LIMIT ? OFFSET ?
    `;
};

export type TautulliDbImportOptions = {
    path: string;
    /** sourceServerId -> Plexmo serverId (or 'ignore'). Single-server DBs use key "0". */
    serverMapping: Record<string, string>;
};

export async function runTautulliDbImport(jobId: string, opts: TautulliDbImportOptions): Promise<void> {
    const { path, serverMapping } = opts;
    const instanceKey = createHash("sha1").update(path).digest("hex").slice(0, 8);
    const importSource = `tautulli:db:${instanceKey}`;

    let src: Database.Database | undefined;
    try {
        src = openSource(path);
        const select = src.prepare(buildSelect(src));
        const hasServerColumn = columnsOf(src, "session_history").has("server_id");
        const total = (src.prepare("SELECT COUNT(*) as c FROM session_history").get() as { c: number }).c;

        updateJob(jobId, { status: "running", totalItems: total, message: `Importing ${total} rows from database file...`, progress: 1 });

        let processed = 0;
        let enriched = 0;
        let inserted = 0;
        let skipped = 0;

        const processBatch = withTransaction((rows: TautulliFullEntry[]) => {
            for (const row of rows) {
                const sourceServerId = hasServerColumn ? String(row.server_id) : "0";
                const targetServerId = serverMapping[sourceServerId];
                if (!targetServerId || targetServerId === "ignore") { skipped++; continue; }
                if (!row.stopped) { skipped++; continue; }

                const mapped = mapTautulliToPlexmo(
                    { ...row, plex_guid: row.guid?.startsWith("plex://") ? row.guid : undefined },
                    { [Number(sourceServerId)]: targetServerId },
                    importSource,
                    targetServerId
                );

                const startedMs = row.started * 1000;
                const existing = findExistingImported(targetServerId, String(row.id), startedMs);

                if (existing) {
                    enrichExistingRow(existing.id, mapped, row.player);
                    enriched++;
                } else if (
                    hasHistoryNear(
                        targetServerId, mapped.user, mapped.ratingKey,
                        mapped.startTime - INSERT_DEDUP_WINDOW_MS, mapped.startTime + INSERT_DEDUP_WINDOW_MS
                    )
                ) {
                    // Same play already recorded live (or by another import) —
                    // without a matching importRef we must not double-log it.
                    skipped++;
                } else {
                    addHistoryEntry(mapped);
                    inserted++;
                }
            }
        });

        for (let offset = 0; offset < total; offset += BATCH_SIZE) {
            const rows = select.all(BATCH_SIZE, offset) as TautulliFullEntry[];
            processBatch(rows);
            processed += rows.length;
            updateJob(jobId, {
                itemsProcessed: processed,
                progress: Math.min(99, Math.round((processed / total) * 100)),
                message: `${processed}/${total} rows — ${enriched} enriched, ${inserted} new, ${skipped} skipped`,
            });
        }

        updateJob(jobId, {
            status: "completed",
            progress: 100,
            message: `Done: ${enriched} enriched, ${inserted} new, ${skipped} skipped of ${total} rows.`,
        });
        Logger.info(`[TautulliDbImport] ${path}: enriched=${enriched} inserted=${inserted} skipped=${skipped}`);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        Logger.error("[TautulliDbImport] Failed:", e);
        updateJob(jobId, { status: "failed", message: `Import failed: ${message}` });
    } finally {
        src?.close();
    }
}
