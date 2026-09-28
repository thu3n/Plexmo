import { Logger } from "./logger";
import { isNewerVersion, parseSemver } from "./semver";

/**
 * Server-side "is there a newer release?" check against the public GitHub
 * releases API. Runs server-side so the browser never talks to GitHub and one
 * cached answer serves every viewer; unauthenticated GitHub calls are limited
 * to 60/hour per IP, hence the long cache.
 */

export const UPDATE_CHECK_CACHE_MS = 6 * 60 * 60 * 1000;
/** Failures retry sooner than successes, but not on every page view. */
export const UPDATE_CHECK_FAILURE_CACHE_MS = 30 * 60 * 1000;
export const UPDATE_CHECK_TIMEOUT_MS = 5000;

const GITHUB_API_BASE = "https://api.github.com/repos";
const GITHUB_WEB_PREFIX = "https://github.com/";

export type LatestRelease = { version: string; url: string; publishedAt: string | null };

export type UpdateStatus =
    | { status: "available"; latest: LatestRelease; checkedAt: string }
    | { status: "current"; latest: LatestRelease; checkedAt: string }
    | { status: "unknown"; checkedAt: string };

type CacheEntry = { repo: string; release: LatestRelease | null; fetchedAt: number };

const cacheGlobal = globalThis as typeof globalThis & { __plexmo_update_check?: CacheEntry };

/** "https://github.com/owner/repo(.git)" → "owner/repo"; null for anything else. */
export const repoSlugFromUrl = (url: string): string | null => {
    const m = /^(?:git\+)?https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(url.trim());
    return m ? `${m[1]}/${m[2]}` : null;
};

/** Validates the untrusted GitHub payload down to the three fields we use. */
export const parseReleasePayload = (payload: unknown): LatestRelease | null => {
    if (!payload || typeof payload !== "object") return null;
    const { tag_name, html_url, published_at } = payload as Record<string, unknown>;
    if (typeof tag_name !== "string" || !parseSemver(tag_name)) return null;
    if (typeof html_url !== "string" || !html_url.startsWith(GITHUB_WEB_PREFIX)) return null;
    return {
        version: tag_name.replace(/^v/, ""),
        url: html_url,
        publishedAt: typeof published_at === "string" ? published_at : null,
    };
};

const fetchLatestRelease = async (repo: string): Promise<LatestRelease | null> => {
    try {
        const res = await fetch(`${GITHUB_API_BASE}/${repo}/releases/latest`, {
            headers: { Accept: "application/vnd.github+json", "User-Agent": "plexmo-update-check" },
            signal: AbortSignal.timeout(UPDATE_CHECK_TIMEOUT_MS),
            cache: "no-store",
        });
        if (!res.ok) {
            Logger.warn(`[UpdateCheck] GitHub responded ${res.status} for ${repo}`);
            return null;
        }
        return parseReleasePayload(await res.json());
    } catch (e) {
        Logger.warn(`[UpdateCheck] Could not reach GitHub: ${e instanceof Error ? e.message : String(e)}`);
        return null;
    }
};

export const getUpdateStatus = async (currentVersion: string, repo: string): Promise<UpdateStatus> => {
    const now = Date.now();
    let entry = cacheGlobal.__plexmo_update_check;
    const ttl = entry?.release ? UPDATE_CHECK_CACHE_MS : UPDATE_CHECK_FAILURE_CACHE_MS;
    if (!entry || entry.repo !== repo || now - entry.fetchedAt >= ttl) {
        entry = { repo, release: await fetchLatestRelease(repo), fetchedAt: now };
        cacheGlobal.__plexmo_update_check = entry;
    }

    const checkedAt = new Date(entry.fetchedAt).toISOString();
    if (!entry.release) return { status: "unknown", checkedAt };
    return {
        status: isNewerVersion(entry.release.version, currentVersion) ? "available" : "current",
        latest: entry.release,
        checkedAt,
    };
};
