import { NextRequest, NextResponse } from "next/server";
import { listAllowedUsers, addAllowedUser, removeAllowedUser } from "@/lib/access";
import { requireOwner } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
        const users = await listAllowedUsers();
        return NextResponse.json({ users });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch allowed users" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
        const body = await req.json();
        const { email, username, removeAfterLogin, expiresAt, serverIds } = body;

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        // serverIds (optional string array) scopes this viewer to those
        // servers; omitted = sees everything (default policy).
        const scopeIds = Array.isArray(serverIds) ? serverIds.map(String) : null;

        const newUser = await addAllowedUser(email, username, removeAfterLogin, expiresAt, scopeIds);
        return NextResponse.json({ user: newUser });
    } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return NextResponse.json({ error: "User already exists" }, { status: 409 });
        }
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

        await removeAllowedUser(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to remove user" }, { status: 500 });
    }
}
