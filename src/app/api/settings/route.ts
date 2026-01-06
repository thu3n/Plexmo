import { NextRequest, NextResponse } from "next/server";
import { getSettings, setSetting } from "@/lib/settings";

export async function GET() {
    const settings = getSettings();
    return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { key, value } = body;

        if (!key || value === undefined) {
            return new NextResponse("Missing key or value", { status: 400 });
        }

        setSetting(key, String(value));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to save setting:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
