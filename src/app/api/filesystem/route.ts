import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export async function GET(request: Request) {
  // 1. Strict Authentication
  const token = cookies().get("token")?.value;
  const user = token ? await verifyToken(token) : null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  
  // 2. Determine Secure Root (Import Directory)
  let configDir: string;
  if (process.env.CONFIG_DIR) {
    configDir = process.env.CONFIG_DIR;
  } else if (process.env.NODE_ENV === "production" && fs.existsSync(path.join(process.cwd(), "config"))) {
    configDir = path.join(process.cwd(), "config");
  } else if (fs.existsSync("/app/config")) {
    configDir = "/app/config";
  } else {
    // Default fallback (dev)
    configDir = path.join(process.cwd(), "prisma"); // or local config
  }

  // We only allow access to "import" folder inside config
  const allowedRoot = path.join(configDir, "import");

  // Ensure import dir exists
  if (!fs.existsSync(allowedRoot)) {
    try {
      fs.mkdirSync(allowedRoot, { recursive: true });
    } catch(e) {
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
