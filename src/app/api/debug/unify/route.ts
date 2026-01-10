import { NextResponse } from "next/server";
import { unifyLibraryItems } from "@/lib/services/unification_service";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const result = await unifyLibraryItems(true); // Force full scan/update
        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
