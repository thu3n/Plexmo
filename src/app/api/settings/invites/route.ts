import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-guard";
import { createInvite, listInvites, revokeInvite, type InviteType } from "@/lib/invites";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const INVITE_TYPES: InviteType[] = ["onboarding", "access"];
const MAX_LABEL_LENGTH = 100;
const MAX_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000;

/** Never expose tokenHash — it is not a secret, but nothing needs it either. */
const sanitize = <T extends { tokenHash: string }>(invite: T) => {
    const { tokenHash, ...rest } = invite;
    void tokenHash;
    return rest;
};

export async function GET(req: NextRequest) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
        return NextResponse.json({ invites: listInvites().map(sanitize) });
    } catch (error) {
        Logger.error("Failed to list invites:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const user = await requireOwner(req);
    if (!user) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
        const body = await req.json();
        const type = body.type as InviteType;
        if (!INVITE_TYPES.includes(type)) {
            return NextResponse.json({ error: "Invalid invite type" }, { status: 400 });
        }
        const expiresAt = new Date(body.expiresAt);
        const now = Date.now();
        if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now) {
            return NextResponse.json({ error: "Expiry must be in the future" }, { status: 400 });
        }
        if (expiresAt.getTime() - now > MAX_EXPIRY_MS) {
            return NextResponse.json({ error: "Expiry too far in the future" }, { status: 400 });
        }
        const label = typeof body.label === "string" ? body.label.slice(0, MAX_LABEL_LENGTH) : null;
        const serverIds =
            type === "access" && Array.isArray(body.serverIds) ? body.serverIds.map(String) : null;

        const { invite, rawToken } = createInvite({
            type,
            label,
            expiresAt: expiresAt.toISOString(),
            serverIds,
            createdByAccountId: user.id,
        });

        // The ONLY response that ever carries the raw link — it is not stored.
        return NextResponse.json({
            invite: sanitize(invite),
            inviteUrl: `${req.nextUrl.origin}/invite/${rawToken}`,
        });
    } catch (error) {
        Logger.error("Failed to create invite:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
        const id = req.nextUrl.searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }
        revokeInvite(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        Logger.error("Failed to revoke invite:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
