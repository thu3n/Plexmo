import { NextRequest, NextResponse } from "next/server";
import { getRuleInstance, updateRuleInstance, deleteRuleInstance } from "@/lib/rules";

// We need to define params type for dynamic route
interface Props {
    params: Promise<{
        id: string;
    }>
}

export async function GET(req: NextRequest, props: Props) {
    const params = await props.params;
    try {
        const instance = getRuleInstance(params.id);
        if (!instance) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }
        return NextResponse.json(instance);
    } catch (error) {
        console.error("Failed to fetch rule instance:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, props: Props) {
    const params = await props.params;
    try {
        const instance = getRuleInstance(params.id);
        if (!instance) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }

        const body = await req.json();

        const updated = {
            ...instance,
            ...body,
            id: params.id // Ensure ID doesn't change
        };

        updateRuleInstance(updated);
        return NextResponse.json(updated);
    } catch (error) {
        console.error("Failed to update rule instance:", error);
        return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: Props) {
    const params = await props.params;
    try {
        deleteRuleInstance(params.id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete rule instance:", error);
        return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
    }
}
