/**
 * Turns plex.tv resources (from /api/plex/resources) into a ranked, flat list
 * of connection choices for the "Sign in with Plex" discovery flow.
 *
 * Ranking: local before remote before relay — relayed connections are
 * bandwidth-capped by Plex and add a hop, so they are a last resort — and,
 * within a kind, https before http.
 */

export type ConnectionKind = "local" | "remote" | "relay";

export type DiscoveredResource = {
    name: string;
    clientIdentifier: string;
    platform?: string;
    productVersion?: string;
    token?: string;
    accessToken?: string;
    connections?: {
        uri: string;
        local?: boolean | number | string;
        relay?: boolean | number | string;
        protocol?: string;
    }[];
};

export type DiscoveredConnection = {
    id: string;
    serverName: string;
    resourceId: string;
    uri: string;
    token: string;
    kind: ConnectionKind;
    secure: boolean;
    productVersion: string | null;
    /** Highest-ranked connection of its server — the one we preselect. */
    isBest: boolean;
};

const KIND_RANK: Record<ConnectionKind, number> = { local: 0, remote: 1, relay: 2 };

export const CONNECTION_KIND_LABEL: Record<ConnectionKind, string> = {
    local: "Local",
    remote: "Remote",
    relay: "Relay",
};

/** plex.tv serializes flags as booleans, 0/1 or "0"/"1" depending on endpoint. */
const flag = (value: boolean | number | string | undefined): boolean =>
    value === true || value === 1 || value === "1" || value === "true";

const rankOf = (c: Pick<DiscoveredConnection, "kind" | "secure">): number =>
    KIND_RANK[c.kind] * 2 + (c.secure ? 0 : 1);

export const rankDiscoveredConnections = (resources: DiscoveredResource[]): DiscoveredConnection[] =>
    resources.flatMap((res) => {
        const token = res.token || res.accessToken || "";
        const connections = (res.connections ?? [])
            .filter((conn) => typeof conn.uri === "string" && conn.uri)
            .map((conn, idx): DiscoveredConnection => {
                const kind: ConnectionKind = flag(conn.relay) ? "relay" : flag(conn.local) ? "local" : "remote";
                return {
                    id: `${res.clientIdentifier}-${idx}`,
                    serverName: res.name,
                    resourceId: res.clientIdentifier,
                    uri: conn.uri,
                    token,
                    kind,
                    secure: conn.protocol ? conn.protocol === "https" : conn.uri.startsWith("https:"),
                    productVersion: res.productVersion ?? null,
                    isBest: false,
                };
            })
            .sort((a, b) => rankOf(a) - rankOf(b));
        if (connections.length) connections[0] = { ...connections[0], isBest: true };
        return connections;
    });
