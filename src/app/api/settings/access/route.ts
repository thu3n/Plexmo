import { NextRequest, NextResponse } from "next/server";
import { listAllowedUsers, addAllowedUser, removeAllowedUser } from "@/lib/access";

export async function GET() {
    try {
        const users = await listAllowedUsers();
        return NextResponse.json({ users });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch allowed users" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, username, removeAfterLogin, expiresAt } = body;

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const newUser = await addAllowedUser(email, username, removeAfterLogin, expiresAt);
        return NextResponse.json({ user: newUser });
    } catch (error: any) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return NextResponse.json({ error: "User already exists" }, { status: 409 });
        }
        return NextResponse.json({ error: "Failed to add user" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
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
