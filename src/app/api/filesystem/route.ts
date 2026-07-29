import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireOwner } from "@/lib/auth-guard";
import { resolveImportDir } from "@/lib/import-paths";

export async function GET(request: Request) {
  // 1. Strict Authentication — filesystem browsing is instance administration.
  if (!(await requireOwner(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  // 2. Containment to the config volume's import directory (shared with the
  //    Tautulli DB import, so both agree on what is reachable).
  const allowedRoot = resolveImportDir(null);
  const currentPath = resolveImportDir(searchParams.get("path"));

  if (!currentPath || !allowedRoot) {
    return NextResponse.json({ error: "Access denied: Path outside allowed directory" }, { status: 403 });
  }

  try {
    const items = fs.readdirSync(currentPath).map((name) => {
      const itemPath = path.join(currentPath, name);
      try {
        const itemStats = fs.statSync(itemPath);
        return {
          name,
          type: itemStats.isDirectory() ? "directory" : "file",
          path: itemPath,
        };
      } catch {
        return { name, type: "unknown", path: itemPath, error: true };
      }
    });

    // Sort: Directories first, then files
    items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "directory" ? -1 : 1;
    });

    return NextResponse.json({
      currentPath,
      // Only allow navigating up if we are not at the allowed root
      parent: currentPath === allowedRoot ? null : path.dirname(currentPath),
      items,
    });
  } catch {
    return NextResponse.json({ error: "Could not read directory" }, { status: 500 });
  }
}
