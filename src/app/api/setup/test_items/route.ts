import { NextResponse } from "next/server";
import { getLibraryItems, getLibraries } from "@/lib/libraries";

export async function GET() {
    // 1. Get a library
    const libs = await getLibraries();
    if (libs.length === 0) return NextResponse.json({ error: "No libraries" });
    const lib = libs[0];

    if (!lib.serverId) {
        return NextResponse.json({ error: "Library has no server ID" }, { status: 500 });
    }

    // 2. Get items
    const items = await getLibraryItems(lib.key, lib.serverId);

    return NextResponse.json({
        success: true,
        library: lib.title,
        count: items.length,
        sample: items.slice(0, 3)
    });
}
