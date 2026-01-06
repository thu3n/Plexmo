import { NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Props {
    params: Promise<{
        id: string;
    }>
}

export async function PUT(request: Request, props: Props) {
    const params = await props.params;
    try {
        const { id } = params;
        const body = await request.json();
        const { name, url, events, enabled } = body;

        if (!name || !url || !Array.isArray(events)) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        db.prepare(`
            UPDATE discord_webhooks 
            SET name = @name, url = @url, events = @events, enabled = @enabled
            WHERE id = @id
        `).run({
            id,
            name,
            url,
            events: JSON.stringify(events),
            enabled: enabled ? 1 : 0
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to update webhook:", error);
        return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
    }
}

export async function DELETE(request: Request, props: Props) {
    const params = await props.params;
    try {
        const { id } = params;
        db.prepare("DELETE FROM discord_webhooks WHERE id = ?").run(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
    }
}
