import { NextResponse } from "next/server";
import { getHistory, deleteHistory, deleteAllHistory } from "@/lib/history";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get("serverId") || undefined;
    const userId = searchParams.get("userId") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "25", 10);

    const result = getHistory({ page, pageSize, serverId, userId, search });

    // Combine for frontend convenience, or keep separate?
    // Frontend expects `history: HistoryEntry[]`.
    // We should change the contract to return pagination info.
    // If page=1, we prepend active sessions? No, let's return structure.

    return NextResponse.json({
        history: result.data,
        activeSessions: result.activeSessions,
        totalCount: result.totalActionCount,
        page,
        pageSize
    });
}

export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { ids, all } = body;

        if (all) {
            deleteAllHistory();
            return NextResponse.json({ success: true });
        }

        if (!ids || !Array.isArray(ids)) {
            return NextResponse.json({ error: "Invalid request. 'ids' must be an array." }, { status: 400 });
        }

        deleteHistory(ids);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete history:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
