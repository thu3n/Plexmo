
export type PlexConnection = {
    uri: string;
    local: string | number | boolean;
};

export type PlexResource = {
    name: string;
    product: string;
    productVersion: string;
    platform: string;
    clientIdentifier: string;
    connections: PlexConnection[];
    accessToken: string; // "token" in some contexts, but resource usually has accessToken
    token?: string; // Mapped for convenience
    sourceTitle?: string;
    [key: string]: unknown;
};

export type FlatConnection = {
    id: string; // Unique key for selection
    name: string;
    uri: string;
    token: string;
    isLocal: boolean;
    platform: string;
    productVersion: string;
    resourceIdentifier: string;
};

export const flattenResources = (resources: PlexResource[]): FlatConnection[] => {
    return resources.flatMap((res) => {
        return res.connections.map((conn, idx) => {
            const isLocal = Boolean(Number(conn.local));
            // Create a readable label or just return structured data for the UI to format
            return {
                id: `${res.clientIdentifier}-${idx}`,
                name: res.name,
                uri: conn.uri,
                token: res.token || res.accessToken,
                isLocal,
                platform: res.platform,
                productVersion: res.productVersion,
                resourceIdentifier: res.clientIdentifier,
            };
        });
    });
};
