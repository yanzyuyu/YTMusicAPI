import {
  MusicTrack,
  SongDetails,
  NextResponseData,
  PlaylistDetails,
  PlaylistTrack,
  ArtistRef,
  AlbumRef,
  ThumbnailItem,
  QueueItem
} from "./types.js";

const YTM_URL = "https://music.youtube.com/youtubei/v1";

const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Origin": "https://music.youtube.com",
  "Referer": "https://music.youtube.com/"
};

const CLIENT_CONTEXT = {
  client: {
    clientName: "WEB_REMIX",
    clientVersion: "1.20240101.01.00",
    hl: "en",
    gl: "US"
  }
};

const FILTER_PARAMS: Record<string, string> = {
  songs: "EgWKAQIIAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D",
  videos: "EgWKAQIQAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D",
  albums: "EgWKAQIBAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D",
  artists: "EgWKAQIgAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D",
  playlists: "EgWKAQIoAWoQEAMQBBAJEAoQBRAREBAQFQ%3D%3D"
};

export function parseDuration(durStr: string): number {
  if (!durStr) return 0;
  const parts = durStr.split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export function getBestThumbnail(thumbnails: ThumbnailItem[] = [], videoId?: string): string {
  if (thumbnails.length > 0) {
    const sorted = [...thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    const highest = sorted[0]?.url;
    if (highest) {
      if (highest.startsWith("//")) return "https:" + highest;
      return highest.replace(/=w\d+-h\d+/, "=w544-h544");
    }
  }
  if (videoId) {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }
  return "";
}

function parseRunsMetadata(runs: Array<{ text: string; navigationEndpoint?: Record<string, unknown> }> = []) {
  const artists: ArtistRef[] = [];
  let album: AlbumRef | null = null;
  let duration = "";

  const segments: Array<Array<{ text: string; navigationEndpoint?: Record<string, unknown> }>> = [];
  let currentSegment: Array<{ text: string; navigationEndpoint?: Record<string, unknown> }> = [];

  for (const run of runs) {
    if (run.text === " • " || run.text === "•") {
      segments.push(currentSegment);
      currentSegment = [];
    } else {
      currentSegment.push(run);
    }
  }
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  if (segments.length === 1) {
    const text = segments[0]?.map(r => r.text).join("") || "";
    if (text.includes(":")) {
      duration = text.trim();
    } else {
      artists.push({ name: text.trim() });
    }
  } else if (segments.length === 2) {
    for (const r of segments[0] || []) {
      const endpoint = r.navigationEndpoint as { browseEndpoint?: { browseId?: string } } | undefined;
      const cleanText = r.text.trim();
      if (cleanText && cleanText !== "&" && cleanText !== ",") {
        artists.push({ name: cleanText, id: endpoint?.browseEndpoint?.browseId });
      }
    }
    duration = segments[1]?.map(r => r.text).join("").trim() || "";
  } else if (segments.length >= 3) {
    for (const r of segments[0] || []) {
      const endpoint = r.navigationEndpoint as { browseEndpoint?: { browseId?: string } } | undefined;
      const cleanText = r.text.trim();
      if (cleanText && cleanText !== "&" && cleanText !== ",") {
        artists.push({ name: cleanText, id: endpoint?.browseEndpoint?.browseId });
      }
    }
    const albumRuns = segments[1] || [];
    const albumEndpoint = albumRuns[0]?.navigationEndpoint as { browseEndpoint?: { browseId?: string } } | undefined;
    const albumName = albumRuns.map(r => r.text).join("").trim();
    if (albumName) {
      album = { name: albumName, id: albumEndpoint?.browseEndpoint?.browseId };
    }
    const lastSeg = segments[segments.length - 1];
    duration = lastSeg?.map(r => r.text).join("").trim() || "";
  }

  return { artists, album, duration };
}

export async function searchMusic(query: string, type: string = "songs"): Promise<MusicTrack[]> {
  const param = FILTER_PARAMS[type] || FILTER_PARAMS.songs;
  const res = await fetch(`${YTM_URL}/search`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      context: CLIENT_CONTEXT,
      query,
      params: param
    }),
    signal: AbortSignal.timeout(9000)
  });

  if (!res.ok) {
    throw new Error(`YouTube Music search failed with status ${res.status}`);
  }

  const data = await res.json() as {
    contents?: {
      tabbedSearchResultsRenderer?: {
        tabs?: Array<{
          tabRenderer?: {
            content?: {
              sectionListRenderer?: {
                contents?: Array<{
                  musicShelfRenderer?: {
                    contents?: Array<{
                      musicResponsiveListItemRenderer?: {
                        flexColumns?: Array<{
                          musicResponsiveListItemFlexColumnRenderer?: {
                            text?: {
                              runs?: Array<{ text: string; navigationEndpoint?: Record<string, unknown> }>;
                            };
                          };
                        }>;
                        thumbnail?: {
                          musicThumbnailRenderer?: {
                            thumbnail?: {
                              thumbnails?: ThumbnailItem[];
                            };
                          };
                        };
                        playlistItemData?: {
                          videoId?: string;
                        };
                        badges?: Array<{
                          musicInlineBadgeRenderer?: {
                            icon?: {
                              iconType?: string;
                            };
                          };
                        }>;
                      };
                    }>;
                  };
                }>;
              };
            };
          };
        }>;
      };
    };
  };

  const sections = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
  const tracks: MusicTrack[] = [];

  for (const section of sections) {
    const shelfItems = section.musicShelfRenderer?.contents || [];
    for (const item of shelfItems) {
      const renderer = item.musicResponsiveListItemRenderer;
      if (!renderer) continue;

      const flex0 = renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0];
      const title = flex0?.text?.trim() || "";
      if (!title) continue;

      const watchEndpoint = flex0?.navigationEndpoint as { watchEndpoint?: { videoId?: string } } | undefined;
      const videoId = renderer.playlistItemData?.videoId || watchEndpoint?.watchEndpoint?.videoId || "";
      if (!videoId) continue;

      const flex1Runs = renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
      const meta = parseRunsMetadata(flex1Runs);

      const thumbnails = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
      const thumbnailUrl = getBestThumbnail(thumbnails, videoId);

      const isExplicit = (renderer.badges || []).some(
        b => b.musicInlineBadgeRenderer?.icon?.iconType === "MUSIC_EXPLICIT_BADGE"
      );

      tracks.push({
        id: videoId,
        title,
        artists: meta.artists.length > 0 ? meta.artists : [{ name: "Unknown Artist" }],
        album: meta.album,
        duration: meta.duration,
        durationSeconds: parseDuration(meta.duration),
        thumbnails,
        thumbnailUrl,
        type: type === "videos" ? "video" : "song",
        isExplicit
      });
    }
  }

  return tracks;
}

