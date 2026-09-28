import { parser } from "./plex/plex-client";

/**
 * Authenticated reachability probe for a Plex Media Server.
 *
 * Probes the root endpoint (`/`) rather than `/identity`: Plex answers
 * `/identity` without authentication, so a wrong token "passed" the old
 * connection test. The root requires a valid token and also carries the
 * server version/platform, so one request covers both the test and the health
 * card. The token goes in a header, not the query string, to keep it out of
 * proxy/access logs.
 */

export const PROBE_TIMEOUT_MS = 5_000;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

export type ProbeFailureReason = "unauthorized" | "timeout" | "unreachable" | "error";

export type ProbeResult =
    | {
          ok: true;
          latencyMs: number;
          version: string | null;
          platform: string | null;
          friendlyName: string | null;
      }
    | { ok: false; reason: ProbeFailureReason; message: string; latencyMs: number | null };

type RootContainer = {
    MediaContainer?: { version?: unknown; platform?: unknown; friendlyName?: unknown };
};

const asText = (value: unknown): string | null =>
    typeof value === "string" || typeof value === "number" ? String(value) : null;

const describeNetworkError = (error: unknown, baseUrl: string): string => {
    const code = (error as { cause?: { code?: string } })?.cause?.code;
    if (code === "ECONNREFUSED") {
        return `Connection refused by ${baseUrl}. Is Plex running, and is the port (usually :32400) included?`;
    }
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
        return `Could not resolve the host in ${baseUrl}.`;
    }
    if (typeof code === "string" && code.includes("CERT")) {
        return `TLS certificate error for ${baseUrl} (${code}).`;
    }
    return `Could not connect to ${baseUrl}.`;
};

export async function probePlexServer(
    config: { baseUrl: string; token: string },
    timeoutMs: number = PROBE_TIMEOUT_MS
): Promise<ProbeResult> {
    const baseUrl = config.baseUrl.replace(/\/+$/, "");
    let url: URL;
    try {
        url = new URL(`${baseUrl}/`);
    } catch {
        return { ok: false, reason: "error", message: "The server URL is not valid.", latencyMs: null };
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { ok: false, reason: "error", message: "The server URL must use http or https.", latencyMs: null };
    }

    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url.toString(), {
            headers: { Accept: "application/xml", "X-Plex-Token": config.token },
            cache: "no-store",
            signal: controller.signal,
        });
        const latencyMs = Date.now() - started;

        if (response.status === HTTP_UNAUTHORIZED || response.status === HTTP_FORBIDDEN) {
            return {
                ok: false,
                reason: "unauthorized",
                message: "Plex rejected the token (401 Unauthorized). Check that it belongs to this server's owner.",
                latencyMs,
            };
        }
        if (!response.ok) {
            return {
                ok: false,
                reason: "error",
                message: `Plex responded with ${response.status} ${response.statusText}.`.trim(),
                latencyMs,
            };
        }

        const parsed = parser.parse(await response.text()) as RootContainer;
        const container = parsed?.MediaContainer;
        if (!container) {
            return {
                ok: false,
                reason: "error",
                message: "The URL answered, but it does not look like a Plex Media Server.",
                latencyMs,
            };
        }
        return {
            ok: true,
            latencyMs,
            version: asText(container.version),
            platform: asText(container.platform),
            friendlyName: asText(container.friendlyName),
        };
    } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") {
            return {
                ok: false,
                reason: "timeout",
                message: `No response from ${baseUrl} within ${Math.round(timeoutMs / 1000)}s.`,
                latencyMs: null,
            };
        }
        return { ok: false, reason: "unreachable", message: describeNetworkError(error, baseUrl), latencyMs: null };
    } finally {
        clearTimeout(timer);
    }
}
