
import { NextRequest, NextResponse } from "next/server";
import { getGroupItemsPaginated } from "@/lib/library_groups";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const pageSize = parseInt(searchParams.get("pageSize") || "50");
        const search = searchParams.get("search") || undefined;

        const result = getGroupItemsPaginated(id, page, pageSize, search);
        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
