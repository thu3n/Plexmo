import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const currentPath = searchParams.get("path") || process.env.TAUTULLI_PATH || process.cwd();

  try {
    // Basic security: Prevent escaping root if desired, but for this admin tool allowing full access is usually expected.
    // For now, we allow full system access since it's an admin setting.

    // Check if path exists
    if (!fs.existsSync(currentPath)) {
      return NextResponse.json({ error: "Path not found" }, { status: 404 });
    }

    const stats = fs.statSync(currentPath);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }

    const items = fs.readdirSync(currentPath).map((name) => {
      try {
        const itemPath = path.join(currentPath, name);
        const itemStats = fs.statSync(itemPath);
        return {
          name,
          type: itemStats.isDirectory() ? "directory" : "file",
          path: itemPath,
        };
      } catch (e) {
        return { name, type: "unknown", path: path.join(currentPath, name), error: true };
      }
    });

    // Sort: Directories first, then files
    items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "directory" ? -1 : 1;
    });

    const parent = path.dirname(currentPath);

    return NextResponse.json({
      currentPath: path.resolve(currentPath),
      parent: parent === currentPath ? null : parent, // Root check
      items,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
