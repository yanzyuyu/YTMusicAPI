import { SpotifyPlaylistResponse, SpotifyTrackItem } from "./types.js";
import { searchMusic } from "./ytmusic.js";

export function parseSpotifyPlaylistId(input: string): string | null {
  if (!input) return null;
  const clean = input.trim();
  const match = clean.match(/(?:spotify(?:\.com)?\/(?:embed\/)?playlist\/|spotify:playlist:|^)([a-zA-Z0-9]{15,32})/);
  return match ? match[1] : null;
}

function formatDuration(ms: number): string {
  if (!ms || isNaN(ms)) return "0:00";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

interface RawSpotifyTrack {
  uri?: string;
  title?: string;
  subtitle?: string;
  duration?: number;
  isExplicit?: boolean;
  audioPreview?: {
    url?: string;
  };
}

export async function getSpotifyPlaylist(
  playlistId: string,
  matchCount: number = 0
): Promise<SpotifyPlaylistResponse> {
  const url = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    signal: AbortSignal.timeout(6000)
  });

  if (!res.ok) {
    throw new Error(`Spotify playlist returned status ${res.status}`);
  }

  const html = await res.text();
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);

  if (!nextDataMatch || !nextDataMatch[1]) {
    throw new Error("Unable to extract Spotify playlist data");
  }

  const data = JSON.parse(nextDataMatch[1]);
  const entity = data.props?.pageProps?.state?.data?.entity;

  if (!entity) {
    throw new Error("Spotify playlist entity not found");
  }

  const rawTracks: RawSpotifyTrack[] = Array.isArray(entity.trackList) ? entity.trackList : [];
  const tracks: SpotifyTrackItem[] = rawTracks.map(t => {
    const durMs = typeof t.duration === "number" ? t.duration : 0;
    return {
      spotifyUri: t.uri || "",
      title: t.title || "Unknown Title",
      artist: t.subtitle || "Unknown Artist",
      duration: formatDuration(durMs),
      durationSeconds: Math.round(durMs / 1000),
      audioPreviewUrl: t.audioPreview?.url || null,
      isExplicit: Boolean(t.isExplicit)
    };
  });

  const safeMatchCount = Math.max(0, Math.min(matchCount, 10));
  if (safeMatchCount > 0 && tracks.length > 0) {
    const targets = tracks.slice(0, safeMatchCount);
    await Promise.all(
      targets.map(async item => {
        try {
          const query = `${item.title} ${item.artist}`.trim();
          const ytResults = await searchMusic(query, "songs");
          if (ytResults && ytResults.length > 0) {
            item.matchedTrack = ytResults[0];
          }
        } catch {
        }
      })
    );
  }

  return {
    id: playlistId,
    title: entity.name || entity.title || "Spotify Playlist",
    author: entity.subtitle || "Spotify",
    trackCount: tracks.length,
    coverUrl: entity.coverArt?.sources?.[0]?.url || "",
    tracks
  };
}
