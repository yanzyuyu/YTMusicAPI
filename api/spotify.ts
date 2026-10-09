import type { IncomingMessage, ServerResponse } from "node:http";
import { parseQuery, sendJson, sendError, setCorsHeaders } from "../lib/http.js";
import { parseSpotifyPlaylistId, getSpotifyPlaylist } from "../lib/spotify.js";

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
    const rawInput = (query.url || query.id || query.q || "").trim();

    if (!rawInput) {
      sendError(res, 400, "Missing required parameter: url or id", "ERR_MISSING_SPOTIFY_URL");
      return;
    }

    const playlistId = parseSpotifyPlaylistId(rawInput);
    if (!playlistId) {
      sendError(res, 400, "Invalid Spotify playlist URL or ID format", "ERR_INVALID_SPOTIFY_ID");
      return;
    }

    const shouldMatch = query.match === "true" || query.match === "1" || query.resolve === "true";
    const rawLimit = (query.limit || "").trim();
    const matchLimit = rawLimit ? Math.max(1, Math.min(parseInt(rawLimit, 10), 10)) : 5;

    const playlistData = await getSpotifyPlaylist(playlistId, shouldMatch ? matchLimit : 0);
    sendJson(res, 200, playlistData);
  } catch {
    sendError(res, 500, "Failed to import Spotify playlist", "ERR_SPOTIFY_IMPORT_FAILED");
  }
}
