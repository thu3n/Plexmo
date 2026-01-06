import { db } from "./db";
import { plexFetch, PlexServerConfig, LibrarySection, decodePlexString } from "./plex";
import { XMLParser } from "fast-xml-parser";

// Parser for library responses if needed, though we reuse plexFetch parsing mostly.
const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    processEntities: true,
    parseTagValue: true,
});

const toArray = <T>(value: T | T[] | undefined): T[] => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};

export const syncAllLibraryLists = async (jobId: string) => {
    const { updateJob } = await import("./jobs");
    const { listInternalServers } = await import("./servers");
    const { resolveServer } = await import("./plex");

    try {
        updateJob(jobId, { status: 'running', progress: 0, message: 'Looking for servers...' });

        const servers = await listInternalServers();
        const validServers = servers.filter(s => s.baseUrl && s.token);

        if (validServers.length === 0) {
            updateJob(jobId, { status: 'completed', progress: 100, message: 'No valid servers found.' });
            return;
        }

        updateJob(jobId, { message: `Found ${validServers.length} servers. Refreshing lists...`, progress: 10 });

        let processed = 0;
        for (const dbServer of validServers) {
            const config = resolveServer(dbServer);
            processed++;
            updateJob(jobId, { message: `Scanning ${dbServer.name} (${processed}/${validServers.length})...`, progress: 10 + Math.round((processed / validServers.length) * 80) });

            try {
                await syncLibraries(config);
            } catch (e: any) {
                console.error(`Failed to sync library list for ${dbServer.name}`, e);
            }
        }

        updateJob(jobId, { status: 'completed', progress: 100, message: `Refreshed library lists for ${validServers.length} servers.` });

    } catch (error: any) {
        console.error("Global list sync failed", error);
        updateJob(jobId, { status: 'failed', message: error.message });
    }
};

export const syncAllLibrariesContent = async (jobId: string) => {
    const { updateJob } = await import("./jobs");
    const { listInternalServers } = await import("./servers");
    const { resolveServer } = await import("./plex");

    try {
        updateJob(jobId, { status: 'running', progress: 0, message: 'Looking for servers...' });

        const servers = await listInternalServers();
        // Exclude servers without token or url
        const validServers = servers.filter(s => s.baseUrl && s.token);

        if (validServers.length === 0) {
            updateJob(jobId, { status: 'completed', progress: 100, message: 'No valid servers found.' });
            return;
        }

        updateJob(jobId, { message: `Found ${validServers.length} servers. Fetching libraries...`, progress: 5 });

        // Get all libraries for all servers
        const allLibraries: any[] = [];
        const serverConfigs = new Map();

        // 1. Refresh Library List First (Lightweight)
        for (const dbServer of validServers) {
            const config = resolveServer(dbServer);
            serverConfigs.set(dbServer.id, config);

            try {
                // Ensure we have fresh library list
                const libs = await syncLibraries(config);
                // Add server config to each lib for easy access later
                libs.forEach(l => allLibraries.push({ ...l, serverConfig: config }));
            } catch (e) {
                console.error(`Failed to sync library list for ${dbServer.name}`, e);
            }
        }

        if (allLibraries.length === 0) {
            updateJob(jobId, { status: 'completed', progress: 100, message: 'No libraries found on any server.' });
            return;
        }

        updateJob(jobId, { totalItems: allLibraries.length, message: `Starting sync of ${allLibraries.length} libraries...`, progress: 10 });

        // 2. Sync Content Sequentially (to avoid flooding)
        let processed = 0;
        const total = allLibraries.length;

        for (const lib of allLibraries) {
            const currentProgress = 10 + Math.round((processed / total) * 90);
            updateJob(jobId, {
                progress: currentProgress,
                message: `[${processed + 1}/${total}] Syncing ${lib.title} on ${lib.serverName}...`
            });

            try {
                // Create a sub-task or just run the logic? 
                // Creating a sub-job spams the UI and DB. Let's just run logic but we need to create a dummy job ID or refactor.
                // syncLibraryItems expects a jobId to update progress. 
                // To avoid spamming main job with 0-100% jumps, we should prob refactor syncLibraryItems or pass a "silent" flag or "subJob" handler?
                // The easiest is to just let it update its own progress but that creates message flickering. 
                // Better: Create a temporary job for it? OR refactor syncLibraryItems.
                // Let's create a temporary job but NOT write it to DB? No, `updateJob` writes to DB.
                // Let's refactor syncLibraryItems to accept a callback instead of jobId? Or accept jobId as null?
                // For now, let's create a unique job for each library as "children" jobs? No, user wants ONE button.

                // Hack: We want deep sync. Let's call the logic directly? logic is inside syncLibraryItems.
                // Refactoring is best.

                // Let's assume we spawn a job for each library so the user sees granular progress in the list if they reload?
                // User asked for "one button". "Jobs" tab shows history. A list of 20 jobs is fine if they are "completed".
                // But the user might want "One master job".

                // Let's stick to "One Master Job" that updates its status.
                // We need to refactor syncLibraryItems to allow "reporting to parent job".

                await syncLibraryItems(lib.serverConfig, lib.key, jobId, {
                    parentProgress: currentProgress,
                    stepSize: (90 / total)
                });

            } catch (e) {
                console.error(`Failed content sync for ${lib.title}`, e);
            }
            processed++;
        }

        updateJob(jobId, { status: 'completed', progress: 100, message: `Synced content for ${allLibraries.length} libraries.` });

    } catch (error: any) {
        console.error("Global sync failed", error);
        updateJob(jobId, { status: 'failed', message: error.message });
    }
};

