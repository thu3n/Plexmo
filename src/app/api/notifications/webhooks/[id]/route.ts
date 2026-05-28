import { NextResponse } from "next/server";
import { updateWebhook, deleteWebhook } from "@/lib/discord";
import { Logger } from "@/lib/logger";

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

        updateWebhook(id, { name, url, events, enabled });

        return NextResponse.json({ success: true });
    } catch (error) {
        Logger.error("Failed to update webhook:", error);
        return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
    }
}

export async function DELETE(request: Request, props: Props) {
    const params = await props.params;
    try {
        const { id } = params;
        deleteWebhook(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
    }
}