export async function getSongDetails(videoId: string): Promise<SongDetails> {
  try {
    const res = await fetch(`${YTM_URL}/player`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        context: CLIENT_CONTEXT,
        videoId
      }),
      signal: AbortSignal.timeout(9000)
    });

    if (res.ok) {
      const data = await res.json() as {
        videoDetails?: {
          videoId?: string;
          title?: string;
          author?: string;
          channelId?: string;
          lengthSeconds?: string;
          viewCount?: string;
          thumbnail?: {
            thumbnails?: ThumbnailItem[];
          };
        };
      };

      const details = data.videoDetails;
      if (details && details.videoId) {
        const durSec = parseInt(details.lengthSeconds || "0", 10);
        const thumbnails = details.thumbnail?.thumbnails || [];

        return {
          id: details.videoId,
          title: details.title || "",
          author: details.author || "Unknown",
          channelId: details.channelId,
          duration: formatDuration(durSec),
          durationSeconds: durSec,
          thumbnails,
          thumbnailUrl: getBestThumbnail(thumbnails, details.videoId),
          views: details.viewCount || "0",
          shareUrl: `https://music.youtube.com/watch?v=${details.videoId}`,
          embedUrl: `https://www.youtube.com/embed/${details.videoId}?autoplay=1&enablejsapi=1`
        };
      }
    }
  } catch {}

  const nextData = await getWatchNext(videoId);
  const item = nextData.queue.find(q => q.id === videoId) || nextData.queue[0];
  if (item) {
    return {
      id: item.id || videoId,
      title: item.title,
      author: item.artists.map(a => a.name).join(", "),
      channelId: item.artists[0]?.id,
      duration: item.duration,
      durationSeconds: item.durationSeconds,
      thumbnails: item.thumbnails,
      thumbnailUrl: item.thumbnailUrl,
      views: "0",
      shareUrl: `https://music.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`
    };
  }

  throw new Error("Song not found or unavailable");
}

