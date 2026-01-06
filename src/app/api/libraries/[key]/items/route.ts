import { NextRequest, NextResponse } from "next/server";
import { getLibraryItemsPaginated } from "@/lib/libraries";
import { db } from "@/lib/db";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ key: string }> }
) {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "25");
    const search = searchParams.get("search") || undefined;
    const serverId = searchParams.get("server");
    const { key } = await params;

    if (!serverId) {
        return NextResponse.json({ error: "Server ID required" }, { status: 400 });
    }

    try {
        const { items: rawItems, totalCount } = await getLibraryItemsPaginated(key, serverId, page, pageSize, search);

        const toArray = (val: any) => Array.isArray(val) ? val : (val ? [val] : []);

        // Process items to include file path from meta_json
        const items = rawItems.map((item: any) => {
            let filePath = null;
            try {
                if (item.meta_json) {
                    const meta = JSON.parse(item.meta_json);

                    const mediaList = toArray(meta.Media);
                    if (mediaList.length > 0) {
                        const partList = toArray(mediaList[0].Part);
                        if (partList.length > 0 && partList[0].file) {
                            filePath = partList[0].file;
                        }
                    }

                    // Fallback for TV Shows (Location)
                    if (!filePath && meta.Location) {
                        const locList = toArray(meta.Location);
                        if (locList.length > 0 && locList[0].path) {
                            filePath = locList[0].path;
                        }
                    }
                }
            } catch (e) {
                // Ignore parse errors
            }

            // Extract originalTitle safely
            let originalTitle = null;
            try {
                if (item.meta_json) {
                    const meta = JSON.parse(item.meta_json);
                    originalTitle = meta.originalTitle;
                }
            } catch (e) { }

            return { ...item, filePath, originalTitle };
        });

        // Get server config for constructing image URLs
        const server = db.prepare("SELECT baseUrl, token FROM servers WHERE id = ?").get(serverId) as { baseUrl: string, token: string };

        return NextResponse.json({ items, totalCount, page, pageSize, server });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
