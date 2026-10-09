import type { IncomingMessage, ServerResponse } from "node:http";
import { parseQuery, sendJson, sendError, redirect, setCorsHeaders } from "../lib/http.js";
import { resolveStream } from "../lib/stream.js";

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

    const rawStart = (query.start || query.t || "").trim();
    const start = rawStart ? Math.max(0, parseInt(rawStart, 10)) : 0;

    const streamData = await resolveStream(id, start);
    const shouldPlay = query.play === "true" || query.play === "1";

    if (shouldPlay && streamData.bestAudio) {
      redirect(res, streamData.bestAudio.url, 302);
      return;
    }

    sendJson(res, 200, streamData);
  } catch {
    sendError(res, 500, "Failed to resolve stream", "ERR_STREAM_FAILED");
  }
}
