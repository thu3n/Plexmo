
import { NextRequest, NextResponse } from "next/server";
import { getLibraryGroups, createLibraryGroup } from "@/lib/library_groups";

export async function GET() {
    try {
        const groups = getLibraryGroups();
        return NextResponse.json(groups);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, type, libraries } = body;

        if (!name || !type || !libraries) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const group = createLibraryGroup(name, type, libraries);
        return NextResponse.json(group);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
