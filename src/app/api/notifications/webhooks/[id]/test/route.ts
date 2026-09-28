import { NextResponse } from "next/server";
import { getWebhookById } from "@/lib/notifications/webhook-store";
import { buildTestEmbed, postEmbed } from "@/lib/notifications/dispatch";
import { requireOwner } from "@/lib/auth-guard";

interface Props {
    params: Promise<{ id: string }>;
}

/** Send a test embed to one stored webhook, by id — the client never holds the URL. */
export async function POST(request: Request, props: Props) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await props.params;
    const webhook = getWebhookById(id);
    if (!webhook) {
        return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const result = await postEmbed(webhook.url, buildTestEmbed(), webhook.name);
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({ success: true });
}
