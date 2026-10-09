import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sendJson, sendError, setCorsHeaders } from "../lib/http.js";
import searchHandler from "./search.js";
import songHandler from "./song.js";
import nextHandler from "./next.js";
import lyricsHandler from "./lyrics.js";
import streamHandler from "./stream.js";
import playlistHandler from "./playlist.js";
import spotifyHandler from "./spotify.js";
import healthHandler from "./health.js";

let cachedIndexHtml: Buffer | null = null;
let cachedDocsHtml: Buffer | null = null;

async function getIndexHtml(): Promise<Buffer | null> {
  if (cachedIndexHtml) return cachedIndexHtml;
  try {
    cachedIndexHtml = await readFile(join(process.cwd(), "public", "index.html"));
    return cachedIndexHtml;
  } catch {
    return null;
  }
}

async function getDocsHtml(): Promise<Buffer | null> {
  if (cachedDocsHtml) return cachedDocsHtml;
  try {
    cachedDocsHtml = await readFile(join(process.cwd(), "public", "docs.html"));
    return cachedDocsHtml;
  } catch {
    return null;
  }
}

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
  const lowerPath = cleanPath.toLowerCase();

  if (lowerPath === "/" || lowerPath === "/index.html") {
    const html = await getIndexHtml();
    if (html) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": html.length,
        "Cache-Control": "public, max-age=60"
      });
      res.end(html);
      return;
    }
  }

  if (lowerPath === "/docs" || lowerPath === "/docs.html") {
    const html = await getDocsHtml();
    if (html) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": html.length,
        "Cache-Control": "public, max-age=60"
      });
      res.end(html);
      return;
    }
  }

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
  if (cleanPath === "/api/spotify") {
    return spotifyHandler(req, res);
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
        spotify: {
          path: "/api/spotify?url={spotifyUrlOrId}&match={true|false}&limit={number}",
          description: "Import Spotify playlist tracks and optionally resolve to YouTube Music"
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
