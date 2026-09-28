import { NextRequest, NextResponse } from "next/server";
import { listAllowedUsers, addAllowedUser, removeAllowedUser, toAllowedUserView } from "@/lib/access";
import { requireOwner } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_EMAIL_LENGTH = 320;

const isUniqueViolation = (error: unknown): boolean =>
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "SQLITE_CONSTRAINT_UNIQUE";

export async function GET(req: NextRequest) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
        const users = (await listAllowedUsers()).map(toAllowedUserView);
        return NextResponse.json({ users });
    } catch (error) {
        Logger.error("Failed to list allowed users:", error);
        return NextResponse.json({ error: "Failed to fetch allowed users" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
        const body = await req.json();
        const { email, username, removeAfterLogin, expiresAt, serverIds } = body ?? {};

        if (typeof email !== "string" || !email.trim() || email.length > MAX_EMAIL_LENGTH) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }
        if (expiresAt != null && (typeof expiresAt !== "string" || Number.isNaN(new Date(expiresAt).getTime()))) {
            return NextResponse.json({ error: "Invalid expiry" }, { status: 400 });
        }

        // serverIds (optional string array) scopes this viewer to those
        // servers; omitted = sees everything (default policy).
        const scopeIds = Array.isArray(serverIds) ? serverIds.map(String) : null;

        const newUser = await addAllowedUser(
            email,
            typeof username === "string" ? username : undefined,
            removeAfterLogin !== false,
            expiresAt ?? null,
            scopeIds
        );
        return NextResponse.json({ user: toAllowedUserView(newUser) });
    } catch (error) {
        if (isUniqueViolation(error)) {
            return NextResponse.json({ error: "User already exists" }, { status: 409 });
        }
        Logger.error("Failed to add allowed user:", error);
        return NextResponse.json({ error: "Failed to add user" }, { status: 500 });
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

        if (!removeAllowedUser(id)) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        Logger.error("Failed to remove allowed user:", error);
        return NextResponse.json({ error: "Failed to remove user" }, { status: 500 });
    }
}