export const syncLibraries = async (server: PlexServerConfig, jobId?: string): Promise<LibrarySection[]> => {
    const { updateJob } = await import("./jobs");
    console.log(`[Libraries] Syncing libraries for server: ${server.name} (${server.id})`);

    if (jobId) {
        updateJob(jobId, { status: 'running', progress: 0, message: 'Fetching library list...' });
    }

    try {
        const xml = (await plexFetch("/library/sections", {}, server)) as any;
        const directories = toArray(xml.MediaContainer?.Directory).filter((d: any) => ['movie', 'show'].includes(d.type));
        const now = new Date().toISOString();

        if (jobId) {
            updateJob(jobId, { totalItems: directories.length, progress: 10, message: `Found ${directories.length} libraries. Saving...` });
        }

        const sections: LibrarySection[] = directories.map((library: any) => ({
            key: library.key,
            title: decodePlexString(library.title) || "Okänt bibliotek",
            type: library.type,
            agent: library.agent,
            count: Number(library.leafCount ?? library.childCount ?? 0),
            refreshing: Boolean(Number(library.refreshing ?? 0)),
            serverId: server.id,
            serverName: server.name,
        }));

        // Upsert into database
        // logic: update count only if meaningful (non-zero) or if we don't have a value. 
        // We will also run a fix-up afterwards to ensure we don't show less than what we have synced.
        const upsertStmt = db.prepare(`
      INSERT INTO libraries (key, title, type, agent, count, refreshing, serverId, serverName, updatedAt)
      VALUES (@key, @title, @type, @agent, @count, @refreshing, @serverId, @serverName, @updatedAt)
      ON CONFLICT(key, serverId) DO UPDATE SET
        title = excluded.title,
        type = excluded.type,
        agent = excluded.agent,
        count = CASE WHEN excluded.count > 0 THEN excluded.count ELSE libraries.count END,
        refreshing = excluded.refreshing,
        serverName = excluded.serverName,
        updatedAt = excluded.updatedAt
    `);

        const transaction = db.transaction((items: LibrarySection[]) => {
            for (const item of items) {
                upsertStmt.run({
                    ...item,
                    type: item.type ?? null,
                    agent: item.agent ?? null,
                    serverName: item.serverName ?? null,
                    refreshing: item.refreshing ? 1 : 0,
                    updatedAt: now,
                });
            }
        });

        transaction(sections);

        // Cleanup: Remove libraries that are not movie or show
        db.prepare(`
            DELETE FROM library_items 
            WHERE serverId = ? 
            AND libraryKey IN (SELECT key FROM libraries WHERE serverId = ? AND type NOT IN ('movie', 'show'))
        `).run(server.id, server.id);

        db.prepare("DELETE FROM libraries WHERE serverId = ? AND type NOT IN ('movie', 'show')").run(server.id);

        // Post-sync fix: Ensure count is at least the number of local items we have synced
        // This handles cases where Plex returns 0 (or fails to return count) but we have data.
        db.prepare(`
            UPDATE libraries 
            SET count = (SELECT COUNT(*) FROM library_items WHERE libraryKey = libraries.key AND serverId = libraries.serverId)
            WHERE serverId = ? 
            AND (SELECT COUNT(*) FROM library_items WHERE libraryKey = libraries.key AND serverId = libraries.serverId) > count
        `).run(server.id);


        // console.log(`[Libraries] Synced ${sections.length} libraries for ${server.name}`);

        if (jobId) {
            updateJob(jobId, { status: 'completed', progress: 100, message: `Synced ${sections.length} libraries` });
        }

        return sections;

    } catch (error: any) {
        console.error(`[Libraries] Failed to sync libraries for ${server.name}:`, error);
        if (jobId) {
            updateJob(jobId, { status: 'failed', message: error.message || 'Failed to sync libraries' });
        }
        // Fallback? Or just throw? If sync fails, we might return empty or old data?
        // Let's return empty array to indicate failure to caller, or rethrow.
        // Rethrowing allows partial failures to be handled by Promise.allSettled at the caller level.
        throw error;
    }
};

