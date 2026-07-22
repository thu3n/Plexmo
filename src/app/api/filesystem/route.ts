import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireOwner } from "@/lib/auth-guard";
import { resolveConfigDir } from "@/lib/config-dir";

export async function GET(request: Request) {
  // 1. Strict Authentication — filesystem browsing is instance administration.
  if (!(await requireOwner(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  // 2. Determine Secure Root (Import Directory)
  const configDir = resolveConfigDir() ?? path.join(process.cwd(), "prisma");

  // We only allow access to "import" folder inside config
  const allowedRoot = path.join(configDir, "import");

  // Ensure import dir exists
  if (!fs.existsSync(allowedRoot)) {
    try {
      fs.mkdirSync(allowedRoot, { recursive: true });
    } catch (e) {
      // ignore
    }
  }

  const reqPath = searchParams.get("path") || allowedRoot;
  const currentPath = path.resolve(reqPath);

  // 3. Path Traversal Protection
  if (!currentPath.startsWith(path.resolve(allowedRoot))) {
    return NextResponse.json({ error: "Access denied: Path outside allowed directory" }, { status: 403 });
  }

  try {
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
      currentPath: currentPath,
      // Only allow navigating up if we are not at the allowed root
      parent: currentPath === path.resolve(allowedRoot) ? null : parent,
      items,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
