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
    .replace(/\s*[\(\[][^\)\]]*(?:video|audio|visualizer|lyrics?|mv|remastered|version|official|hd|4k)[^\)\]]*[\)\]]/gi, "")
    .replace(/\s*(?:feat\.|ft\.)\s+.*$/gi, "")
    .replace(/\s*-\s*(?:single|ep|album|remastered|version)\s*$/gi, "")
    .trim();
}

export function cleanSearchArtist(artist: string): string {
  if (!artist) return "";
  return artist
    .split(/[,&/]|(?:\s+feat\.|\s+ft\.)/i)[0]
    .replace(/\s*-\s*topic\s*$/gi, "")
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

  let ytFetchPromise: Promise<string | null> | null = null;
  if (videoId) {
    ytFetchPromise = (async () => {
      try {
        const nextData = await getWatchNext(videoId);
        if (!songTitle) songTitle = nextData.current.title;
        if (!songArtist) songArtist = nextData.current.artists;
        if (!songDuration && nextData.queue[0]?.durationSeconds) {
          songDuration = nextData.queue[0].durationSeconds;
        }

        if (nextData.lyricsBrowseId) {
          return await getYtLyrics(nextData.lyricsBrowseId);
        }
      } catch {
      }
      return null;
    })();
  }

  const cleanedTitle = cleanSearchTitle(songTitle);
  const cleanedArtist = cleanSearchArtist(songArtist);

  const lrclibPromise = (async (): Promise<{ synced?: SyncedLyricLine[]; raw?: string; plain?: string; track?: string; artist?: string } | null> => {
    if (!songTitle && !cleanedTitle) return null;

    const queriesToTry = [
      { t: cleanedTitle, a: cleanedArtist },
      { t: songTitle, a: cleanedArtist },
      { t: cleanedTitle, a: songArtist }
    ];

    for (const q of queriesToTry) {
      if (!q.t || !q.a) continue;
      try {
        const p = new URLSearchParams();
        p.set("track_name", q.t);
        p.set("artist_name", q.a);
        if (songDuration > 0) p.set("duration", songDuration.toString());

        const res = await fetch(`https://lrclib.net/api/get?${p.toString()}`, {
          headers: { "User-Agent": "MusicPlayerAPI/1.0" },
          signal: AbortSignal.timeout(3500)
        });

        if (res.ok) {
          const item = await res.json() as {
            trackName?: string;
            artistName?: string;
            plainLyrics?: string;
            syncedLyrics?: string;
          };

          if (item.syncedLyrics) {
            return {
              synced: parseLrc(item.syncedLyrics),
              raw: item.syncedLyrics,
              plain: item.plainLyrics,
              track: item.trackName,
              artist: item.artistName
            };
          }
          if (item.plainLyrics) {
            return { plain: item.plainLyrics, track: item.trackName, artist: item.artistName };
          }
        }
      } catch {
      }
    }

    const searchQueries = [
      `${cleanedTitle} ${cleanedArtist}`.trim(),
      `${cleanedTitle}`.trim(),
      `${songTitle}`.trim()
    ];

    for (const queryStr of searchQueries) {
      if (!queryStr) continue;
      try {
        const sRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(queryStr)}`, {
          headers: { "User-Agent": "MusicPlayerAPI/1.0" },
          signal: AbortSignal.timeout(3500)
        });

        if (sRes.ok) {
          const list = await sRes.json() as Array<{
            trackName?: string;
            artistName?: string;
            plainLyrics?: string;
            syncedLyrics?: string;
            duration?: number;
          }>;

          if (Array.isArray(list) && list.length > 0) {
            let matched = list.find(item => item.syncedLyrics);
            if (!matched) matched = list[0];

            if (matched && matched.syncedLyrics) {
              return {
                synced: parseLrc(matched.syncedLyrics),
                raw: matched.syncedLyrics,
                plain: matched.plainLyrics,
                track: matched.trackName,
                artist: matched.artistName
              };
            }
            if (matched && matched.plainLyrics) {
              return { plain: matched.plainLyrics, track: matched.trackName, artist: matched.artistName };
            }
          }
        }
      } catch {
      }
    }

    return null;
  })();

  const [ytResult, lrcResult] = await Promise.all([
    ytFetchPromise || Promise.resolve(null),
    lrclibPromise
  ]);

  if (ytResult) {
    ytLyricsText = ytResult;
  }

  if (lrcResult && lrcResult.synced && lrcResult.synced.length > 0) {
    return {
      trackName: lrcResult.track || songTitle,
      artistName: lrcResult.artist || songArtist,
      plainLyrics: lrcResult.plain || ytLyricsText || "",
      syncedLyrics: lrcResult.synced,
      rawSyncedLyrics: lrcResult.raw || null,
      isSynced: true,
      isEstimated: false,
      source: "lrclib"
    };
  }

  const plainCandidate = ytLyricsText || lrcResult?.plain || "";

  if (plainCandidate) {
    if (songDuration > 15) {
      const autoPaced = generateAutoSyncedLyrics(plainCandidate, songDuration);
      return {
        trackName: songTitle,
        artistName: songArtist,
        plainLyrics: plainCandidate,
        syncedLyrics: autoPaced,
        rawSyncedLyrics: null,
        isSynced: true,
        isEstimated: true,
        source: ytLyricsText ? "youtube" : "lrclib"
      };
    }

    return {
      trackName: songTitle,
      artistName: songArtist,
      plainLyrics: plainCandidate,
      syncedLyrics: [],
      rawSyncedLyrics: null,
      isSynced: false,
      isEstimated: false,
      source: ytLyricsText ? "youtube" : "lrclib"
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
