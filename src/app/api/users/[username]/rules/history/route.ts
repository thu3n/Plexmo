import { NextResponse } from "next/server";
import { getUserRuleHistory } from "@/lib/rules";
import { db } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
    try {
        const { username } = await params;

        // Resolve username to userId
        // Ideally we should use userId in the URL, but the app largely uses usernames in routes.
        // We can look up the user.
        const user = db.prepare("SELECT id FROM users WHERE username = ?").get(decodeURIComponent(username)) as { id: string };

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const history = getUserRuleHistory(user.id);
        return NextResponse.json(history);
    } catch (error) {
        console.error("Failed to fetch user rule history:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
