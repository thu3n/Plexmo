import { NextResponse } from "next/server";
import { db as plexmoDb } from "@/lib/db";
import { addHistoryEntry } from "@/lib/history";
import { mapTautulliToPlexmo, TautulliFullEntry } from "@/lib/tautulli-mapper";
import { createJob, updateJob } from "@/lib/jobs";

interface TautulliServer {
    id: number;
    name: string;
    identifier: string; // Machine Idenifier
    uri: string;
    address: string;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, apiKey, serverMapping } = body;

        // serverMapping is { [sourceId]: targetPlexmoId }
        if (!url || !apiKey || !serverMapping || Object.keys(serverMapping).length === 0) {
            return NextResponse.json({ error: "Missing URL, API Key, or Server Mapping" }, { status: 400 });
        }

        // Clean URL
        const cleanUrl = url.replace(/\/$/, "");
        const apiUrl = `${cleanUrl}/api/v2`;

        // Create Job (Associated with the FIRST target server for now, or a generic system job if we supported it)
        // For UI purposes, we'll pick the first target ID to associate the job notification with, 
        // or just use 'system' if allowed. We'll stick to first target for now.
        const firstTargetId = Object.values(serverMapping)[0] as string;
        const job = createJob('import_tautulli', firstTargetId);

        // Start background process
        (async () => {
            try {
                updateJob(job.id, { status: 'running', message: 'Connecting to Tautulli...', progress: 0 });

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
                    updateJob(job.id, { status: 'failed', message: `Connection Failed: ${e.message}` });
                    return;
                }

                // Persist Settings
                try {
                    const stmt = plexmoDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
                    stmt.run("TAUTULLI_URL", cleanUrl);
                    stmt.run("TAUTULLI_API_KEY", apiKey);
                } catch (e) {
                    console.warn("Failed to save Tautulli settings", e);
                }

                // 2. Fetch History (PER SERVER)
                const sourceServerIds = Object.keys(serverMapping);
                let totalImported = 0;
                let grandTotalItems = 0;
                let skippedCount = 0;
                let failedCount = 0;
                let cappedCount = 0;
                const serverNames: Record<string, string> = {};

                // ... (Resolving server names code skipped in replacement block, implied same) ...

                // A. Resolve Server Names
                updateJob(job.id, { message: 'Resolving server names...', progress: 1 });
                // ... (existing resolution logic) ...
                try {
                    // Try Fork First
                    const nameRes = await fetch(`${apiUrl}?apikey=${apiKey}&cmd=get_server_names`);
                    if (nameRes.ok) {
                        const nameJson = await nameRes.json();
                        if (nameJson.response?.result === 'success' && Array.isArray(nameJson.response.data)) {
                            nameJson.response.data.forEach((s: any) => {
                                serverNames[s.server_id?.toString()] = s.pms_name;
                            });
                        }
                    }

                    // Try Standard Fallback (augment, don't overwrite if fork succeeded)
                    const infoRes = await fetch(`${apiUrl}?apikey=${apiKey}&cmd=get_servers_info`);
                    if (infoRes.ok) {
                        const infoJson = await infoRes.json();
                        if (infoJson.response?.result === 'success') {
                            const data = infoJson.response.data;
                            const list = Array.isArray(data) ? data : [data];
                            list.forEach((s: any) => {
                                // Standard uses machine_identifier often as key
                                if (s.machine_identifier) serverNames[s.machine_identifier] = s.name;
                                if (s.id) serverNames[s.id.toString()] = s.name;
                            });
                        }
                    }

                } catch (e) {
                    console.warn("Failed to resolve server names", e);
                }


                // B. Pre-fetch Active Sessions (To prevent "ghost" history of ongoing items)
                updateJob(job.id, { message: 'Checking active sessions...', progress: 1 });
                const activeSessionsMap = new Map<string, number>(); // Key: "${user}-${rating_key}", Value: started_timestamp
                try {
                    const actRes = await fetch(`${apiUrl}?apikey=${apiKey}&cmd=get_activity`);
                    if (actRes.ok) {
                        const actJson = await actRes.json();
                        if (actJson.response?.result === 'success') {
                            const sessions = actJson.response.data.sessions || [];
                            sessions.forEach((s: any) => {
                                // We use a composite key of User + RatingKey. 
                                // Matches what we see in history import.
                                if (s.user && s.rating_key) {
                                    const key = `${s.user}-${s.rating_key}`;
                                    // Tautulli fields for start time can vary: 'started', 'start_time', or 'date' (all usually seconds)
                                    // We need to ensure we parse it as a number.
                                    const rawStart = s.started || s.start_time || s.date || 0;
                                    const startTs = parseInt(String(rawStart), 10);
                                    activeSessionsMap.set(key, startTs);
                                }
                            });
                            console.log(`[Import] Found ${activeSessionsMap.size} active sessions to cross-reference.`);
                            if (activeSessionsMap.size > 0) {
                                console.log(`[Import] Active Session Sample Keys: ${Array.from(activeSessionsMap.keys()).slice(0, 3).join(', ')}`);
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Failed to fetch active sessions", e);
                }

                // C. Pre-fetch Counts
                updateJob(job.id, { message: 'Calculating total items...', progress: 2 });
                const serverCounts: Record<string, number> = {};

                for (const sourceId of sourceServerIds) {
                    const baseServerUrl = `${apiUrl}?apikey=${apiKey}&cmd=get_history&server_id=${sourceId}`;
                    try {
                        const initRes = await fetch(`${baseServerUrl}&length=1&start=0`);
                        const initJson = await initRes.json();
                        if (initJson.response?.result === 'success') {
                            const count = initJson.response.data.recordsFiltered || 0;
                            serverCounts[sourceId] = count;
                            grandTotalItems += count;
                        }
                    } catch (e) {
                        console.error(`Failed to get count for ${sourceId}`, e);
                    }
                }

                updateJob(job.id, { totalItems: grandTotalItems, message: `Starting import of ${grandTotalItems} items...`, progress: 5 });

                const globalStartTime = Date.now();

                for (const [sourceId, targetId] of Object.entries(serverMapping)) {
                    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
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
                        updateJob(job.id, { message: `Importing ${serverName}...` });

                        // PREPARE STATEMENTS ONCE PER SERVER (or even globally, but per server is fine)
                        // This prevents re-compiling SQL 2000 times per batch
                        const checkHistoryDup = plexmoDb.prepare(`
                            SELECT 1 FROM activity_history 
                            WHERE user = ? AND ratingKey = ? 
                            AND startTime >= ? AND startTime <= ?
                            LIMIT 1
                        `);

                        const checkActiveDup = plexmoDb.prepare(`
                            SELECT 1 FROM active_sessions 
                            WHERE user = ? AND ratingKey = ? 
                            AND startTime >= ? AND startTime <= ?
                            LIMIT 1
                        `);

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
                                        console.log(`[Perf] Starting Fetch Batch: ${start} (Size: ${actualBatchSize}) for ${serverName} at ${new Date().toISOString()}`);
                                        console.time(`[Perf] Fetch Batch ${start}`);
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
                                            console.warn(`Hit 400 Bad Request at offset ${start} (len ${actualBatchSize}). Reducing base batch to 200.`);
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
                                        console.timeEnd(`[Perf] Fetch Batch ${start}`);
                                        console.log(`[Perf] Fetch Success for ${serverName} at ${start}. Processing...`);
                                        break;
                                    } else {
                                        throw new Error(histJson?.response?.message || "API Error: No Success Result");
                                    }
                                } catch (e: any) {
                                    const errString = String(e);
                                    const isNetworkError = errString.includes("ECONNRESET") || errString.includes("ETIMEDOUT") || errString.includes("AbortError") || errString.includes("fetch failed");

                                    // Strict Network Error Handling: Reduce Batch Size immediately
                                    if (isNetworkError && currentBatchSize > 200) {
                                        console.warn(`Network Instability (${e.message}) at offset ${start}. Reducing batch size to 200 and retrying.`);
                                        currentBatchSize = 200;
                                        fetchSuccess = false;
                                        break; // Break retry loop to restart 'while' loop with new smaller batch size
                                    }

                                    // Turbo Mode: fixed 100ms delay for retries
                                    const delay = isNetworkError ? 1000 : 100; // Wait longer for network issues
                                    const errorMsg = `Batch attempt ${attempt}/10 failed for ${serverName} at ${start} (batch size ${currentBatchSize}): ${e.message}`;
                                    console.warn(errorMsg);

                                    if (attempt > 2) {
                                        updateJob(job.id, { message: `Warning: ${errorMsg}. Retrying...` });
                                    }

                                    if (attempt < 10) await new Promise(r => setTimeout(r, delay));
                                }
                            }

                            // Let's rely on the fact that if we hit 400, we WANT to retry.
                            // If we hit 400 we changed currentBatchSize.

                            // Correct Logic:
                            // We need to check if we should skip or retry.
                            // If fetchSuccess is true -> Process.
                            // If fetchSuccess is false ->
                            //    Did failure happen because of 400 (downsize)? -> Retry (continue)
                            //    Did failure happen after 10 retries? -> Skip (start += batch, continue)

                            if (!fetchSuccess) {
                                // If we are here, we either exhausted retries OR we broke early due to 400.
                                // If we broke early due to 400, currentBatchSize IS 200.
                                // But what if we were ALREADY at 200 and failed? Then we threw error and exhausted retries.
                                // So: If we are at 200, AND the loop broke early... how to know it broke early?
                                // We can use a flag. Let's add 'retryingWithSmallerBatch' flag above.
                                // Actually, simpler:
                                // If actualBatchSize > currentBatchSize, it means we JUST reduced it!
                                if (actualBatchSize > currentBatchSize) {
                                    // We reduced it this iteration. Retry immediately.
                                    continue;
                                }

                                const failMsg = `CRITICAL: Failed to fetch batch at ${start} for ${serverName} after 10 retries (batch size ${currentBatchSize}). Skipping batch.`;
                                console.error(failMsg);
                                updateJob(job.id, { message: failMsg });

                                // SKIP this batch, but continue importing the rest!
                                start += currentBatchSize;
                                continue;
                            }

                            const records = histJson.response?.data?.data;

                            if (!records || !Array.isArray(records) || records.length === 0) {
                                keepFetchingServer = false;
                                break;
                            }


                            // Process Batch in Transaction
                            console.time(`[Perf] Transaction Batch ${start}`);
                            const processBatch = plexmoDb.transaction((entries: any[]) => {
                                for (const row of entries) {
                                    try {
                                        // Skip entries with no stopped time (ongoing/incomplete)
                                        if (!row.stopped) {
                                            skippedCount++;
                                            serverItemsProcessed++;
                                            continue;
                                        }

                                        // Strict Duplicate Check
                                        const startTimeMs = row.date * 1000;
                                        const bufferMs = 60 * 1000;

                                        const historyDup = checkHistoryDup.get(row.user, String(row.rating_key), startTimeMs - bufferMs, startTimeMs + bufferMs);

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
                                                // Log it only if verbose, or just count it
                                                // console.log(`Skipping Active Duplicate: ${row.user} - ${row.title} (Stopped ${historyStopped} > Active ${activeStarted})`);
                                                skippedCount++;
                                                serverItemsProcessed++;
                                                continue;
                                            }
                                        }

                                        const activeDup = checkActiveDup.get(row.user, String(row.rating_key), startTimeMs - bufferMs, startTimeMs + bufferMs);

                                        if (activeDup) {
                                            skippedCount++;
                                            serverItemsProcessed++;
                                            continue;
                                        }

                                        const compatibleEntry: any = {
                                            ...row,
                                            id: row.row_id || row.id,
                                            reference_id: row.reference_id,
                                            server_id: parseInt(sourceId),
                                            started: row.date,
                                            stopped: row.stopped || (row.date + row.duration) || 0,
                                            duration: row.duration * 1000,
                                            title: row.title,
                                            parent_title: row.parent_title,
                                            grandparent_title: row.grandparent_title,
                                            year: row.year,
                                            media_type: row.media_type,
                                            thumb: row.thumb,
                                            parent_thumb: row.parent_thumb,
                                            grandparent_thumb: row.grandparent_thumb,
                                            player: row.player,
                                            user: row.user,
                                            ip_address: row.ip_address,
                                            platform: row.platform,
                                            transcode_decision: row.transcode_decision,
                                        };

                                        if (!compatibleEntry.stopped && compatibleEntry.started && row.duration) {
                                            compatibleEntry.stopped = compatibleEntry.started + row.duration;
                                        }

                                        const rawDuration = compatibleEntry.stopped - compatibleEntry.started;
                                        if (rawDuration > 86400) {
                                            skippedCount++;
                                            serverItemsProcessed++;
                                            continue;
                                        }

                                        const singleEntryMap: Record<number, string> = {
                                            [parseInt(String(sourceId))]: String(targetId)
                                        };
                                        const mapped = mapTautulliToPlexmo(compatibleEntry, singleEntryMap);
                                        addHistoryEntry(mapped);
                                        totalImported++;
                                        serverItemsProcessed++;

                                    } catch (err: any) {
                                        skippedCount++;
                                        serverItemsProcessed++; // Count as processed even if skipped due to error
                                    }
                                }
                            });

                            processBatch(records);
                            console.timeEnd(`[Perf] Transaction Batch ${start}`);
                            console.log(`[Perf] Batch Complete: ${start} at ${new Date().toISOString()}`);

                            // IMPORTANT FIX: use currentBatchSize instead of length
                            start += currentBatchSize;

                            // Fix Progress: Include skipped items in the "processed" count
                            const realProcessed = totalImported + skippedCount;
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

                            updateJob(job.id, {
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
                            console.warn(`Server ${serverName}: Expected ${serverTotal}, processed ${serverItemsProcessed}. Added ${unprocessed} to failed count.`);
                        }

                    } catch (err: any) {
                        console.error(`Error importing server ${sourceId}`, err);
                        const unprocessed = serverTotal - (serverItemsProcessed || 0);
                        if (unprocessed > 0) {
                            failedCount += unprocessed;
                        }
                    }
                }

                updateJob(job.id, {
                    status: 'completed',
                    progress: 100,
                    itemsProcessed: totalImported,
                    message: `Import Completed. Imported: ${totalImported}. Skipped: ${skippedCount} (Duplicates/Invalid/Long). Failed: ${failedCount}.`
                });

            } catch (err: any) {
                console.error("Background Job Failed:", err);
                updateJob(job.id, { status: 'failed', message: err.message || "Unknown Error" });
            }
        })();

        return NextResponse.json({ success: true, jobId: job.id });

    } catch (error: any) {
        console.error("Tautulli API Import Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
