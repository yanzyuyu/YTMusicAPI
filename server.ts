import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import apiHandler from "./api/index.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const PUBLIC_DIR = join(process.cwd(), "public");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = createServer(async (req, res) => {
  const urlStr = req.url || "/";
  let pathname = "/";
  try {
    pathname = new URL(urlStr, "http://localhost").pathname;
  } catch {
    pathname = urlStr.split("?")[0] || "/";
  }

  if (pathname.startsWith("/api")) {
    await apiHandler(req, res);
    return;
  }

  let filePath = join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = join(filePath, "index.html");
    }

    const content = await readFile(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": content.length,
      "Cache-Control": "public, max-age=3600"
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
});

server.listen(PORT, () => {
  process.stdout.write(`[READY] Server running at http://localhost:${PORT}\n`);
});
