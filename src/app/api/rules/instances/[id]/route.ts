import { NextRequest, NextResponse } from "next/server";
import { getRuleInstance, updateRuleInstance, deleteRuleInstance } from "@/lib/rules";
import { requireOwner } from "@/lib/auth-guard";
import { Logger } from "@/lib/logger";
import { syncRuleAssignments } from "@/lib/rules/rule-assignments-sync";
import {
    validateAssignments,
    validateRuleName,
    validateRuleSettings,
    validateWebhookIds,
} from "@/lib/rules/rule-payload";

// We need to define params type for dynamic route
interface Props {
    params: Promise<{
        id: string;
    }>
}

export async function GET(req: NextRequest, props: Props) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await props.params;
    try {
        const instance = getRuleInstance(params.id);
        if (!instance) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }
        return NextResponse.json(instance);
    } catch (error) {
        Logger.error("Failed to fetch rule instance:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, props: Props) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await props.params;
    try {
        const instance = getRuleInstance(params.id);
        if (!instance) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }

        let body: Record<string, unknown>;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        // Only fields the client may change are merged, and each is validated
        // when present; a toggle sends just { enabled }.
        const updated = { ...instance, id: params.id };
        if (body.name !== undefined) {
            const name = validateRuleName(body.name);
            if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
            updated.name = name.value;
        }
        if (body.enabled !== undefined) {
            if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "Invalid enabled flag" }, { status: 400 });
            updated.enabled = body.enabled;
        }
        if (body.settings !== undefined) {
            const settings = validateRuleSettings(instance.type, body.settings);
            if (!settings.ok) return NextResponse.json({ error: settings.error }, { status: 400 });
            updated.settings = settings.value;
        }
        if (body.discordWebhookIds !== undefined) {
            const webhookIds = validateWebhookIds(body.discordWebhookIds);
            if (!webhookIds.ok) return NextResponse.json({ error: webhookIds.error }, { status: 400 });
            updated.discordWebhookIds = webhookIds.value;
        }
        const assignments = validateAssignments(body.assignments);
        if (!assignments.ok) return NextResponse.json({ error: assignments.error }, { status: 400 });

        updateRuleInstance(updated);
        if (assignments.value) syncRuleAssignments(params.id, assignments.value);
        return NextResponse.json(updated);
    } catch (error) {
        Logger.error("Failed to update rule instance:", error);
        return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: Props) {
    if (!(await requireOwner(req))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await props.params;
    try {
        deleteRuleInstance(params.id);
        return NextResponse.json({ success: true });
    } catch (error) {
        Logger.error("Failed to delete rule instance:", error);
        return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
    }
}
