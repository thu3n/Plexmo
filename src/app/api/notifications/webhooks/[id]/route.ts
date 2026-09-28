import { NextResponse } from "next/server";
import { updateWebhook, deleteWebhook } from "@/lib/notifications/webhook-store";
import { parseWebhookInput } from "@/lib/notifications/webhook-input";
import { requireOwner } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";

interface Props {
    params: Promise<{
        id: string;
    }>
}

export async function PUT(request: Request, props: Props) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await props.params;
    try {
        // A blank/omitted URL keeps the stored one (the client only has a masked copy).
        const parsed = parseWebhookInput(await request.json().catch(() => null), { requireUrl: false });
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        if (!updateWebhook(id, parsed.input)) {
            return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        Logger.error("Failed to update webhook:", error);
        return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
    }
}

export async function DELETE(request: Request, props: Props) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await props.params;
    try {
        deleteWebhook(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        Logger.error("Failed to delete webhook:", error);
        return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
    }
}
