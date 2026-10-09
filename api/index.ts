import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson, sendError, setCorsHeaders } from "../lib/http.js";
import searchHandler from "./search.js";
import songHandler from "./song.js";
import nextHandler from "./next.js";
import lyricsHandler from "./lyrics.js";
import streamHandler from "./stream.js";
import playlistHandler from "./playlist.js";
import healthHandler from "./health.js";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlStr = req.url || "/";
  let pathname = "/";
  try {
    pathname = new URL(urlStr, "http://localhost").pathname;
  } catch {
    pathname = urlStr.split("?")[0] || "/";
  }

  const cleanPath = pathname.replace(/\/+$/, "") || "/";

  if (cleanPath === "/api/search") {
    return searchHandler(req, res);
  }
  if (cleanPath === "/api/song") {
    return songHandler(req, res);
  }
  if (cleanPath === "/api/next") {
    return nextHandler(req, res);
  }
  if (cleanPath === "/api/lyrics") {
    return lyricsHandler(req, res);
  }
  if (cleanPath === "/api/stream") {
    return streamHandler(req, res);
  }
  if (cleanPath === "/api/playlist") {
    return playlistHandler(req, res);
  }
  if (cleanPath === "/api/health") {
    return healthHandler(req, res);
  }

  if (cleanPath === "/api" || cleanPath === "") {
    sendJson(res, 200, {
      name: "YouTube Music Player API",
      version: "1.0.0",
      description: "Fast, zero-dependency YouTube Music API optimized for Vercel serverless deployment",
      endpoints: {
        search: {
          path: "/api/search?q={query}&type={songs|videos|albums|artists|playlists}",
          description: "Search YouTube Music catalog"
        },
        song: {
          path: "/api/song?id={videoId}",
          description: "Get song details and metadata"
        },
        next: {
          path: "/api/next?id={videoId}",
          description: "Get watch next recommendations and radio queue"
        },
        lyrics: {
          path: "/api/lyrics?id={videoId}&title={title}&artist={artist}",
          description: "Get synchronized and plain text lyrics"
        },
        stream: {
          path: "/api/stream?id={videoId}&play={true|false}",
          description: "Get audio streams or direct audio 302 redirect"
        },
        playlist: {
          path: "/api/playlist?id={playlistId}",
          description: "Get playlist tracks and details"
        },
        health: {
          path: "/api/health",
          description: "API health and uptime status"
        }
      }
    });
    return;
  }

  sendError(res, 404, `Endpoint '${cleanPath}' not found`, "ERR_NOT_FOUND");
}
