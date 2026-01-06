
import { NextRequest, NextResponse } from "next/server";
import { updateLibraryGroup, deleteLibraryGroup, getLibraryGroup } from "@/lib/library_groups";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const group = getLibraryGroup(id);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(group);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { name, libraries } = body;

        const updated = updateLibraryGroup(id, name, libraries);
        return NextResponse.json(updated);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        deleteLibraryGroup(id);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
