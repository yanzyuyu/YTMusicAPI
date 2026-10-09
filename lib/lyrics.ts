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
      if (!isNaN(minutes) && !isNaN(seconds) && text.length > 0) {
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

interface LyricCandidate {
  synced?: SyncedLyricLine[];
  raw?: string;
  plain?: string;
  track?: string;
  artist?: string;
}

async function fetchLrclibLyrics(
  title: string,
  artist: string,
  cleanedTitle: string,
  cleanedArtist: string,
  durationSec: number
): Promise<LyricCandidate | null> {
  const queriesToTry = [
    { t: cleanedTitle, a: cleanedArtist },
    { t: title, a: cleanedArtist },
    { t: cleanedTitle, a: artist },
    { t: title, a: artist }
  ];

  for (const q of queriesToTry) {
    if (!q.t || !q.a) continue;
    try {
      const p = new URLSearchParams();
      p.set("track_name", q.t);
      p.set("artist_name", q.a);
      if (durationSec > 0) p.set("duration", durationSec.toString());

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
          const parsed = parseLrc(item.syncedLyrics);
          if (parsed.length > 0) {
            return {
              synced: parsed,
              raw: item.syncedLyrics,
              plain: item.plainLyrics,
              track: item.trackName,
              artist: item.artistName
            };
          }
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
    `${title}`.trim()
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
            const parsed = parseLrc(matched.syncedLyrics);
            if (parsed.length > 0) {
              return {
                synced: parsed,
                raw: matched.syncedLyrics,
                plain: matched.plainLyrics,
                track: matched.trackName,
                artist: matched.artistName
              };
            }
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
}

async function fetchKugouLyrics(
  title: string,
  artist: string,
  durationSec: number
): Promise<LyricCandidate | null> {
  const searchKeywords = [
    [title, artist].filter(Boolean).join(" "),
    title
  ];

  for (const kw of searchKeywords) {
    if (!kw) continue;
    try {
      const sUrl = `http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${encodeURIComponent(kw)}&page=1&pagesize=5`;
      const sRes = await fetch(sUrl, { signal: AbortSignal.timeout(3500) });
      if (!sRes.ok) continue;

      const sData = await sRes.json() as {
        data?: {
          info?: Array<{
            songname: string;
            singername: string;
            hash: string;
            duration: number;
          }>;
        };
      };

      const list = sData?.data?.info || [];
      if (!list.length) continue;

      let target = list[0];
      if (durationSec > 0) {
        const matchByDur = list.find(item => Math.abs(item.duration - durationSec) <= 5);
        if (matchByDur) target = matchByDur;
      }

      const durParam = target.duration ? target.duration * 1000 : durationSec * 1000;
      const cUrl = `http://krcs.kugou.com/search?ver=1&man=yes&client=mobi&keyword=${encodeURIComponent(target.songname)}&duration=${durParam}&hash=${target.hash}`;
      const cRes = await fetch(cUrl, { signal: AbortSignal.timeout(3500) });
      if (!cRes.ok) continue;

      const cData = await cRes.json() as {
        candidates?: Array<{
          id: string;
          accesskey: string;
        }>;
      };

      const cands = cData?.candidates || [];
      if (!cands.length) continue;

      const cand = cands[0];
      const dUrl = `http://krcs.kugou.com/download?ver=1&client=mobi&id=${cand.id}&accesskey=${cand.accesskey}&fmt=lrc&charset=utf8`;
      const dRes = await fetch(dUrl, { signal: AbortSignal.timeout(3500) });
      if (!dRes.ok) continue;

      const dData = await dRes.json() as { content?: string };
      if (!dData?.content) continue;

      const lrcString = Buffer.from(dData.content, "base64").toString("utf-8");
      const parsed = parseLrc(lrcString);
      if (parsed.length > 0) {
        const plain = parsed.map(p => p.text).join("\n");
        return {
          synced: parsed,
          raw: lrcString,
          plain,
          track: target.songname,
          artist: target.singername
        };
      }
    } catch {
    }
  }

  return null;
}

export async function resolveLyrics(
  videoId?: string,
  title?: string,
  artist?: string,
  durationSeconds?: number,
  offsetSeconds: number = 0
): Promise<LyricsResponseData> {
  function applyOffset(lines: SyncedLyricLine[]): SyncedLyricLine[] {
    if (!offsetSeconds || offsetSeconds === 0) return lines;
    return lines.map(line => ({
      time: Math.max(0, Math.round((line.time + offsetSeconds) * 100) / 100),
      text: line.text
    }));
  }
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

  const lrclibPromise = fetchLrclibLyrics(
    songTitle,
    songArtist,
    cleanedTitle,
    cleanedArtist,
    songDuration
  );

  const kugouPromise = fetchKugouLyrics(
    cleanedTitle || songTitle,
    cleanedArtist || songArtist,
    songDuration
  );

  const [ytResult, lrcResult, kugouResult] = await Promise.all([
    ytFetchPromise || Promise.resolve(null),
    lrclibPromise,
    kugouPromise
  ]);

  if (ytResult) {
    ytLyricsText = ytResult;
  }

  if (lrcResult && lrcResult.synced && lrcResult.synced.length > 0) {
    return {
      trackName: lrcResult.track || songTitle,
      artistName: lrcResult.artist || songArtist,
      plainLyrics: lrcResult.plain || ytLyricsText || "",
      syncedLyrics: applyOffset(lrcResult.synced),
      rawSyncedLyrics: lrcResult.raw || null,
      isSynced: true,
      isEstimated: false,
      source: "lrclib"
    };
  }

  if (kugouResult && kugouResult.synced && kugouResult.synced.length > 0) {
    return {
      trackName: kugouResult.track || songTitle,
      artistName: kugouResult.artist || songArtist,
      plainLyrics: kugouResult.plain || ytLyricsText || "",
      syncedLyrics: applyOffset(kugouResult.synced),
      rawSyncedLyrics: kugouResult.raw || null,
      isSynced: true,
      isEstimated: false,
      source: "kugou"
    };
  }

  const plainCandidate = ytLyricsText || lrcResult?.plain || kugouResult?.plain || "";

  if (plainCandidate) {
    return {
      trackName: songTitle,
      artistName: songArtist,
      plainLyrics: plainCandidate,
      syncedLyrics: [],
      rawSyncedLyrics: null,
      isSynced: false,
      isEstimated: false,
      source: ytLyricsText ? "youtube" : (lrcResult?.plain ? "lrclib" : "kugou")
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
