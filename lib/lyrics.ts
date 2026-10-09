import { LyricsResponseData, SyncedLyricLine } from "./types.js";
import { getWatchNext, getYtLyrics } from "./ytmusic.js";

export function parseLrc(lrcText: string): SyncedLyricLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split("\n");
  const result: SyncedLyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)/;

  for (const line of lines) {
    const match = regex.exec(line.trim());
    if (match && match[1] && match[2]) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const text = (match[3] || "").trim();
      if (!isNaN(minutes) && !isNaN(seconds)) {
        result.push({
          time: Math.round((minutes * 60 + seconds) * 100) / 100,
          text
        });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export async function resolveLyrics(
  videoId?: string,
  title?: string,
  artist?: string
): Promise<LyricsResponseData> {
  let ytLyricsText: string | null = null;
  let songTitle = title || "";
  let songArtist = artist || "";

  if (videoId && (!songTitle || !songArtist)) {
    try {
      const nextData = await getWatchNext(videoId);
      songTitle = songTitle || nextData.current.title;
      songArtist = songArtist || nextData.current.artists;

      if (nextData.lyricsBrowseId) {
        ytLyricsText = await getYtLyrics(nextData.lyricsBrowseId);
      }
    } catch {
    }
  }

  if (songTitle) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.set("track_name", songTitle);
      if (songArtist) {
        queryParams.set("artist_name", songArtist);
      }

      const lrcRes = await fetch(`https://lrclib.net/api/get?${queryParams.toString()}`, {
        headers: { "User-Agent": "MusicPlayerAPI/1.0 (https://github.com)" },
        signal: AbortSignal.timeout(5000)
      });

      if (lrcRes.ok) {
        const lrcData = await lrcRes.json() as {
          plainLyrics?: string;
          syncedLyrics?: string;
        };

        if (lrcData.syncedLyrics || lrcData.plainLyrics) {
          const synced = lrcData.syncedLyrics ? parseLrc(lrcData.syncedLyrics) : [];
          return {
            plainLyrics: lrcData.plainLyrics || ytLyricsText || "",
            syncedLyrics: synced,
            rawSyncedLyrics: lrcData.syncedLyrics || null,
            source: "lrclib"
          };
        }
      }

      const searchRes = await fetch(
        `https://lrclib.net/api/search?q=${encodeURIComponent(`${songTitle} ${songArtist}`.trim())}`,
        {
          headers: { "User-Agent": "MusicPlayerAPI/1.0 (https://github.com)" },
          signal: AbortSignal.timeout(5000)
        }
      );

      if (searchRes.ok) {
        const results = await searchRes.json() as Array<{
          plainLyrics?: string;
          syncedLyrics?: string;
        }>;

        if (Array.isArray(results) && results.length > 0) {
          const first = results[0];
          if (first && (first.syncedLyrics || first.plainLyrics)) {
            return {
              plainLyrics: first.plainLyrics || ytLyricsText || "",
              syncedLyrics: first.syncedLyrics ? parseLrc(first.syncedLyrics) : [],
              rawSyncedLyrics: first.syncedLyrics || null,
              source: "lrclib"
            };
          }
        }
      }
    } catch {
    }
  }

  if (ytLyricsText) {
    return {
      plainLyrics: ytLyricsText,
      syncedLyrics: [],
      rawSyncedLyrics: null,
      source: "youtube"
    };
  }

  return {
    plainLyrics: "",
    syncedLyrics: [],
    rawSyncedLyrics: null,
    source: "none"
  };
}
