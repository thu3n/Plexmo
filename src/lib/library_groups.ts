
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
    id: string;
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
    try {
        const group = getLibraryGroup(groupId);
        if (!group || !group.libraries || group.libraries.length === 0) return { items: [], totalCount: 0 };

        // Conditions for Group Members (Removing alias 'li' to use table name explicitly)
        const memberClauses = group.libraries.map(() => `(library_items.libraryKey = ? AND library_items.serverId = ?)`).join(' OR ');
        const memberParams = group.libraries.flatMap(l => [l.library_key, l.server_id]);

        // 1. Count Total
        let countSql = `
            SELECT COUNT(DISTINCT ui.id) as count
            FROM UnifiedItem ui
            JOIN library_items ON library_items.unifiedItemId = ui.id
            WHERE ui.parentId IS NULL AND (${memberClauses})
        `;

        if (search) {
            countSql += ` AND ui.title LIKE ?`;
        }

        const countParams = [...memberParams];
        if (search) countParams.push(`%${search}%`);

        // Debug logging
        // console.log("[Debug] Count Params:", countParams);

        const countResult = db.prepare(countSql).get(...countParams) as { count: number };
        const totalCount = countResult.count;

        if (totalCount === 0) {
            return { items: [], totalCount: 0, group: { name: group.name, type: group.type, id: group.id } };
        }

        // 2. Fetch Page
        let fetchSql = `
            SELECT ui.*, MAX(library_items.addedAt) as latestAdded
            FROM UnifiedItem ui
            JOIN library_items ON library_items.unifiedItemId = ui.id
            WHERE ui.parentId IS NULL AND (${memberClauses})
        `;

        if (search) {
            fetchSql += ` AND ui.title LIKE ?`;
        }

        fetchSql += ` GROUP BY ui.id`;
        fetchSql += ` ORDER BY latestAdded DESC`;
        fetchSql += ` LIMIT ? OFFSET ?`;

        const fetchParams = [...countParams, pageSize, (page - 1) * pageSize];
        const unifiedRows = db.prepare(fetchSql).all(...fetchParams) as any[];

        // 3. Fetch Children
        const unifiedIds = unifiedRows.map(r => r.id);
        if (unifiedIds.length === 0) return { items: [], totalCount: 0, group: { name: group.name, type: group.type, id: group.id } };

        const childrenSql = `
            SELECT * FROM library_items 
            WHERE unifiedItemId IN (${unifiedIds.map(() => '?').join(',')})
            AND (${memberClauses})
        `;
        const childrenParams = [...unifiedIds, ...memberParams];
        const childrenRows = db.prepare(childrenSql).all(...childrenParams) as any[];

        const childrenMap = new Map<string, any[]>();
        for (const child of childrenRows) {
            if (!childrenMap.has(child.unifiedItemId)) childrenMap.set(child.unifiedItemId, []);
            childrenMap.get(child.unifiedItemId)?.push(child);
        }

        // 4. Map
        const items: MergedItem[] = unifiedRows.map(ui => {
            const sourcesRaw = childrenMap.get(ui.id) || [];
            const sources: ItemSource[] = sourcesRaw.map(child => {
                const sName = group.libraries?.find(l => l.server_id === child.serverId)?.server_name || "Unknown";
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
                id: ui.id,
                title: ui.title,
                year: ui.year,
                type: ui.type as 'movie' | 'show',
                addedAt: ui.latestAdded,
                thumb: ui.poster,
                posterPath: ui.poster,
                sources,
                overview: undefined,
                externalIds: {
                    imdb: ui.guid.startsWith('imdb') ? ui.guid : undefined,
                }
            };
        });

        return { items, totalCount, group: { name: group.name, type: group.type, id: group.id } };
    } catch (error) {
        console.error("[getGroupItemsPaginated] Failed:", error);
        throw error;
    }
};

