import { NextResponse } from "next/server";
import { updateWebhook, deleteWebhook } from "@/lib/discord";
import { requireOwner } from "@/lib/auth-guard";
import { isAllowedOutboundUrl } from "@/lib/outbound-url";
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

    const params = await props.params;
    try {
        const { id } = params;
        const body = await request.json();
        const { name, url, events, enabled } = body;

        if (!name || !url || !Array.isArray(events)) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }
        if (!isAllowedOutboundUrl(url)) {
            return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
        }

        updateWebhook(id, { name, url, events, enabled });

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

    const params = await props.params;
    try {
        const { id } = params;
        deleteWebhook(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
    }
}
