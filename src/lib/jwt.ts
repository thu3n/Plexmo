
import { SignJWT, jwtVerify } from "jose";

// Read LAZILY at call time: instrumentation.ts resolves the secret at boot
// (env override → persisted file in the config volume) and sets
// process.env.JWT_SECRET. A module-level constant would freeze whatever the
// env held at import time — and used to be inlined at BUILD time via
// next.config's env block, which invalidated every session on each deploy.
const getSecretKey = () => new TextEncoder().encode(process.env.JWT_SECRET!);

// Bumped when the payload contract changes. verifyToken rejects any other
// version, so a bump force-invalidates every outstanding cookie — this is how
// pre-v2 setup-mode tokens (valid 7 days, issued to anyone) were killed.
const TOKEN_VERSION = 2;

// `onboarding` = short-lived session minted by a consumed onboarding invite;
// contained to the connect-your-server wizard surface (onboarding-allowlist.ts)
// and upgraded to `owner` when the invitee adds a server they provably own.
export type SessionRole = "owner" | "viewer" | "setup" | "onboarding";

export type SessionUser = {
    /** plex.tv account id (user_identities.accountId). */
    id: string;
    username: string;
    email: string;
    thumb: string;
    accessToken: string;
    role: SessionRole;
};

type TokenPayload = SessionUser & { ver: number };

export async function createSession(user: SessionUser, expiresIn: string = "7d") {
    const payload: TokenPayload = { ...user, ver: TOKEN_VERSION };
    const token = await new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(getSecretKey());

    return token;
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
    try {
        const { payload } = await jwtVerify(token, getSecretKey());
        const parsed = payload as unknown as TokenPayload;
        if (parsed.ver !== TOKEN_VERSION) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}