export async function getWatchNext(videoId: string): Promise<NextResponseData> {
  const res = await fetch(`${YTM_URL}/next`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      context: CLIENT_CONTEXT,
      videoId,
      playlistId: `RDAMVM${videoId}`
    }),
    signal: AbortSignal.timeout(9000)
  });

  if (!res.ok) {
    throw new Error(`YouTube Music watch next failed with status ${res.status}`);
  }

  const data = await res.json() as {
    contents?: {
      singleColumnMusicWatchNextResultsRenderer?: {
        tabbedRenderer?: {
          watchNextTabbedResultsRenderer?: {
            tabs?: Array<{
              tabRenderer?: {
                title?: string;
                endpoint?: {
                  browseEndpoint?: {
                    browseId?: string;
                  };
                };
                content?: {
                  musicQueueRenderer?: {
                    content?: {
                      playlistPanelRenderer?: {
                        contents?: Array<{
                          playlistPanelVideoRenderer?: {
                            videoId?: string;
                            title?: {
                              runs?: Array<{ text: string }>;
                            };
                            longBylineText?: {
                              runs?: Array<{ text: string; navigationEndpoint?: Record<string, unknown> }>;
                            };
                            lengthText?: {
                              runs?: Array<{ text: string }>;
                            };
                            thumbnail?: {
                              thumbnails?: ThumbnailItem[];
                            };
                          };
                        }>;
                      };
                    };
                  };
                };
              };
            }>;
          };
        };
      };
    };
  };

  const tabs = data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs || [];
  const upNextTab = tabs.find(t => t.tabRenderer?.title === "Up next")?.tabRenderer;
  const lyricsTab = tabs.find(t => t.tabRenderer?.title === "Lyrics")?.tabRenderer;
  const lyricsBrowseId = lyricsTab?.endpoint?.browseEndpoint?.browseId || null;

  const panelItems = upNextTab?.content?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents || [];
  const queue: QueueItem[] = [];

  let currentTitle = "";
  let currentArtist = "";
  let currentDuration = "";

  for (let idx = 0; idx < panelItems.length; idx++) {
    const item = panelItems[idx]?.playlistPanelVideoRenderer;
    if (!item || !item.videoId) continue;

    const title = item.title?.runs?.[0]?.text || "";
    const meta = parseRunsMetadata(item.longBylineText?.runs || []);
    const durStr = item.lengthText?.runs?.[0]?.text || "";
    const durSec = parseDuration(durStr);
    const thumbs = item.thumbnail?.thumbnails || [];
    const thumbUrl = getBestThumbnail(thumbs, item.videoId);

    if (idx === 0) {
      currentTitle = title;
      currentArtist = meta.artists.map(a => a.name).join(", ");
      currentDuration = durStr;
    }

    queue.push({
      id: item.videoId,
      title,
      artists: meta.artists.length > 0 ? meta.artists : [{ name: "Unknown Artist" }],
      album: meta.album,
      duration: durStr,
      durationSeconds: durSec,
      thumbnails: thumbs,
      thumbnailUrl: thumbUrl
    });
  }

  return {
    current: {
      id: videoId,
      title: currentTitle,
      artists: currentArtist,
      duration: currentDuration
    },
    queue,
    lyricsBrowseId
  };
}

