import type { IncomingMessage, ServerResponse } from "node:http";
import { parseQuery, sendJson, sendError, setCorsHeaders } from "../lib/http.js";
import { searchMusic } from "../lib/ytmusic.js";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendError(res, 405, "Method not allowed", "ERR_METHOD_NOT_ALLOWED");
    return;
  }

  try {
    const query = parseQuery(req);
    const q = (query.q || "").trim();

    if (!q) {
      sendError(res, 400, "Missing required query parameter: q", "ERR_MISSING_QUERY");
      return;
    }

    if (q.length > 200) {
      sendError(res, 400, "Query exceeds maximum limit of 200 characters", "ERR_QUERY_TOO_LONG");
      return;
    }

    const type = (query.type || "songs").toLowerCase();
    const tracks = await searchMusic(q, type);

    sendJson(res, 200, {
      query: q,
      type,
      count: tracks.length,
      results: tracks
    });
  } catch {
    sendError(res, 500, "Failed to search YouTube Music", "ERR_SEARCH_FAILED");
  }
}
