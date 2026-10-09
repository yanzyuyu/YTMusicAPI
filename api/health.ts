import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson, setCorsHeaders } from "../lib/http.js";

const START_TIME = Date.now();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  sendJson(res, 200, {
    status: "ok",
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    timestamp: new Date().toISOString(),
    engine: "ytmusic-native",
    version: "1.0.0"
  });
}
