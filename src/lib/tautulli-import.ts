import { createHash } from "node:crypto";
import { addHistoryEntry, hasHistoryNear, hasActiveSessionNear, withTransaction } from "@/lib/history";
import { listLocalUsers, createGhostUser } from "@/lib/users";
import { setSetting } from "@/lib/settings";
import { mapTautulliToPlexmo } from "@/lib/tautulli-mapper";
import { updateJob } from "@/lib/jobs";
import { Logger } from "@/lib/logger";
import {
    resolveServerNames,
    fetchActiveSessions,
    fetchServerCount,
    fetchSeriesMeta,
    fetchMovieMeta,
    fetchStreamDataBatch,
    applyStreamData,
    buildCompatibleEntry,
    type SeriesMeta,
    type MovieMeta,
} from "@/lib/tautulli-client";
import { findExistingImported, enrichExistingRow } from "@/lib/tautulli-enrich";

export interface TautulliImportOptions {
    /** Base Tautulli URL with any trailing slash already stripped. */
    cleanUrl: string;
    apiKey: string;
    /** Map of Tautulli source server id -> target Plexmo server id (or 'ignore'). */
    serverMapping: Record<string, string>;
}

/**
 * Runs the full Tautulli history import as a background job. Extracted verbatim
 * from the original route handler's inline IIFE so the route stays HTTP-only
 * (validate -> create job -> kick this off). Reports progress/terminal state via
 * updateJob(jobId, ...); never throws (failures are recorded on the job).
 */
