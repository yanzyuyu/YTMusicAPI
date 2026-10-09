export interface ArtistRef {
  name: string;
  id?: string;
}

export interface AlbumRef {
  name: string;
  id?: string;
}

export interface ThumbnailItem {
  url: string;
  width?: number;
  height?: number;
}

export interface MusicTrack {
  id: string;
  title: string;
  artists: ArtistRef[];
  album: AlbumRef | null;
  duration: string;
  durationSeconds: number;
  thumbnails: ThumbnailItem[];
  thumbnailUrl: string;
  type: "song" | "video";
  isExplicit: boolean;
}

export interface SongDetails {
  id: string;
  title: string;
  author: string;
  channelId?: string;
  duration: string;
  durationSeconds: number;
  thumbnails: ThumbnailItem[];
  thumbnailUrl: string;
  views: string;
  shareUrl: string;
  embedUrl: string;
}

export interface QueueItem {
  id: string;
  title: string;
  artists: ArtistRef[];
  album: AlbumRef | null;
  duration: string;
  durationSeconds: number;
  thumbnails: ThumbnailItem[];
  thumbnailUrl: string;
}

export interface NextResponseData {
  current: {
    id: string;
    title: string;
    artists: string;
    duration: string;
  };
  queue: QueueItem[];
  lyricsBrowseId: string | null;
}

export interface SyncedLyricLine {
  time: number;
  text: string;
}

export interface LyricsResponseData {
  plainLyrics: string;
  syncedLyrics: SyncedLyricLine[];
  rawSyncedLyrics: string | null;
  source: "youtube" | "lrclib" | "none";
}

export interface AudioStreamItem {
  url: string;
  mimeType: string;
  bitrate: number;
  quality: string;
  contentLength?: string;
}

export interface StreamResponseData {
  id: string;
  title?: string;
  audioStreams: AudioStreamItem[];
  bestAudio: AudioStreamItem | null;
  embedUrl: string;
}

export interface PlaylistTrack {
  id: string;
  title: string;
  artists: ArtistRef[];
  album: AlbumRef | null;
  duration: string;
  durationSeconds: number;
  thumbnails: ThumbnailItem[];
  thumbnailUrl: string;
}

export interface PlaylistDetails {
  id: string;
  title: string;
  description: string;
  trackCount: number;
  author: string;
  thumbnailUrl: string;
  tracks: PlaylistTrack[];
}

export interface ApiErrorResponse {
  error: string;
  code: string;
}
