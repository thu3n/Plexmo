import { NextResponse } from "next/server";
import { normalizePlexUrl } from "@/lib/plex";
import { authorizeApiKeyOrSession, isOwnerLike } from "@/lib/auth-guard";
import { getServerToken } from "@/lib/servers";
import { probePlexServer } from "@/lib/server-probe";
import { parseTestConnectionBody, resolveTestCredentials } from "@/lib/server-connection-test";

const HTTP_BAD_GATEWAY = 502;

export async function POST(request: Request) {
    // Connection probe against an arbitrary URL — restricted to sessions that
    // may add servers (owner/setup/API key, or invited onboarding). Using a
    // STORED token is narrowed further to owners inside resolveTestCredentials.
    const user = await authorizeApiKeyOrSession(request);
    const isOwner = Boolean(user && isOwnerLike(user));
    if (!user || !(isOwner || user.scope.role === "onboarding")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const resolved = await resolveTestCredentials(parseTestConnectionBody(rawBody, normalizePlexUrl), {
        isOwner,
        lookupStoredToken: getServerToken,
    });
    if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const probe = await probePlexServer({ baseUrl: resolved.baseUrl, token: resolved.token });
    if (!probe.ok) {
        return NextResponse.json({ error: probe.message, reason: probe.reason }, { status: HTTP_BAD_GATEWAY });
    }

    return NextResponse.json({
        success: true,
        message: probe.friendlyName ? `Connected to ${probe.friendlyName}` : "Connection successful",
        latencyMs: probe.latencyMs,
        version: probe.version,
    });
}
