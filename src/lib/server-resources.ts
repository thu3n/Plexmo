import { parser, toArray } from "./plex/plex-client";

/**
 * Host resource usage from Plex's own dashboard feed (`/statistics/resources`,
 * owner token only). Plex samples every few seconds; `timespan=6` asks for the
 * finest granularity and we keep the newest sample. Plex exposes CPU and RAM
 * only — there is no GPU utilisation in its API.
 */

const RESOURCES_TIMEOUT_MS = 5_000;
/** Plex's finest sample interval for the resources feed. */
const RESOURCES_TIMESPAN = 6;

export type ServerResources = {
    serverId: string;
    hostCpu: number | null;
    processCpu: number | null;
    hostMemory: number | null;
    processMemory: number | null;
    at: number | null;
};

type ResourceSample = {
    at?: unknown;
    hostCpuUtilization?: unknown;
    processCpuUtilization?: unknown;
    hostMemoryUtilization?: unknown;
    processMemoryUtilization?: unknown;
};

const asPercent = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
};

/** Newest sample of a parsed resources container; all-null when Plex sent none. */
export function parseResources(serverId: string, parsed: unknown): ServerResources {
    const container = (parsed as { MediaContainer?: { StatisticsResources?: ResourceSample | ResourceSample[] } })
        ?.MediaContainer;
    const samples = toArray(container?.StatisticsResources);
    const latest = samples.reduce<ResourceSample | undefined>(
        (best, s) => (!best || Number(s.at) > Number(best.at) ? s : best),
        undefined,
    );
    return {
        serverId,
        hostCpu: asPercent(latest?.hostCpuUtilization),
        processCpu: asPercent(latest?.processCpuUtilization),
        hostMemory: asPercent(latest?.hostMemoryUtilization),
        processMemory: asPercent(latest?.processMemoryUtilization),
        // Plex reports epoch seconds.
        at: latest?.at !== undefined && Number.isFinite(Number(latest.at)) ? Number(latest.at) * 1000 : null,
    };
}

export async function fetchServerResources(server: { id: string; baseUrl: string; token: string }): Promise<ServerResources> {
    const url = new URL(`${server.baseUrl.replace(/\/+$/, "")}/statistics/resources`);
    url.searchParams.set("timespan", String(RESOURCES_TIMESPAN));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RESOURCES_TIMEOUT_MS);
    try {
        const response = await fetch(url.toString(), {
            headers: { Accept: "application/xml", "X-Plex-Token": server.token },
            cache: "no-store",
            signal: controller.signal,
        });
        if (!response.ok) return parseResources(server.id, null);
        return parseResources(server.id, parser.parse(await response.text()));
    } catch {
        // Offline/slow servers render as "—" instead of failing the whole panel.
        return parseResources(server.id, null);
    } finally {
        clearTimeout(timer);
    }
}
