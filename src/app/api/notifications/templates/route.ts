import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-guard";
import { getTemplateOverrides, saveTemplateOverrides } from "@/lib/notifications/template-store";
import { Logger } from "@/lib/logger";

/** Global per-event message templates. Only overridden events are returned/stored. */
export async function GET(request: Request) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ templates: getTemplateOverrides() });
}

export async function PUT(request: Request) {
    if (!(await requireOwner(request))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as { templates?: unknown } | null;
    if (!body || typeof body.templates !== "object" || body.templates === null || Array.isArray(body.templates)) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    try {
        // sanitizeTemplates (inside save) drops unknown events and caps lengths.
        const templates = saveTemplateOverrides(body.templates);
        return NextResponse.json({ success: true, templates });
    } catch (error) {
        Logger.error("Failed to save notification templates:", error);
        return NextResponse.json({ error: "Failed to save templates" }, { status: 500 });
    }
}
