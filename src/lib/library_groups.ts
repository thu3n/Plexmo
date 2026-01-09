
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
    if (!group || !group.libraries) return { items: [], totalCount: 0 };

    // 1. Fetch ALL items from ALL member libraries
    // We fetch basic info + meta_json to do the merging in-memory.
    // Ideally, we'd do this in SQL, but parsing JSON and matching external IDs is complex in SQLite.
    // For large libraries, this might be slow. Optimization: Cache the merged result? 
    // For now, let's fetch necessary columns.

    const placeholders = group.libraries.map(() => '(libraryKey = ? AND serverId = ?)').join(' OR ');
    let params = group.libraries.flatMap(l => [l.library_key, l.server_id]);

    if (!placeholders) return { items: [], totalCount: 0 };

    let query = `
        SELECT ratingKey, libraryKey, serverId, title, year, thumb, type, addedAt, meta_json 
        FROM library_items 
        WHERE (${placeholders})
    `;

    if (search) {
        query += " AND title LIKE ?";
        params.push(`%${search}%`);
    }

    const rows = db.prepare(query).all(...params) as any[];

    // 2. Merge Logic
    const mergedMap = new Map<string, MergedItem>();

    // Fetch Server Details for URL construction
    const servers = db.prepare("SELECT id, baseUrl, token, name FROM servers").all() as any[];
    const serverMap = new Map<string, { id: string, baseUrl: string, token: string }>();
    servers.forEach(s => serverMap.set(s.id, { id: s.id, baseUrl: s.baseUrl, token: s.token }));

    // Helper to generate a fuzzy slug for fallbacks
    const getSlug = (title: string, year?: number) => {
        return `${title.toLowerCase().replace(/[^a-z0-9]/g, '')}-${year || 'xxxx'}`;
    };

    // Tracking which item maps to which MergedItem to handle multi-matches
    // But since we iterate once, we just try to find an existing match.

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
        const serverName = group.libraries.find(l => l.server_id === row.serverId)?.server_name || "Unknown";

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
            // Preference: If existing is missing, use new one. 
            // Or maybe preference for Resolution? 
            if (!match.posterPath && posterPath) match.posterPath = posterPath;

        } else {
            // New Entry
            const newItem: MergedItem = {
                id: row.ratingKey, // Use first ID as the "primary" ID for UI keys
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
        }
    }

    // 3. Convert to Array and Sort
    // We need to deduplicate values() because we stored usage keys multiple times (imdb, tmdb, slug)
    const uniqueItems = Array.from(new Set(mergedMap.values()));

    // Sort by Added At (descending)
    uniqueItems.sort((a, b) => (new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()));

    // 4. Pagination
    const totalCount = uniqueItems.length;
    const items = uniqueItems.slice((page - 1) * pageSize, page * pageSize);

    return { items, totalCount, group: { name: group.name, type: group.type, id: group.id } };
};
