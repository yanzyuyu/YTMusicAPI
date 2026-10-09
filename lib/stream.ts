import { AudioStreamItem, StreamResponseData } from "./types.js";

const STREAM_INSTANCES = [
  "https://invidious.f5.si",
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://iv.datura.network"
];

export async function resolveStream(videoId: string): Promise<StreamResponseData> {
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`;
  const audioStreams: AudioStreamItem[] = [];
  let videoTitle = "";

  for (const instance of STREAM_INSTANCES) {
    try {
      const res = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        headers: { "User-Agent": "MusicPlayerAPI/1.0" },
        signal: AbortSignal.timeout(4000)
      });

      if (!res.ok) continue;

      const data = await res.json() as {
        title?: string;
        adaptiveFormats?: Array<{
          url?: string;
          type?: string;
          bitrate?: string | number;
          qualityLabel?: string;
          audioQuality?: string;
          clen?: string;
          contentLength?: string;
        }>;
      };

      videoTitle = data.title || "";
      const rawFormats = data.adaptiveFormats || [];

      for (const fmt of rawFormats) {
        if (!fmt.url || !fmt.type || !fmt.type.startsWith("audio/")) continue;
        const bitrateNum = typeof fmt.bitrate === "number" ? fmt.bitrate : parseInt(fmt.bitrate || "0", 10);
        audioStreams.push({
          url: fmt.url,
          mimeType: fmt.type,
          bitrate: bitrateNum,
          quality: fmt.audioQuality || fmt.qualityLabel || "AUDIO_QUALITY_MEDIUM",
          contentLength: fmt.clen || fmt.contentLength
        });
      }

      if (audioStreams.length > 0) {
        break;
      }
    } catch {
    }
  }

  audioStreams.sort((a, b) => b.bitrate - a.bitrate);

  return {
    id: videoId,
    title: videoTitle,
    audioStreams,
    bestAudio: audioStreams[0] || null,
    embedUrl
  };
}
