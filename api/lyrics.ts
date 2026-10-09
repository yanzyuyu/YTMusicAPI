import type { IncomingMessage, ServerResponse } from "node:http";
import { parseQuery, sendJson, sendError, setCorsHeaders } from "../lib/http.js";
import { resolveLyrics } from "../lib/lyrics.js";

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
    const id = (query.id || "").trim();
    const title = (query.title || "").trim();
    const artist = (query.artist || "").trim();

    if (!id && !title) {
      sendError(res, 400, "Provide either 'id' or 'title' parameter", "ERR_MISSING_LYRICS_QUERY");
      return;
    }

    if (id && !/^[a-zA-Z0-9_-]{5,32}$/.test(id)) {
      sendError(res, 400, "Invalid song id format", "ERR_INVALID_ID");
      return;
    }

    const rawDur = (query.duration || query.dur || "").trim();
    const duration = rawDur ? parseInt(rawDur, 10) : 0;
    const rawOffset = (query.offset || "").trim();
    const offset = rawOffset ? parseFloat(rawOffset) : 0;

    const lyrics = await resolveLyrics(id, title, artist, duration, isNaN(offset) ? 0 : offset);
    sendJson(res, 200, lyrics);
  } catch {
    sendError(res, 500, "Failed to resolve lyrics", "ERR_LYRICS_FAILED");
  }
}