export async function runTautulliImport(jobId: string, opts: TautulliImportOptions): Promise<void> {
    const { cleanUrl, apiKey, serverMapping } = opts;
    const apiUrl = `${cleanUrl}/api/v2`;

    // Provenance key for this Tautulli instance. Combined with the source row
    // id in UNIQUE(serverId, importSource, importRef) it makes re-imports
    // idempotent and lets two Tautulli instances import without colliding.
    const instanceKey = createHash("sha1").update(cleanUrl).digest("hex").slice(0, 8);
    const importSource = `tautulli:${instanceKey}`;

    try {
        updateJob(jobId, { status: 'running', message: 'Connecting to Tautulli...', progress: 0 });

        // 1. Verify Connection (Fast check)
        try {
            // Just check server names to ensure connectivity
            const res = await fetch(`${apiUrl}?apikey=${apiKey}&cmd=get_server_names`);
            if (!res.ok) {
                // Fallback to get_servers_info for standard
                const res2 = await fetch(`${apiUrl}?apikey=${apiKey}&cmd=get_servers_info`);
                if (!res2.ok) throw new Error(`API Error ${res2.status}`);
            }
        } catch (e: any) {
            updateJob(jobId, { status: 'failed', message: `Connection Failed: ${e.message}` });
            return;
        }

        // Persist Settings
        try {
            setSetting("TAUTULLI_URL", cleanUrl);
            setSetting("TAUTULLI_API_KEY", apiKey);
        } catch (e) {
            Logger.warn("Failed to save Tautulli settings", e);
        }

        // 2. Fetch History (PER SERVER)
        const sourceServerIds = Object.keys(serverMapping);
        let totalImported = 0;
        let totalEnriched = 0;
        let grandTotalItems = 0;
        let skippedCount = 0;
        let failedCount = 0;

        // A. Resolve Server Names
        updateJob(jobId, { message: 'Resolving server names...', progress: 1 });
        const serverNames = await resolveServerNames(apiUrl, apiKey);

        // B. Pre-fetch Active Sessions (To prevent "ghost" history of ongoing items)
        updateJob(jobId, { message: 'Checking active sessions...', progress: 1 });
        const activeSessionsMap = await fetchActiveSessions(apiUrl, apiKey); // Key: "${user}-${rating_key}", Value: started_timestamp
        const seriesMetaCache = new Map<string, SeriesMeta>();
        const movieMetaCache = new Map<string, MovieMeta>();

        // C. Pre-fetch Counts
        updateJob(jobId, { message: 'Calculating total items...', progress: 2 });
        const serverCounts: Record<string, number> = {};

        // PRE-FETCH USERS for Mapping
        // We need to map Tautulli "User" (username) to Plexmo User ID.
        const allUsers = listLocalUsers();
        // Map: `${serverId}:${username}` -> userId
        const userMap = new Map<string, string>();
        allUsers.forEach(u => {
            if (u.username) userMap.set(`${u.serverId}:${u.username}`, u.id);
            if (u.title) userMap.set(`${u.serverId}:${u.title}`, u.id); // Fallback to title
        });
        Logger.info(`[Import] Loaded ${allUsers.length} users for resolution.`);

        const unknownUsers = new Set<string>();

        for (const sourceId of sourceServerIds) {
            const count = await fetchServerCount(apiUrl, apiKey, sourceId);
            serverCounts[sourceId] = count;
            grandTotalItems += count;
        }

        updateJob(jobId, { totalItems: grandTotalItems, message: `Starting import of ${grandTotalItems} items...`, progress: 5 });

        const globalStartTime = Date.now();

        for (const [sourceId, targetId] of Object.entries(serverMapping)) {
            if (targetId === 'ignore') continue;

            const serverName = serverNames[sourceId] || `Server ${sourceId}`;
            const serverTotal = serverCounts[sourceId] || 0;

            if (serverTotal === 0) continue;

            let keepFetchingServer = true;
            let start = 0;
            let currentBatchSize = 1000; // Start with 1000 fast mode
            const baseServerUrl = `${apiUrl}?apikey=${apiKey}&cmd=get_history&server_id=${sourceId}`;
            let serverItemsProcessed = 0;

            try {
                updateJob(jobId, { message: `Importing ${serverName}...` });

                while (keepFetchingServer) {
                    // Rate Limit: Removed for speed as requested
                    // await new Promise(r => setTimeout(r, 200));

                    // CLAMP LOGIC: Avoid overshooting
                    // If start + currentBatchSize > serverTotal, we reduce length.
                    // But usually APIs handle this. If Tautulli 400s, we MUST clamp.
                    let actualBatchSize = currentBatchSize;
                    if (serverTotal > 0) {
                        const remaining = serverTotal - start;
                        if (remaining <= 0) {
                            keepFetchingServer = false;
                            break;
                        }
                        if (actualBatchSize > remaining) {
                            actualBatchSize = remaining;
                        }
                    }

                    const historyUrl = `${baseServerUrl}&length=${actualBatchSize}&start=${start}&grouping=0`;

                    let histJson: any = null;
                    let fetchSuccess = false;

                    // Retry Logic (10 Attempts)
                    for (let attempt = 1; attempt <= 10; attempt++) {
                        try {
                            if (attempt === 1) {
                                Logger.debug(`[Perf] Starting Fetch Batch: ${start} (Size: ${actualBatchSize}) for ${serverName} at ${new Date().toISOString()}`);
                            }

                            // TIMEOUT & ERROR HANDLER WRAPPER
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s Timeout

                            let histRes;
                            try {
                                histRes = await fetch(historyUrl, { signal: controller.signal });
                            } finally {
                                clearTimeout(timeoutId);
                            }

                            // ADAPTIVE FIX: If 400 Bad Request
                            if (histRes.status === 400) {
                                if (currentBatchSize > 200) {
                                    Logger.warn(`Hit 400 Bad Request at offset ${start} (len ${actualBatchSize}). Reducing base batch to 200.`);
                                    currentBatchSize = 200;
                                    fetchSuccess = false;
                                    break;
                                } else {
                                    throw new Error(`API Error 400: Bad Request at minimum batch size.`);
                                }
                            }

                            if (!histRes.ok) {
                                throw new Error(`HTTP Error ${histRes.status} ${histRes.statusText}`);
                            }

                            histJson = await histRes.json();

                            if (histJson?.response?.result === 'success') {
                                fetchSuccess = true;
                                Logger.debug(`[Perf] Fetch Success for ${serverName} at ${start}. Processing...`);
                                break;
                            } else {
                                throw new Error(histJson?.response?.message || "API Error: No Success Result");
                            }
                        } catch (e: any) {
                            const errString = String(e);
                            const isNetworkError = errString.includes("ECONNRESET") || errString.includes("ETIMEDOUT") || errString.includes("AbortError") || errString.includes("fetch failed");

                            // Strict Network Error Handling: Reduce Batch Size immediately
                            if (isNetworkError && currentBatchSize > 200) {
                                Logger.warn(`Network Instability (${e.message}) at offset ${start}. Reducing batch size to 200 and retrying.`);
                                currentBatchSize = 200;
                                fetchSuccess = false;
                                break; // Break retry loop to restart 'while' loop with new smaller batch size
                            }

                            // Turbo Mode: fixed 100ms delay for retries
                            const delay = isNetworkError ? 1000 : 100; // Wait longer for network issues
                            const errorMsg = `Batch attempt ${attempt}/10 failed for ${serverName} at ${start} (batch size ${currentBatchSize}): ${e.message}`;
                            Logger.warn(errorMsg);

                            if (attempt > 2) {
                                updateJob(jobId, { message: `Warning: ${errorMsg}. Retrying...` });
                            }

                            if (attempt < 10) await new Promise(r => setTimeout(r, delay));
                        }
                    }

                    if (!fetchSuccess) {
                        // If we are here, we either exhausted retries OR we broke early due to 400.
                        // If actualBatchSize > currentBatchSize, it means we JUST reduced it!
                        if (actualBatchSize > currentBatchSize) {
                            // We reduced it this iteration. Retry immediately.
                            continue;
                        }

                        const failMsg = `CRITICAL: Failed to fetch batch at ${start} for ${serverName} after 10 retries (batch size ${currentBatchSize}). Skipping batch.`;
                        Logger.error(failMsg);
                        updateJob(jobId, { message: failMsg });

                        // SKIP this batch, but continue importing the rest!
                        start += currentBatchSize;
                        continue;
                    }

                    const records = histJson.response?.data?.data;

                    if (!records || !Array.isArray(records) || records.length === 0) {
                        keepFetchingServer = false;
                        break;
                    }


                    // --- PRE-FETCH SERIES METADATA (For linking Episodes to Series correctly) ---
                    // AND MOVIES METADATA
                    const neededKeys = new Set<string>();
                    const neededMovieKeys = new Set<string>();

                    records.forEach((r: any) => {
                        if (r.media_type === 'episode' && r.grandparent_rating_key && !seriesMetaCache.has(String(r.grandparent_rating_key))) {
                            neededKeys.add(String(r.grandparent_rating_key));
                        }
                        if (r.media_type === 'movie' && r.rating_key && !movieMetaCache.has(String(r.rating_key))) {
                            // Also check if the row itself ALREADY has good data? Cur verified it doesn't.
                            neededMovieKeys.add(String(r.rating_key));
                        }
                    });

                    // fetch series meta (links episodes to their series)
                    await fetchSeriesMeta(apiUrl, apiKey, neededKeys, seriesMetaCache);

                    // fetch movie meta (external ids / guid)
                    await fetchMovieMeta(apiUrl, apiKey, neededMovieKeys, movieMetaCache);

                    // Per-row stream detail (decisions/codecs/resolutions/bitrate) —
                    // get_history can't deliver these in bulk; get_stream_data can
                    // per row (~8ms on-box). Skip live rows (null id).
                    const rowIds: (string | number)[] = records
                        .map((r: any) => r.row_id || r.id)
                        .filter((id: unknown): id is string | number => id !== null && id !== undefined);
                    updateJob(jobId, { message: `Fetching stream details for ${rowIds.length} rows (${serverName})...` });
                    const streamDataMap = await fetchStreamDataBatch(apiUrl, apiKey, rowIds);

                    // Process Batch in Transaction
                    const processBatch = withTransaction((entries: any[]) => {
                        for (const row of entries) {
                            try {
                                // Skip entries with no stopped time (ongoing/incomplete)
                                if (!row.stopped) {
                                    skippedCount++;
                                    serverItemsProcessed++;
                                    continue;
                                }

                                const sourceRowId = row.row_id || row.id;

                                // Already imported (any tautulli source, matched on
                                // importRef + start window)? Enrich in place with the
                                // stream-data-augmented meta instead of skipping.
                                if (sourceRowId) {
                                    const existing = findExistingImported(String(targetId), String(sourceRowId), row.date * 1000);
                                    if (existing) {
                                        const enrichEntry = buildCompatibleEntry(row, sourceId, seriesMetaCache, movieMetaCache);
                                        applyStreamData(enrichEntry, streamDataMap.get(String(sourceRowId)), row);
                                        const enrichMapped = mapTautulliToPlexmo(enrichEntry, { [parseInt(String(sourceId))]: String(targetId) }, importSource);
                                        enrichExistingRow(existing.id, enrichMapped, row.player);
                                        totalEnriched++;
                                        serverItemsProcessed++;
                                        continue;
                                    }
                                }

                                // Strict Duplicate Check — server-qualified:
                                // ratingKeys are per-server-local and collide
                                // across servers.
                                const startTimeMs = row.date * 1000;
                                const bufferMs = 60 * 1000;

                                const historyDup = hasHistoryNear(String(targetId), row.user, String(row.rating_key), startTimeMs - bufferMs, startTimeMs + bufferMs);

                                if (historyDup) {
                                    skippedCount++;
                                    serverItemsProcessed++;
                                    continue;
                                }

                                // 3. Active Session Check (Tautulli vs Tautulli)
                                // If Tautulli says it's history, but ALSO says it's active... and timestamps overlap...
                                // It means Tautulli exported a "stopped" event for an ongoing stream (maybe due to network glitch or import artifacts).
                                const activeKey = `${row.user}-${row.rating_key}`;
                                if (activeSessionsMap.has(activeKey)) {
                                    const activeStarted = activeSessionsMap.get(activeKey)!;
                                    const historyStopped = row.stopped || (row.date + row.duration);

                                    // If the history item "stopped" AFTER the active session started,
                                    // it is likely a fragment of the currently playing session.
                                    // Give a small buffer (e.g., history stopped at 22:15, active started at 22:14 -> Skip).
                                    // But if active started at 22:20, and history stopped 22:15 -> It's a previous session (Resume). Keep it.
                                    if (historyStopped > activeStarted) {
                                        skippedCount++;
                                        serverItemsProcessed++;
                                        continue;
                                    }
                                }

                                const activeDup = hasActiveSessionNear(String(targetId), row.user, String(row.rating_key), startTimeMs - bufferMs, startTimeMs + bufferMs);

                                if (activeDup) {
                                    skippedCount++;
                                    serverItemsProcessed++;
                                    continue;
                                }

                                const compatibleEntry = buildCompatibleEntry(row, sourceId, seriesMetaCache, movieMetaCache);
                                applyStreamData(compatibleEntry, streamDataMap.get(String(sourceRowId)), row);

                                const rawDuration = compatibleEntry.stopped - compatibleEntry.started;
                                if (rawDuration > 86400) {
                                    skippedCount++;
                                    serverItemsProcessed++;
                                    continue;
                                }

                                const singleEntryMap: Record<number, string> = {
                                    [parseInt(String(sourceId))]: String(targetId)
                                };
                                const mapped = mapTautulliToPlexmo(compatibleEntry, singleEntryMap, importSource);

                                // RESOLVE USER ID
                                let resolvedUserId = userMap.get(`${String(targetId)}:${row.user}`);

                                // GHOST USER HANDLING: If not found, create them!
                                if (!resolvedUserId && row.user_id) {
                                    const ghostId = String(row.user_id);
                                    const ghostUsername = row.user; // Username might be same as Title in Tautulli history sometimes
                                    const ghostTitle = row.user;   // History often only has 'user' (which is title or username)

                                    try {
                                        // Create the user in Plexmo DB (INSERT OR IGNORE inside the helper).
                                        createGhostUser({
                                            id: ghostId,
                                            title: ghostTitle,
                                            username: ghostUsername,
                                            serverId: String(targetId),
                                        });

                                        // Update local map so next row finds it immediately
                                        resolvedUserId = ghostId;
                                        userMap.set(`${String(targetId)}:${row.user}`, ghostId);

                                        Logger.info(`[Import] Created Ghost User: ${ghostUsername} (${ghostId}) on server ${targetId}`);

                                    } catch (e) {
                                        Logger.error(`[Import] Failed to create ghost user ${ghostUsername}`, e);
                                    }
                                }

                                if (resolvedUserId) {
                                    mapped.userId = resolvedUserId;
                                } else {
                                    // Only if truly failed (no user_id available?)
                                    unknownUsers.add(`${row.user} (ID: ${row.user_id})`);
                                }

                                addHistoryEntry(mapped);
                                totalImported++;
                                serverItemsProcessed++;

                            } catch {
                                skippedCount++;
                                serverItemsProcessed++; // Count as processed even if skipped due to error
                            }
                        }
                    });

                    processBatch(records);
                    Logger.info(`[Perf] Batch Complete: ${start} at ${new Date().toISOString()}`);

                    // IMPORTANT FIX: use currentBatchSize instead of length
                    start += currentBatchSize;

                    // Fix Progress: Include skipped items in the "processed" count
                    const realProcessed = totalImported + totalEnriched + skippedCount;
                    const progressPercent = grandTotalItems > 0
                        ? Math.min(99, Math.round((realProcessed / grandTotalItems) * 100))
                        : 0;

                    // Calculate ETA
                    let etaString = "";
                    const elapsedMs = Date.now() - globalStartTime;
                    if (realProcessed > 0 && elapsedMs > 2000) {
                        const rate = realProcessed / elapsedMs; // items per ms
                        const remainingItems = grandTotalItems - realProcessed;
                        if (remainingItems > 0) {
                            const etaMs = remainingItems / rate;
                            const etaSec = Math.ceil(etaMs / 1000);
                            if (etaSec < 60) {
                                etaString = ` - ETA: ${etaSec}s`;
                            } else {
                                const mins = Math.floor(etaSec / 60);
                                const secs = etaSec % 60;
                                etaString = ` - ETA: ${mins}m ${secs}s`;
                            }
                        }
                    }

                    updateJob(jobId, {
                        progress: progressPercent,
                        itemsProcessed: realProcessed,
                        message: `Importing ${serverName} (${start}/${serverTotal})${etaString}...`
                    });

                    if (start >= serverTotal) {
                        keepFetchingServer = false;
                    }
                }

                if (serverItemsProcessed < serverTotal) {
                    const unprocessed = serverTotal - serverItemsProcessed;
                    failedCount += unprocessed;
                    Logger.warn(`Server ${serverName}: Expected ${serverTotal}, processed ${serverItemsProcessed}. Added ${unprocessed} to failed count.`);
                }

            } catch (err: any) {
                Logger.error(`Error importing server ${sourceId}`, err);
                const unprocessed = serverTotal - (serverItemsProcessed || 0);
                if (unprocessed > 0) {
                    failedCount += unprocessed;
                }
            }
        }

        // Debug Summary for Users
        let debugMsg = "";
        if (unknownUsers.size > 0) {
            const sample = Array.from(unknownUsers).slice(0, 5).join(", ");
            debugMsg = ` | Unmatched Users: ${unknownUsers.size} (e.g. ${sample})`;
            Logger.warn(`[Import] Unknown Users (${unknownUsers.size}):`, Array.from(unknownUsers));
        } else {
            debugMsg = " | All users matched.";
        }

        updateJob(jobId, {
            status: 'completed',
            progress: 100,
            itemsProcessed: totalImported + totalEnriched,
            message: `Import Completed. Imported: ${totalImported}. Enriched in place: ${totalEnriched}. Skipped: ${skippedCount} (Duplicates/Invalid/Long). Failed: ${failedCount}.${debugMsg}`
        });

    } catch (err: any) {
        Logger.error("Background Job Failed:", err);
        updateJob(jobId, { status: 'failed', message: err.message || "Unknown Error" });
    }
}
