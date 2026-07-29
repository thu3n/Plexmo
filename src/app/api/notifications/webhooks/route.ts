import { NextResponse } from "next/server";
import { getWebhooks, createWebhook } from "@/lib/discord";
import { requireOwner } from "@/lib/auth-guard";
import { isAllowedOutboundUrl } from "@/lib/outbound-url";
import { Logger } from "@/lib/logger";

export async function GET(request: Request) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const webhooks = getWebhooks();
        return NextResponse.json({ webhooks });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { name, url, events } = body;

        if (!name || !url || !Array.isArray(events)) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }
        // Validate on the write path so an unfetchable target can never be
        // persisted and fired repeatedly by the notification loop.
        if (!isAllowedOutboundUrl(url)) {
            return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
        }

        const id = createWebhook({ name, url, events });

        return NextResponse.json({ success: true, id });
    } catch (error) {
        Logger.error("Failed to create webhook:", error);
        return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
    }
}