export async function getYtLyrics(browseId: string): Promise<string | null> {
  const res = await fetch(`${YTM_URL}/browse`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      context: CLIENT_CONTEXT,
      browseId
    }),
    signal: AbortSignal.timeout(9000)
  });

  if (!res.ok) return null;

  const data = await res.json() as {
    contents?: {
      sectionListRenderer?: {
        contents?: Array<{
          musicDescriptionShelfRenderer?: {
            description?: {
              runs?: Array<{ text: string }>;
            };
          };
        }>;
      };
    };
  };

  const runs = data?.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer?.description?.runs;
  if (!runs || runs.length === 0) return null;

  return runs.map(r => r.text).join("");
}

export async function getPlaylistDetails(playlistId: string): Promise<PlaylistDetails> {
  const browseId = playlistId.startsWith("VL") ? playlistId : `VL${playlistId}`;
  const res = await fetch(`${YTM_URL}/browse`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      context: CLIENT_CONTEXT,
      browseId
    }),
    signal: AbortSignal.timeout(9000)
  });

  if (!res.ok) {
    throw new Error(`YouTube Music playlist fetch failed with status ${res.status}`);
  }

  const data = await res.json() as {
    contents?: {
      twoColumnBrowseResultsRenderer?: {
        tabs?: Array<{
          tabRenderer?: {
            content?: {
              sectionListRenderer?: {
                contents?: Array<{
                  musicResponsiveHeaderRenderer?: {
                    title?: { runs?: Array<{ text: string }> };
                    description?: {
                      musicDescriptionShelfRenderer?: {
                        description?: { runs?: Array<{ text: string }> };
                      };
                    };
                    subtitle?: { runs?: Array<{ text: string }> };
                    secondSubtitle?: { runs?: Array<{ text: string }> };
                    thumbnail?: {
                      musicThumbnailRenderer?: {
                        thumbnail?: { thumbnails?: ThumbnailItem[] };
                      };
                    };
                  };
                }>;
              };
            };
          };
        }>;
        secondaryContents?: {
          sectionListRenderer?: {
            contents?: Array<{
              musicPlaylistShelfRenderer?: {
                contents?: Array<{
                  musicResponsiveListItemRenderer?: {
                    playlistItemData?: { videoId?: string };
                    flexColumns?: Array<{
                      musicResponsiveListItemFlexColumnRenderer?: {
                        text?: { runs?: Array<{ text: string; navigationEndpoint?: Record<string, unknown> }> };
                      };
                    }>;
                    thumbnail?: {
                      musicThumbnailRenderer?: {
                        thumbnail?: { thumbnails?: ThumbnailItem[] };
                      };
                    };
                  };
                }>;
              };
            }>;
          };
        };
      };
    };
  };

  const twoCol = data.contents?.twoColumnBrowseResultsRenderer;
  const headerContent = twoCol?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicResponsiveHeaderRenderer;
  const title = headerContent?.title?.runs?.[0]?.text || "Playlist";
  const descRuns = headerContent?.description?.musicDescriptionShelfRenderer?.description?.runs || [];
  const description = descRuns.map(r => r.text).join("") || "";
  const author = headerContent?.subtitle?.runs?.[0]?.text || "";
  const headerThumbs = headerContent?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
  const playlistThumbUrl = getBestThumbnail(headerThumbs);

  const playlistShelf = twoCol?.secondaryContents?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer;
  const listItems = playlistShelf?.contents || [];
  const tracks: PlaylistTrack[] = [];

  for (const item of listItems) {
    const r = item.musicResponsiveListItemRenderer;
    if (!r) continue;

    const videoId = r.playlistItemData?.videoId;
    if (!videoId) continue;

    const trackTitle = r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || "";
    const meta = parseRunsMetadata(r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []);
    const trackThumbs = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];

    tracks.push({
      id: videoId,
      title: trackTitle,
      artists: meta.artists.length > 0 ? meta.artists : [{ name: author || "Unknown" }],
      album: meta.album,
      duration: meta.duration,
      durationSeconds: parseDuration(meta.duration),
      thumbnails: trackThumbs,
      thumbnailUrl: getBestThumbnail(trackThumbs, videoId)
    });
  }

  return {
    id: playlistId,
    title,
    description,
    trackCount: tracks.length,
    author,
    thumbnailUrl: playlistThumbUrl,
    tracks
  };
}
