import type { IncomingMessage, ServerResponse } from "node:http";
import { parseQuery, sendJson, sendError, setCorsHeaders } from "../lib/http.js";
import { getSongDetails } from "../lib/ytmusic.js";

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

    if (!id) {
      sendError(res, 400, "Missing required parameter: id", "ERR_MISSING_ID");
      return;
    }

    if (!/^[a-zA-Z0-9_-]{5,32}$/.test(id)) {
      sendError(res, 400, "Invalid song id format", "ERR_INVALID_ID");
      return;
    }

    const song = await getSongDetails(id);
    sendJson(res, 200, song);
  } catch {
    sendError(res, 404, "Song not found or unavailable", "ERR_SONG_NOT_FOUND");
  }
}
