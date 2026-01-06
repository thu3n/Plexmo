import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWebhooks } from "@/lib/discord";

export async function GET() {
    try {
        const webhooks = getWebhooks();
        return NextResponse.json({ webhooks });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, url, events } = body;

        if (!name || !url || !Array.isArray(events)) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        const enabled = 1;

        db.prepare(`
            INSERT INTO discord_webhooks (id, name, url, events, enabled, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, name, url, JSON.stringify(events), enabled, createdAt);

        return NextResponse.json({ success: true, id });
    } catch (error) {
        console.error("Failed to create webhook:", error);
        return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
    }
}
