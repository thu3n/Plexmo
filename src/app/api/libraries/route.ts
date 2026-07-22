import { NextResponse } from "next/server";
import { authorizeApiKeyOrSession } from "@/lib/auth-guard";
import { scopedServerIds } from "@/lib/authz";
import { getLibrariesData } from "@/lib/library/libraries-query";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const user = await authorizeApiKeyOrSession(request);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowedServerIds = scopedServerIds(user.scope);

    try {
        return NextResponse.json(getLibrariesData(allowedServerIds));
    } catch (error) {
        Logger.error("Failed to fetch libraries:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
