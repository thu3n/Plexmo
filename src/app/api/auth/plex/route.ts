import { NextRequest, NextResponse } from "next/server";
import { createSession, getPlexUser, verifyAccess } from "@/lib/auth";
import { verifyToken, type SessionRole } from "@/lib/jwt";
import { redeemInvite } from "@/lib/invites";
import { allowInviteAttempt, throttleKeyFromRequest } from "@/lib/invite-throttle";
import { Logger } from "@/lib/logger";

const ONBOARDING_SESSION_MAX_AGE_S = 30 * 60;
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7;
const MAX_INVITE_TOKEN_LENGTH = 128;

export async function GET(req: NextRequest) {
    try {
        const clientIdentifier = "plexmo-server";
        // flow=link: a non-strong PIN yields the short plex.tv/link code. Used by
        // the setup wizard's link-code option; the login page uses the normal
        // strong-PIN authUrl flow on all display modes.
        const linkFlow = req.nextUrl.searchParams.get("flow") === "link";

        const headers = {
            "Accept": "application/json",
            "X-Plex-Product": "Plexmo",
            "X-Plex-Client-Identifier": clientIdentifier,
            "X-Plex-Device": "Web",
            "X-Plex-Model": "Plexmo",
        };

        const response = await fetch(
            linkFlow ? "https://plex.tv/api/v2/pins" : "https://plex.tv/api/v2/pins?strong=true",
            { method: "POST", headers },
        );

        if (!response.ok) {
            Logger.error("Plex PIN error", await response.text());
            return NextResponse.json({ error: "Failed to create PIN" }, { status: response.status });
        }

        const data = await response.json();

        if (linkFlow) {
            return NextResponse.json({
                id: data.id,
                code: data.code,
                clientIdentifier,
                flow: "link",
            });
        }

        // Construct the auth URL
        const authUrl = `https://app.plex.tv/auth#?clientID=${clientIdentifier}&code=${data.code}&context[device][product]=Plexmo`;

        return NextResponse.json({
            id: data.id,
            code: data.code,
            authUrl,
            // Clients echo this back when polling — the PIN check must use the
            // same identifier the PIN was created with.
            clientIdentifier,
        });

    } catch (error) {
        Logger.error("GET Auth Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** Issues the session cookie response shared by the normal and invite paths. */
async function sessionResponse(
    req: NextRequest,
    user: Awaited<ReturnType<typeof getPlexUser>>,
    token: string,
    role: SessionRole
) {
    const isOnboarding = role === "onboarding";
    const jwt = await createSession(
        { ...user, accessToken: token, role },
        isOnboarding ? "30m" : "7d"
    );
    const response = NextResponse.json({ success: true, user, role });
    // We trust the protocol of the incoming request: Secure only on real
    // HTTPS, so plain-HTTP LAN deployments keep working.
    response.cookies.set("token", jwt, {
        httpOnly: true,
        secure: req.nextUrl.protocol === "https:",
        maxAge: isOnboarding ? ONBOARDING_SESSION_MAX_AGE_S : SESSION_MAX_AGE_S,
        path: "/",
        sameSite: "lax",
    });
    return response;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { pinId, clientIdentifier, mode, inviteToken } = body;

        if (!pinId) {
            return NextResponse.json({ error: "Missing pinId" }, { status: 400 });
        }

        const clientId = clientIdentifier || "plexmo-server";

        // 2. Check PIN status
        const pinResponse = await fetch(`https://plex.tv/api/v2/pins/${pinId}`, {
            headers: {
                "Accept": "application/json",
                "X-Plex-Client-Identifier": clientId,
            },
        });

        if (!pinResponse.ok) {
            return NextResponse.json({ error: "Failed to check PIN status" }, { status: 500 });
        }

        const pinData = await pinResponse.json();

        if (!pinData.authToken) {
            return NextResponse.json({ error: "PIN not claimed yet", status: "polling" }, { status: 401 });
        }

        const token = pinData.authToken;

        // DISCOVERY MODE: returns the raw Plex token for the server-add
        // forms. Requires an instance-management session (owner, first-run
        // setup, or invited onboarding) — it must not be an anonymous
        // PIN-claim proxy.
        if (mode === "discovery") {
            const cookieToken = req.cookies.get("token")?.value;
            const session = cookieToken ? await verifyToken(cookieToken) : null;
            const allowed = session && ["owner", "setup", "onboarding"].includes(session.role);
            if (!allowed) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            return NextResponse.json({ success: true, token });
        }

        // 3. Verify Ownership or Whitelist
        const access = await verifyAccess(token);

        if (!access.allowed) {
            // Invite redemption: an unknown Plex account carrying a valid
            // one-time invite gets in — 'access' as a persistent viewer,
            // 'onboarding' as a 30-minute contained wizard session. Every
            // failure mode answers with the same 403 (no enumeration).
            const rawInvite =
                typeof inviteToken === "string" &&
                inviteToken.length > 0 &&
                inviteToken.length <= MAX_INVITE_TOKEN_LENGTH
                    ? inviteToken
                    : null;
            if (rawInvite) {
                if (!allowInviteAttempt(throttleKeyFromRequest(req))) {
                    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
                }
                const user = await getPlexUser(token);
                const invite = redeemInvite(rawInvite, user);
                if (invite) {
                    const role: SessionRole = invite.type === "access" ? "viewer" : "onboarding";
                    return sessionResponse(req, user, token, role);
                }
            }
            return NextResponse.json({ error: "Access Denied. You are not an owner of any configured server." }, { status: 403 });
        }

        // 4. Get User Details
        const user = await getPlexUser(token);

        // 5. Create Session (role travels in the token; `setup` tokens are
        // rejected by the guard as soon as the first server exists). An
        // already-allowed user never consumes an invite they happen to carry.
        return sessionResponse(req, user, token, access.role);

    } catch (error) {
        Logger.error("Auth error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
