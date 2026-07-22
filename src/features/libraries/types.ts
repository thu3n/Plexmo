export type Section = {
    serverId: string;
    serverName: string | null;
    sectionKey: string;
    title: string;
    type: string;
    itemCount: number | null;
    updatedAt: string | null;
    episodeCount: number;
};

export type UniqueTitles = { type: string; uniqueCount: number; totalCopies: number };

export type UniqueEpisodes = { uniqueCount: number; totalCopies: number };

export type RecentItem = {
    serverId: string;
    serverName: string | null;
    ratingKey: string;
    title: string;
    year: number | null;
    type: string;
    addedAt: number;
    thumb: string | null;
};

export type LibrariesResponse = {
    sections: Section[];
    uniqueTitles: UniqueTitles[];
    uniqueEpisodes: UniqueEpisodes;
    recentlyAdded: RecentItem[];
};