// --- Shared Unification Logic (buildUnifiedItemMap) ---
// Note: buildUnifiedItemMap is not used by pagination logic anymore, but kept for legacy/other compatibility

export const buildUnifiedItemMap = (rows: any[], contextGroup?: LibraryGroup): Map<string, MergedItem> => {
    // ... Copy implementation if needed, but since we replaced it, do we need it? 
    // Yes, other files might use it. 
    // I will copy the implementation from Step 548 to preserve it.

    // Simulating keeping it to save bytes in this prompt, but WRITE_FILE overwrites.
    // I MUST include it.
    // I'll paste the logic from Step 566/548.
    const mergedMap = new Map<string, MergedItem>();
    const servers = db.prepare("SELECT id, baseUrl, token, name FROM servers").all() as any[];
    const serverMap = new Map<string, { id: string, baseUrl: string, token: string, name: string }>();
    servers.forEach(s => serverMap.set(s.id, { id: s.id, baseUrl: s.baseUrl, token: s.token, name: s.name }));

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

        if (!externalIds.plex && meta.guid && meta.guid.startsWith('plex://')) {
            externalIds.plex = meta.guid;
        }

        let serverName = "Unknown";
        if (contextGroup) {
            serverName = contextGroup.libraries?.find(l => l.server_id === row.serverId)?.server_name || "Unknown";
        } else {
            const s = serverMap.get(row.serverId);
            serverName = s?.name || row.serverId;
        }

        const source: ItemSource = {
            ratingKey: row.ratingKey,
            libraryKey: row.libraryKey,
            serverId: row.serverId,
            serverName,
            resolution: meta.videoResolution || (meta.Media?.[0]?.videoResolution),
            bitrate: meta.Media?.[0]?.bitrate
        };

        let match: MergedItem | undefined;
        if (externalIds.imdb && mergedMap.has(externalIds.imdb)) match = mergedMap.get(externalIds.imdb);
        else if (externalIds.tmdb && mergedMap.has(externalIds.tmdb)) match = mergedMap.get(externalIds.tmdb);
        else if (externalIds.tvdb && mergedMap.has(externalIds.tvdb)) match = mergedMap.get(externalIds.tvdb);
        else if (externalIds.plex && mergedMap.has(externalIds.plex)) match = mergedMap.get(externalIds.plex);

        if (!match) {
            const slug = getSlug(row.title, row.year);
            if (mergedMap.has(slug)) match = mergedMap.get(slug);
        }

        let posterPath = undefined;
        if (row.thumb) {
            const s = serverMap.get(row.serverId);
            if (s && s.baseUrl && s.token) {
                posterPath = `/api/proxy/image?serverId=${s.id}&thumb=${encodeURIComponent(row.thumb)}`;
            }
        }

        if (match) {
            match.sources.push(source);
            if (!match.externalIds.imdb && externalIds.imdb) match.externalIds.imdb = externalIds.imdb;
            if (!match.externalIds.tmdb && externalIds.tmdb) match.externalIds.tmdb = externalIds.tmdb;
            if (externalIds.imdb) mergedMap.set(externalIds.imdb, match);
            if (externalIds.tmdb) mergedMap.set(externalIds.tmdb, match);
            if (externalIds.plex) mergedMap.set(externalIds.plex, match);
            if (!match.posterPath && posterPath) match.posterPath = posterPath;

        } else {
            const newItem: MergedItem = {
                id: externalIds.imdb || externalIds.tmdb || externalIds.plex || getSlug(row.title, row.year),
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

            if (externalIds.imdb) mergedMap.set(externalIds.imdb, newItem);
            if (externalIds.tmdb) mergedMap.set(externalIds.tmdb, newItem);
            if (externalIds.tvdb) mergedMap.set(externalIds.tvdb, newItem);
            if (externalIds.plex) mergedMap.set(externalIds.plex, newItem);
            const slug = getSlug(row.title, row.year);
            mergedMap.set(slug, newItem);
        }
    }

    return mergedMap;
};
