import { NextRequest, NextResponse } from "next/server";
import { getRuleInstances, createRuleInstance } from "@/lib/rules";
import { requireOwner } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";
import {
    validateAssignments,
    validateRuleName,
    validateRuleSettings,
    validateRuleType,
    validateWebhookIds,
} from "@/lib/rules/rule-payload";

export async function GET(req: NextRequest) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const instances = getRuleInstances();
        return NextResponse.json(instances);
    } catch (error) {
        Logger.error("Failed to fetch rule instances:", error);
        return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = validateRuleName(body.name);
    if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
    const type = validateRuleType(body.type);
    if (!type.ok) return NextResponse.json({ error: type.error }, { status: 400 });
    const settings = validateRuleSettings(type.value, body.settings);
    if (!settings.ok) return NextResponse.json({ error: settings.error }, { status: 400 });
    const webhookIds = validateWebhookIds(body.discordWebhookIds);
    if (!webhookIds.ok) return NextResponse.json({ error: webhookIds.error }, { status: 400 });
    const assignments = validateAssignments(body.assignments);
    if (!assignments.ok) return NextResponse.json({ error: assignments.error }, { status: 400 });

    try {
        const newRule = {
            id: crypto.randomUUID(),
            type: type.value,
            name: name.value,
            enabled: typeof body.enabled === "boolean" ? body.enabled : true,
            settings: settings.value,
            discordWebhookId: null,
            discordWebhookIds: webhookIds.value,
        };

        createRuleInstance(newRule, assignments.value ?? { userIds: [], serverIds: [] });
        return NextResponse.json(newRule, { status: 201 });
    } catch (error) {
        Logger.error("Failed to create rule instance:", error);
        return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
    }
}