export const getLibraries = async (serverId?: string): Promise<LibrarySection[]> => {
    if (serverId) {
        return db.prepare("SELECT * FROM libraries WHERE serverId = ? ORDER BY title ASC").all(serverId) as LibrarySection[];
    }
    return db.prepare("SELECT * FROM libraries ORDER BY serverName ASC, title ASC").all() as LibrarySection[];
};

// Helper for syncAllLibrariesContent
type SyncProgressOptions = {
    parentProgress: number;
    stepSize: number;
};

export const syncLibraryItems = async (server: PlexServerConfig, libraryKey: string, jobId: string, options?: SyncProgressOptions) => {
    const { updateJob } = await import("./jobs");

    console.log(`[LibrarySync] Starting sync for library ${libraryKey} on ${server.name} (Job: ${jobId})`);

    try {
        if (!options) {
            updateJob(jobId, { status: 'running', progress: 0, message: 'Fetching library metadata...' });
        }

        // 1. Get total count first
        const initXml = (await plexFetch(`/library/sections/${libraryKey}/all`, {
            "X-Plex-Container-Start": 0,
            "X-Plex-Container-Size": 0,
            includeLocations: 1,
            includeGuids: 1
        }, server)) as any;

        const totalSize = Number(initXml.MediaContainer?.totalSize ?? 0);
        if (!options) {
            await updateJob(jobId, { totalItems: totalSize, progress: 0, message: `Found ${totalSize} items. Starting sync...` });
        }

        if (totalSize === 0) {
            if (!options) {
                updateJob(jobId, { status: 'completed', progress: 100, message: 'No items to sync.' });
            }
            return;
        }

        // 2. Paged fetching
        const PAGE_SIZE = 50;
        let processed = 0;

        // Prepare statement outside loop
        const insertItem = db.prepare(`
            INSERT INTO library_items (ratingKey, libraryKey, serverId, title, year, thumb, type, addedAt, updatedAt, meta_json)
            VALUES (@ratingKey, @libraryKey, @serverId, @title, @year, @thumb, @type, @addedAt, @updatedAt, @meta_json)
            ON CONFLICT(ratingKey, serverId) DO UPDATE SET
                title = excluded.title,
                year = excluded.year,
                thumb = excluded.thumb,
                type = excluded.type,
                updatedAt = excluded.updatedAt,
                meta_json = excluded.meta_json
        `);

        // Use transaction for batches
        const insertBatch = db.transaction((items: any[]) => {
            for (const item of items) {
                insertItem.run(item);
            }
        });

        // Loop
        while (processed < totalSize) {
            // Check if job cancelled? (Not implemented simple cancellation yet, assuming fire & forget)

            const xml = (await plexFetch(`/library/sections/${libraryKey}/all`, {
                "X-Plex-Container-Start": processed,
                "X-Plex-Container-Size": PAGE_SIZE,
                includeLocations: 1,
                includeGuids: 1
            }, server)) as any;

            const videos = toArray(xml.MediaContainer?.Video ?? xml.MediaContainer?.Directory ?? []);

            const batchData = await Promise.all(videos.map(async (v: any) => {
                let meta = v;
                // If show and missing Location, fetch details
                if (v.type === 'show' && !v.Location && !v.access_token /* heuristic to avoid infinite? */) {
                    try {
                        const { fetchItemMetadata } = await import("./plex");
                        const fullMeta = await fetchItemMetadata(v.ratingKey, server);
                        if (fullMeta) meta = { ...v, ...fullMeta };
                    } catch (e) {
                        console.warn(`Failed to fetch details for ${v.title}`, e);
                    }
                }

                return {
                    ratingKey: v.ratingKey,
                    libraryKey,
                    serverId: server.id,
                    title: decodePlexString(v.title),
                    year: v.year ? Number(v.year) : null,
                    thumb: v.thumb || v.art || v.parentThumb || null,
                    type: v.type,
                    addedAt: v.addedAt ? new Date(Number(v.addedAt) * 1000).toISOString() : null,
                    updatedAt: new Date().toISOString(),
                    meta_json: JSON.stringify(meta)
                };
            }));

            if (batchData.length > 0) {
                insertBatch(batchData);
            }

            processed += batchData.length;

            // Calculate progress
            if (options) {
                // Parent job progress calculation
                // parentProgress is the base, stepSize is the max we can add
                const libraryProgress = (processed / totalSize);
                const globalProgress = Math.round(options.parentProgress + (libraryProgress * options.stepSize));

                // Only update message occasionally to avoid spamming if needed, but for now every batch is fine
                updateJob(jobId, {
                    progress: Math.min(100, globalProgress), // cap at 100
                    // Don't overwrite message fully if you want to keep "Syncing Library X..."
                    // But we can append details
                    //  message: `Syncing... ${processed}/${totalSize}` 
                });
            } else {
                const progress = Math.min(100, Math.round((processed / totalSize) * 100));
                updateJob(jobId, {
                    progress,
                    itemsProcessed: processed,
                    message: `Synced ${processed}/${totalSize} items`
                });
            }

            // Small delay to be nice to Plex?
            // await new Promise(r => setTimeout(r, 100));

            if (batchData.length === 0) break; // Safety break
        }

        // Update library count accurately
        const countResult = db.prepare("SELECT COUNT(*) as count FROM library_items WHERE libraryKey = ?").get(libraryKey) as { count: number };
        db.prepare("UPDATE libraries SET count = ? WHERE key = ? AND serverId = ?").run(countResult.count, libraryKey, server.id);

        if (!options) {
            await updateJob(jobId, { status: 'completed', progress: 100, message: 'Sync completed successfully.' });
        }
        console.log(`[LibrarySync] Job ${jobId} completed part (or full) for library ${libraryKey}. Synced ${countResult.count} items.`);

    } catch (error: any) {
        console.error(`[LibrarySync] Job ${jobId} failed:`, error);
        // If part of a larger job, maybe don't fail the whole job?
        // But throwing here will be caught by parent loop
        if (!options) {
            updateJob(jobId, {
                status: 'failed',
                message: `Failed: ${error.message || error}`
            });
        }
        throw error; // Re-throw to let parent know
    }
};

