
import { SignJWT, jwtVerify } from "jose";

// The secret is injected via process.env.JWT_SECRET by next.config.ts
// or standard environment variables.
const SECRET_KEY = new TextEncoder().encode(
    process.env.JWT_SECRET!
);

export type SessionUser = {
    id: string;
    username: string;
    email: string;
    thumb: string;
    accessToken: string;
};

export async function createSession(user: SessionUser) {
    const token = await new SignJWT({ ...user })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d") // 7 days session
        .sign(SECRET_KEY);

    return token;
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
    try {
        const { payload } = await jwtVerify(token, SECRET_KEY);
        // JWT payload has extra standard claims (iat, exp), we cast it to our user type
        return payload as unknown as SessionUser;
    } catch (e) {
        return null;
    }
}
