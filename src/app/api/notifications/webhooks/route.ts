import { NextResponse } from "next/server";
import { getWebhooks, createWebhook, toPublicWebhook } from "@/lib/notifications/webhook-store";
import { parseWebhookInput } from "@/lib/notifications/webhook-input";
import { requireOwner } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";

export async function GET(request: Request) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        // The URL is a credential: only a masked form is returned.
        return NextResponse.json({ webhooks: getWebhooks().map(toPublicWebhook) });
    } catch (error) {
        Logger.error("Failed to fetch webhooks:", error);
        return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const parsed = parseWebhookInput(await request.json().catch(() => null), { requireUrl: true });
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        const id = createWebhook({ ...parsed.input, url: parsed.input.url! });
        return NextResponse.json({ success: true, id });
    } catch (error) {
        Logger.error("Failed to create webhook:", error);
        return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
    }
}
