
import { db } from "./db";
import { randomUUID } from "node:crypto";
import { LibrarySection, decodePlexString } from "./plex";

export type LibraryGroup = {
    id: string;
    name: string;
    type: 'movie' | 'show';
    createdAt: string;
    libraries?: LibraryGroupMember[];
};

export type LibraryGroupMember = {
    group_id: string;
    library_key: string;
    server_id: string;
    server_name: string;
};

export type MergedItem = {
    id: string; // The ID of the "primary" item (best quality or first found)
    title: string;
    year?: number;
    duration?: number;
    thumb?: string;
    type: 'movie' | 'show';
    addedAt: string;
    sources: ItemSource[];
    overview?: string;
    externalIds: {
        imdb?: string;
        tmdb?: string;
        tvdb?: string;
        plex?: string;
    };
    posterPath?: string;
};

export type ItemSource = {
    ratingKey: string;
    libraryKey: string;
    serverId: string;
    serverName: string;
    resolution?: string;
    bitrate?: number;
    filePath?: string;
};

// --- External Metadata Helper ---
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const fetchTmdbMetadata = async (tmdbId: string) => {
    if (!TMDB_API_KEY) return null;
    try {
        const id = tmdbId.replace('tmdb://', '');
        const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}`);
        if (!res.ok) return null;
        const data = await res.json();
        return {
            poster_path: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
            backdrop_path: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : null,
            overview: data.overview
        };
    } catch (e) {
        console.error(`Failed to fetch TMDB ${tmdbId}`, e);
        return null;
    }
};

// --- CRUD Operations ---

export const getLibraryGroups = (): LibraryGroup[] => {
    const groups = db.prepare("SELECT * FROM library_groups ORDER BY name ASC").all() as LibraryGroup[];
    const members = db.prepare("SELECT * FROM library_group_members").all() as LibraryGroupMember[];

    return groups.map(g => ({
        ...g,
        libraries: members.filter(m => m.group_id === g.id)
    }));
};

export const getLibraryGroup = (id: string): LibraryGroup | undefined => {
    const group = db.prepare("SELECT * FROM library_groups WHERE id = ?").get(id) as LibraryGroup;
    if (!group) return undefined;
    const members = db.prepare("SELECT * FROM library_group_members WHERE group_id = ?").all(id) as LibraryGroupMember[];
    return { ...group, libraries: members };
};

export const createLibraryGroup = (name: string, type: 'movie' | 'show', libraries: { key: string, serverId: string, serverName: string }[]) => {
    const id = randomUUID();
    const now = new Date().toISOString();

    const insertGroup = db.prepare("INSERT INTO library_groups (id, name, type, createdAt) VALUES (?, ?, ?, ?)");
    const insertMember = db.prepare("INSERT INTO library_group_members (group_id, library_key, server_id, server_name) VALUES (?, ?, ?, ?)");

    const transaction = db.transaction(() => {
        insertGroup.run(id, name, type, now);
        for (const lib of libraries) {
            insertMember.run(id, lib.key, lib.serverId, lib.serverName);
        }
    });

    transaction();
    return getLibraryGroup(id);
};

export const deleteLibraryGroup = (id: string) => {
    db.prepare("DELETE FROM library_groups WHERE id = ?").run(id);
};

export const updateLibraryGroup = (id: string, name: string, libraries: { key: string, serverId: string, serverName: string }[]) => {
    const updateGroup = db.prepare("UPDATE library_groups SET name = ? WHERE id = ?");
    const deleteMembers = db.prepare("DELETE FROM library_group_members WHERE group_id = ?");
    const insertMember = db.prepare("INSERT INTO library_group_members (group_id, library_key, server_id, server_name) VALUES (?, ?, ?, ?)");

    const transaction = db.transaction(() => {
        updateGroup.run(name, id);
        deleteMembers.run(id);
        for (const lib of libraries) {
            insertMember.run(id, lib.key, lib.serverId, lib.serverName);
        }
    });

    transaction();
    return getLibraryGroup(id);
};

// --- Aggregation Logic ---

export const getGroupItemsPaginated = (groupId: string, page: number = 1, pageSize: number = 50, search?: string) => {
    const group = getLibraryGroup(groupId);
    if (!group || !group.libraries || group.libraries.length === 0) return { items: [], totalCount: 0 };

    // Conditions for Group Members
    // (serverId = '...' AND libraryKey = '...') OR ...
    const memberClauses = group.libraries.map(() => `(li.libraryKey = ? AND li.serverId = ?)`).join(' OR ');
    const memberParams = group.libraries.flatMap(l => [l.library_key, l.server_id]);

    // 1. Count Total (Distinct Unified Items satisfying the group)
    let countSql = `
        SELECT COUNT(DISTINCT ui.id) as count
        FROM UnifiedItem ui
        JOIN library_items li ON li.unifiedItemId = ui.id
        WHERE ui.parentId IS NULL AND (${memberClauses})
    `;

    // Search Filter
    if (search) {
        countSql += ` AND ui.title LIKE ?`;
    }

    const countParams = [...memberParams];
    if (search) countParams.push(`%${search}%`);

    const countResult = db.prepare(countSql).get(...countParams) as { count: number };
    const totalCount = countResult.count;

    if (totalCount === 0) {
        return { items: [], totalCount: 0, group: { name: group.name, type: group.type, id: group.id } };
    }

    // 2. Fetch Page of Unified Items (Sorted by Max AddedAt)
    // We group by UnifiedItem to sort by the 'latest' added item within this group.

    let fetchSql = `
        SELECT ui.*, MAX(li.addedAt) as latestAdded
        FROM UnifiedItem ui
        JOIN library_items li ON li.unifiedItemId = ui.id
        WHERE ui.parentId IS NULL AND (${memberClauses})
    `;

    if (search) {
        fetchSql += ` AND ui.title LIKE ?`;
    }

    fetchSql += ` GROUP BY ui.id`;
    fetchSql += ` ORDER BY latestAdded DESC`; // Sort by most recently added
    fetchSql += ` LIMIT ? OFFSET ?`;

    const fetchParams = [...countParams, pageSize, (page - 1) * pageSize];
    const unifiedRows = db.prepare(fetchSql).all(...fetchParams) as any[];

    // 3. Fetch Sources (Children Library Items) for these Unified Items
    // We only fetch children that belong to the requested group?
    // OR do we show all sources even if some are outside the group?
    // Usually, consistent behavior implies showing what's in the group.
    // However, if I see "Movie X" and it's also on Server C (which is not in this group), maybe I want to know?
    // But sticking to "Group View" usually means checking what's IN the group.
    // The previous implementation used `buildUnifiedItemMap(rows, group)`, where `rows` were filtered to the group.
    // So distinct behavior was: Show only sources in the group.

    const unifiedIds = unifiedRows.map(r => r.id);
    if (unifiedIds.length === 0) return { items: [], totalCount: 0, group: { name: group.name, type: group.type, id: group.id } };

    const childrenSql = `
        SELECT * FROM library_items 
        WHERE unifiedItemId IN (${unifiedIds.map(() => '?').join(',')})
        AND (${memberClauses})
    `;
    const childrenParams = [...unifiedIds, ...memberParams];
    const childrenRows = db.prepare(childrenSql).all(...childrenParams) as any[];

    // Map children by unifiedItemId
    const childrenMap = new Map<string, any[]>();
    for (const child of childrenRows) {
        if (!childrenMap.has(child.unifiedItemId)) childrenMap.set(child.unifiedItemId, []);
        childrenMap.get(child.unifiedItemId)?.push(child);
    }

    // 4. Transform to MergedItem
    const items: MergedItem[] = unifiedRows.map(ui => {
        const sourcesRaw = childrenMap.get(ui.id) || [];

        const sources: ItemSource[] = sourcesRaw.map(child => {
            // Retrieve Server Name locally or from helper? 
            // We can find it in group.libraries
            const sName = group.libraries?.find(l => l.server_id === child.serverId)?.server_name || "Unknown";

            // Meta parse for resolution
            let resolution = undefined;
            let bitrate = undefined;
            try {
                const m = JSON.parse(child.meta_json || '{}');
                resolution = m.videoResolution || (m.Media?.[0]?.videoResolution);
                bitrate = m.Media?.[0]?.bitrate;
            } catch (e) { }

            return {
                ratingKey: child.ratingKey,
                libraryKey: child.libraryKey,
                serverId: child.serverId,
                serverName: sName,
                resolution,
                bitrate
            };
        });

        return {
            id: ui.id, // Using Unified UUID now! Before it was GUID/Slug. This might break keys if relied upon? 
            // Frontend usually uses ID for key. UUID is fine.
            title: ui.title,
            year: ui.year,
            type: ui.type as 'movie' | 'show',
            addedAt: ui.latestAdded, // Use the max date we found
            thumb: ui.poster, // Unified Poster
            posterPath: ui.poster ? `/api/proxy/image?serverId=unified&thumb=${encodeURIComponent(ui.poster)}` : undefined,
            // Note: Proxy needs to handle 'unified' serverId or we use a raw URL if it's external?
            // Wait, ui.poster is usually a path from one of the items or an external URL. 
            // If it came from our previous migration, it's a `/library/metadata/...` path or a URL.
            // If it is a Plex path, we need a real Server ID to proxy it.
            // Problem: UnifiedItem stores 'poster' string. 
            // If we used `merged.posterPath` in migration, it was `/api/proxy/image...` already?
            // Let's check verification output or migration logic.
            // Migration script used `merged.posterPath`. 
            // `buildUnifiedItemMap` sets `posterPath` to `/api/proxy/image?serverId=...`.
            // So DB stores the full proxy URL. 
            // So we can just use `ui.poster` as `posterPath`.

            sources,
            overview: undefined, // We didn't store overview in UnifiedItem yet.
            externalIds: {
                imdb: ui.guid.startsWith('imdb') ? ui.guid : undefined,
                // We stored "GUID" as the main ID. But we didn't store ALL external IDs in UnifiedItem.
                // We rely on children for deep metadata if needed.
                // For list view, this is sufficient.
            }
        };
    });

    return { items, totalCount, group: { name: group.name, type: group.type, id: group.id } };
};

// --- Shared Unification Logic ---

export const buildUnifiedItemMap = (rows: any[], contextGroup?: LibraryGroup): Map<string, MergedItem> => {
    const mergedMap = new Map<string, MergedItem>();

    // Fetch Server Details for URL construction
    const servers = db.prepare("SELECT id, baseUrl, token, name FROM servers").all() as any[];
    const serverMap = new Map<string, { id: string, baseUrl: string, token: string, name: string }>();
    servers.forEach(s => serverMap.set(s.id, { id: s.id, baseUrl: s.baseUrl, token: s.token, name: s.name }));

    // Helper to generate a fuzzy slug for fallbacks
    const getSlug = (title: string, year?: number) => {
        return `${title.toLowerCase().replace(/[^a-z0-9]/g, '')}-${year || 'xxxx'}`;
    };

    for (const row of rows) {
        let meta: any = {};
        try { meta = JSON.parse(row.meta_json || '{}'); } catch (e) { }

        const guids = Array.isArray(meta.Guid) ? meta.Guid : (meta.Guid ? [meta.Guid] : []);
        const externalIds: any = {};

        guids.forEach((g: any) => {
            if (g.id?.startsWith('imdb://')) externalIds.imdb = g.id;
            if (g.id?.startsWith('tmdb://')) externalIds.tmdb = g.id;
            if (g.id?.startsWith('tvdb://')) externalIds.tvdb = g.id;
            if (g.id?.startsWith('plex://')) externalIds.plex = g.id;
        });

        // Fail-safe: Use top-level guid if it is a plex:// URI
        if (!externalIds.plex && meta.guid && meta.guid.startsWith('plex://')) {
            externalIds.plex = meta.guid;
        }

        // Resolve Server Name
        let serverName = "Unknown";
        if (contextGroup) {
            serverName = contextGroup.libraries?.find(l => l.server_id === row.serverId)?.server_name || "Unknown";
        } else {
            // Try to resolve from row (if we joined) or just ID
            const s = serverMap.get(row.serverId);
            serverName = s?.name || row.serverId; // Fallback
            // NOTE: if 'row' has serverName property (joined), usage might be better. 
            // But for raw library_items scan, we might not have it unless joined.
        }

        // Source Object
        const source: ItemSource = {
            ratingKey: row.ratingKey,
            libraryKey: row.libraryKey,
            serverId: row.serverId,
            serverName,
            resolution: meta.videoResolution || (meta.Media?.[0]?.videoResolution),
            bitrate: meta.Media?.[0]?.bitrate
        };

        // Attempt to find existing match
        let match: MergedItem | undefined;

        // A. Match by External ID
        if (externalIds.imdb && mergedMap.has(externalIds.imdb)) match = mergedMap.get(externalIds.imdb);
        else if (externalIds.tmdb && mergedMap.has(externalIds.tmdb)) match = mergedMap.get(externalIds.tmdb);
        else if (externalIds.tvdb && mergedMap.has(externalIds.tvdb)) match = mergedMap.get(externalIds.tvdb);
        else if (externalIds.plex && mergedMap.has(externalIds.plex)) match = mergedMap.get(externalIds.plex);

        // B. Fallback: Match by Title + Year
        if (!match) {
            const slug = getSlug(row.title, row.year);
            if (mergedMap.has(slug)) match = mergedMap.get(slug);
        }

        // Generate Poster URL from this server
        let posterPath = undefined;
        if (row.thumb) {
            const s = serverMap.get(row.serverId);
            if (s && s.baseUrl && s.token) {
                // Use absolute path /api/proxy/image...
                posterPath = `/api/proxy/image?serverId=${s.id}&thumb=${encodeURIComponent(row.thumb)}`;
            }
        }

        if (match) {
            // Add source to existing
            match.sources.push(source);

            // Should we update IDs if the new item has them and existing didn't?
            if (!match.externalIds.imdb && externalIds.imdb) match.externalIds.imdb = externalIds.imdb;
            if (!match.externalIds.tmdb && externalIds.tmdb) match.externalIds.tmdb = externalIds.tmdb;

            // Re-map with new IDs if possible to improve future matches
            if (externalIds.imdb) mergedMap.set(externalIds.imdb, match);
            if (externalIds.tmdb) mergedMap.set(externalIds.tmdb, match);
            if (externalIds.plex) mergedMap.set(externalIds.plex, match);

            // Update poster if null and we found one
            if (!match.posterPath && posterPath) match.posterPath = posterPath;

        } else {
            // New Entry
            const newItem: MergedItem = {
                id: externalIds.imdb || externalIds.tmdb || externalIds.plex || getSlug(row.title, row.year), // Unified ID Preference
                title: row.title,
                year: row.year,
                duration: meta.duration,
                thumb: row.thumb,
                type: row.type,
                addedAt: row.addedAt,
                sources: [source],
                overview: meta.summary,
                externalIds,
                posterPath
            };

            // Register in map
            if (externalIds.imdb) mergedMap.set(externalIds.imdb, newItem);
            if (externalIds.tmdb) mergedMap.set(externalIds.tmdb, newItem);
            if (externalIds.tvdb) mergedMap.set(externalIds.tvdb, newItem);
            if (externalIds.plex) mergedMap.set(externalIds.plex, newItem);

            // Always register slug
            const slug = getSlug(row.title, row.year);
            mergedMap.set(slug, newItem);
            // Also register by internal ID just in case we need to look it up by exact source later?
            // Not for now.
        }
    }

    return mergedMap;
};