export const getLibraryItems = async (libraryKey: string, serverId: string) => {
    return db.prepare(`
        SELECT * FROM library_items 
        WHERE libraryKey = ? AND serverId = ? 
        ORDER BY title ASC
        ORDER BY title ASC
    `).all(libraryKey, serverId);
};

export const getLibraryItemsPaginated = async (libraryKey: string, serverId: string, page: number = 1, pageSize: number = 50, search?: string) => {
    const offset = (page - 1) * pageSize;

    let itemsQuery = `
        SELECT * FROM library_items 
        WHERE libraryKey = ? AND serverId = ? 
    `;
    let countQuery = `
        SELECT COUNT(*) as count FROM library_items 
        WHERE libraryKey = ? AND serverId = ?
    `;

    const params: any[] = [libraryKey, serverId];

    if (search) {
        itemsQuery += " AND title LIKE ?";
        countQuery += " AND title LIKE ?";
        params.push(`%${search}%`);
    }

    itemsQuery += " ORDER BY title ASC LIMIT ? OFFSET ?";

    // For items, we need limit/offset params at the end
    const itemsParams = [...params, pageSize, offset];

    const items = db.prepare(itemsQuery).all(...itemsParams);
    const total = db.prepare(countQuery).get(...params) as { count: number };

    return {
        items,
        totalCount: total.count
    };
};
