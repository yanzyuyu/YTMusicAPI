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

export function cleanSearchTitle(title: string): string {
  if (!title) return "";
  return title
    .replace(/\s*[\(\[][^\)\]]*(?:video|audio|visualizer|lyrics?|mv|remastered|version|official)[^\)\]]*[\)\]]/gi, "")
    .replace(/\s*(?:feat\.|ft\.)\s+.*$/gi, "")
    .replace(/\s*-\s*(?:single|ep|album)\s*$/gi, "")
    .trim();
}

export function cleanSearchArtist(artist: string): string {
  if (!artist) return "";
  return artist
    .split(/[,&/]|(?:\s+feat\.|\s+ft\.)/i)[0]
    .trim();
}

export function generateAutoSyncedLyrics(plainText: string, durationSeconds: number): SyncedLyricLine[] {
  const lines = plainText
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0 || !durationSeconds || durationSeconds <= 15) return [];

  const intro = Math.min(10, Math.round(durationSeconds * 0.05));
  const outro = Math.min(12, Math.round(durationSeconds * 0.06));
  const availableDuration = Math.max(10, durationSeconds - intro - outro);

  const totalWeight = lines.reduce((acc, l) => acc + Math.max(l.length, 12), 0);
  let currentTime = intro;

  const result: SyncedLyricLine[] = [];
  for (const line of lines) {
    result.push({
      time: Math.round(currentTime * 100) / 100,
      text: line
    });
    const weight = Math.max(line.length, 12);
    const lineDuration = Math.max(2.2, (weight / totalWeight) * availableDuration);
    currentTime += lineDuration;
  }
  return result;
}

export async function resolveLyrics(
  videoId?: string,
  title?: string,
  artist?: string,
  durationSeconds?: number
): Promise<LyricsResponseData> {
  let ytLyricsText: string | null = null;
  let songTitle = title || "";
  let songArtist = artist || "";
  let songDuration = durationSeconds || 0;

  if (videoId && (!songTitle || !songArtist || !songDuration)) {
    try {
      const nextData = await getWatchNext(videoId);
      songTitle = songTitle || nextData.current.title;
      songArtist = songArtist || nextData.current.artists;
      if (!songDuration && nextData.queue[0]?.durationSeconds) {
        songDuration = nextData.queue[0].durationSeconds;
      }

      if (nextData.lyricsBrowseId) {
        ytLyricsText = await getYtLyrics(nextData.lyricsBrowseId);
      }
    } catch {
    }
  }

  const cleanedTitle = cleanSearchTitle(songTitle);
  const cleanedArtist = cleanSearchArtist(songArtist);

  if (songTitle) {
    const candidates = [
      { t: songTitle, a: songArtist },
      { t: cleanedTitle, a: cleanedArtist },
      { t: cleanedTitle, a: "" }
    ];

    for (const cand of candidates) {
      if (!cand.t) continue;
      try {
        const queryParams = new URLSearchParams();
        queryParams.set("track_name", cand.t);
        if (cand.a) queryParams.set("artist_name", cand.a);
        if (songDuration > 0) queryParams.set("duration", songDuration.toString());

        const lrcRes = await fetch(`https://lrclib.net/api/get?${queryParams.toString()}`, {
          headers: { "User-Agent": "MusicPlayerAPI/1.0" },
          signal: AbortSignal.timeout(4000)
        });

        if (lrcRes.ok) {
          const lrcData = await lrcRes.json() as {
            trackName?: string;
            artistName?: string;
            plainLyrics?: string;
            syncedLyrics?: string;
          };

          if (lrcData.syncedLyrics) {
            return {
              trackName: lrcData.trackName || songTitle,
              artistName: lrcData.artistName || songArtist,
              plainLyrics: lrcData.plainLyrics || ytLyricsText || "",
              syncedLyrics: parseLrc(lrcData.syncedLyrics),
              rawSyncedLyrics: lrcData.syncedLyrics,
              isSynced: true,
              isEstimated: false,
              source: "lrclib"
            };
          }

          if (lrcData.plainLyrics && !ytLyricsText) {
            ytLyricsText = lrcData.plainLyrics;
          }
        }
      } catch {
      }
    }

    try {
      const searchRes = await fetch(
        `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanedTitle || songTitle} ${cleanedArtist || songArtist}`.trim())}`,
        {
          headers: { "User-Agent": "MusicPlayerAPI/1.0" },
          signal: AbortSignal.timeout(4000)
        }
      );

      if (searchRes.ok) {
        const searchItems = await searchRes.json() as Array<{
          trackName?: string;
          artistName?: string;
          plainLyrics?: string;
          syncedLyrics?: string;
        }>;

        if (Array.isArray(searchItems) && searchItems.length > 0) {
          const matched = searchItems.find(item => item.syncedLyrics) || searchItems[0];
          if (matched && matched.syncedLyrics) {
            return {
              trackName: matched.trackName || songTitle,
              artistName: matched.artistName || songArtist,
              plainLyrics: matched.plainLyrics || ytLyricsText || "",
              syncedLyrics: parseLrc(matched.syncedLyrics),
              rawSyncedLyrics: matched.syncedLyrics,
              isSynced: true,
              isEstimated: false,
              source: "lrclib"
            };
          }
          if (matched && matched.plainLyrics && !ytLyricsText) {
            ytLyricsText = matched.plainLyrics;
          }
        }
      }
    } catch {
    }
  }

  if (ytLyricsText) {
    if (songDuration > 15) {
      const autoPaced = generateAutoSyncedLyrics(ytLyricsText, songDuration);
      return {
        trackName: songTitle,
        artistName: songArtist,
        plainLyrics: ytLyricsText,
        syncedLyrics: autoPaced,
        rawSyncedLyrics: null,
        isSynced: true,
        isEstimated: true,
        source: "youtube"
      };
    }

    return {
      trackName: songTitle,
      artistName: songArtist,
      plainLyrics: ytLyricsText,
      syncedLyrics: [],
      rawSyncedLyrics: null,
      isSynced: false,
      isEstimated: false,
      source: "youtube"
    };
  }

  return {
    trackName: songTitle,
    artistName: songArtist,
    plainLyrics: "",
    syncedLyrics: [],
    rawSyncedLyrics: null,
    isSynced: false,
    isEstimated: false,
    source: "none"
  };
}
