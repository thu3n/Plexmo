import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const response = NextResponse.json({ success: true });

    // Determine if we should use secure cookies (match login logic)
    const isHttps = req.nextUrl.protocol === "https:";

    response.cookies.set("token", "", {
        httpOnly: true,
        secure: isHttps,
        maxAge: 0,
        path: "/",
        sameSite: "lax",
    });

    return response;
}
