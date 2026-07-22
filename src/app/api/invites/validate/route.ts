import { NextResponse } from "next/server";
import { findValidInvite } from "@/lib/invites";
import { allowInviteAttempt, throttleKeyFromRequest } from "@/lib/invite-throttle";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_TOKEN_LENGTH = 128;

/**
 * Public invite validation for the /invite/<token> page. Every failure mode
 * (missing, malformed, used, expired) answers with the SAME 404 — anonymous
 * callers get no enumeration signal and no "this used to be valid" oracle.
 * Success reveals only what the wizard needs to render.
 */
export async function POST(request: Request) {
    if (!allowInviteAttempt(throttleKeyFromRequest(request))) {
        return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
    }
    try {
        const body = await request.json().catch(() => null);
        const token = body?.token;
        if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
            return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
        }
        const invite = findValidInvite(token);
        if (!invite) {
            return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
        }
        return NextResponse.json({ type: invite.type, label: invite.label });
    } catch (error) {
        Logger.error("Invite validation failed:", error);
        return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
    }
}
