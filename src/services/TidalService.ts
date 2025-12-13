// Lightweight TidalService mock/wrapper for the project
// This file implements the minimal API the UI expects: search tracks/artists, get cover/artist urls, and basic helpers.

import type { Track as LocalTrack } from '../types';
import { searchTracks as searchLocalTracks, getAllArtists } from '../utils/musicLibrary';

// Read vite env var for client-side use, fallback to process.env if present server-side
const importMetaEnv = typeof import.meta !== 'undefined' && typeof (import.meta as { env?: unknown }).env === 'object'
  ? (import.meta as { env?: Record<string, unknown> }).env
  : undefined;
const nodeEnv = typeof process !== 'undefined' && typeof process.env === 'object'
  ? process.env as Record<string, unknown>
  : undefined;

const resolveEnvString = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

const TIDAL_TOKEN = resolveEnvString(importMetaEnv?.VITE_TIDAL_TOKEN) ?? resolveEnvString(nodeEnv?.TIDAL_TOKEN);
const TIDAL_API_BASE = resolveEnvString(importMetaEnv?.VITE_TIDAL_API_BASE) ?? resolveEnvString(nodeEnv?.TIDAL_API_BASE) ?? 'https://api.tidal.com/v1';
// Optional proxy server to avoid CORS and not expose server token; set VITE_TIDAL_PROXY=https://localhost:4000/api/tidal
const TIDAL_PROXY = resolveEnvString(importMetaEnv?.VITE_TIDAL_PROXY) ?? resolveEnvString(nodeEnv?.TIDAL_PROXY);
const USE_HIFI = resolveEnvString(importMetaEnv?.VITE_USE_HIFI) ?? resolveEnvString(nodeEnv?.VITE_USE_HIFI);
const hasProxy = TIDAL_PROXY !== null;
const hasToken = TIDAL_TOKEN !== null;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

type TrackSearchResponse = { tracks?: { items?: unknown[] } };
type ArtistSearchResponse = { artists?: { items?: unknown[] } };

const isTrackSearchResponse = (value: unknown): value is TrackSearchResponse => {
  if (typeof value !== 'object' || value === null) return false;
  return 'tracks' in value;
};

const isArtistSearchResponse = (value: unknown): value is ArtistSearchResponse => {
  if (typeof value !== 'object' || value === null) return false;
  return 'artists' in value;
};

export type Artist = {
  id: string;
  name: string;
  picture?: string;
  genre?: string;
};

export type Track = {
  id: string;
  title: string;
  album: {
    id?: string;
    cover?: string;
    title?: string;
  };
  artists: Artist[];
  duration?: number | string; // seconds or mm:ss
  previewUrl?: string;
  // Extra fields may exist but not required for UI
};

// Convert a LocalTrack (from our mock library) to the light Tidal track shape
const convertLocalToTidal = (t: LocalTrack): Track => {
  const title = typeof t.title === 'string' && t.title !== ''
    ? t.title
    : (typeof t.name === 'string' && t.name !== '' ? t.name : 'Unknown Title');
  const cover = typeof t.coverArt === 'string' && t.coverArt !== '' ? t.coverArt : (typeof t.coverImage === 'string' && t.coverImage !== '' ? t.coverImage : undefined);
  const albumTitle = typeof t.album === 'string' && t.album !== '' ? t.album : undefined;
  const duration = typeof t.duration === 'number'
    ? t.duration
    : (typeof t.duration === 'string' && t.duration !== '' ? t.duration : '0:00');

  return {
    id: t.id,
    title,
    album: { id: t.album, cover, title: albumTitle },
    artists: [{ id: `artist-${t.artist.toLowerCase().replace(/\s+/g, '-')}`, name: t.artist, picture: undefined }],
    duration,
  };
};

// Helper to format artist arrays to a single string
export const formatArtists = (artists: Artist[] | undefined | null): string => {
  if (artists === null || artists === undefined || artists.length === 0) return 'Unknown Artist';
  return artists.map(a => a.name).join(', ');
};

// A small duration formatter
export const formatDuration = (val?: number | string) => {
  if (val === undefined || val === null) return '0:00';
  const seconds = typeof val === 'number' ? val : (Number(val) || 0);
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

// Basic cover/artist picture derivation
export const getCoverUrl = (cover?: string, size = '80') => {
  if (cover === undefined || cover === null || cover === '') return `https://placehold.co/${size}x${size}/222/ffffff?text=No+Cover`;
  // If cover appears to already be a URL, return it
  try {
    new URL(cover);
    return cover;
  } catch {
    // fallback: construct a URL-like string or placeholder
    return `https://placehold.co/${size}x${size}/333/ffffff?text=${encodeURIComponent(cover)}`;
  }
};

export const getArtistPictureUrl = (picture?: string) => {
  if (picture === undefined || picture === null || picture === '') return 'https://placehold.co/80x80/777/ffffff?text=No+Pic';
  try {
    new URL(picture);
    return picture;
  } catch {
    return `https://placehold.co/80x80/777/ffffff?text=${encodeURIComponent(picture)}`;
  }
}

const extractPreviewUrl = (payload: Record<string, unknown>): string | undefined => {
  const candidates = [payload.previewUrl, payload.preview_url, payload.sample, payload.preview, payload.sampleUrl, payload.audioUrl];
  const match = candidates.find((value) => typeof value === 'string' && value.trim() !== '');
  return typeof match === 'string' ? match : undefined;
};

const hasItemsProperty = (value: unknown): value is { items?: unknown[] } => {
  return typeof value === 'object' && value !== null && 'items' in value;
};

const toItemsArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (hasItemsProperty(value) && Array.isArray(value.items)) {
    return value.items;
  }
  return [];
};

const mapRemoteTracks = (collection: unknown): Track[] => {
  const rawItems = isTrackSearchResponse(collection) && Array.isArray(collection.tracks?.items)
    ? collection.tracks.items
    : [];
  if (rawItems.length === 0) return [];

  return rawItems
    .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
    .map<Track>((t) => {
      const record: Record<string, unknown> = t;
      const albumValue = record.album;
      const album = typeof albumValue === 'object' && albumValue !== null ? (albumValue as Record<string, unknown>) : {};
      const albumId = typeof album.id === 'string' ? album.id : undefined;
      const albumTitle = typeof album.title === 'string' ? album.title : (typeof album.name === 'string' ? album.name : undefined);
      const albumCover = typeof album.cover === 'string'
        ? album.cover
        : (typeof album.coverUrl === 'string' ? album.coverUrl : undefined);

      const artistCollection = t.artists;
      const artists = toItemsArray(artistCollection);

      const durationRaw = record.duration ?? record.playbackLength ?? record.durationInSeconds;
      const duration = typeof durationRaw === 'number' && Number.isFinite(durationRaw)
        ? durationRaw
        : (typeof durationRaw === 'string' ? Number(durationRaw) || undefined : undefined);

      return {
        id: typeof t.id === 'string' ? t.id : 'unknown',
        title: typeof t.title === 'string' ? t.title : (typeof t.name === 'string' ? t.name : 'Unknown Title'),
        album: { id: albumId, cover: albumCover, title: albumTitle },
        artists: artists
          .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
          .map<Artist>((a) => ({ id: typeof a.id === 'string' ? a.id : 'unknown', name: typeof a.name === 'string' ? a.name : 'Unknown Artist' })),
        duration,
        previewUrl: extractPreviewUrl(t),
      };
    });
};

const mapRemoteArtists = (collection: unknown): Artist[] => {
  const rawItems = isArtistSearchResponse(collection) && Array.isArray(collection.artists?.items)
    ? collection.artists.items
    : [];
  if (rawItems.length === 0) return [];
  return rawItems
    .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
    .map<Artist>((a) => ({
      id: typeof a.id === 'string' ? a.id : 'unknown',
      name: typeof a.name === 'string' ? a.name : 'Unknown Artist',
      picture: typeof a.picture === 'string' ? a.picture : undefined,
    }));
};

// Map local music library functions into a Tidal-like interface
export const tidalService = {
  // Return a usable stream URL for a track id (uses the mock library's audioUrl where present)
  async getStreamUrl(trackId: string) {
    // Search the local library for the track and return audioUrl if present
    // If a TIDAL_PROXY is configured, prefer a proxy-based stream path
      if (hasProxy && TIDAL_PROXY !== null) {
      try {
        // Check if the proxy exposes a preview URL for us (returns JSON with previewUrl)
          const resp = await fetch(`${TIDAL_PROXY}/stream/${encodeURIComponent(trackId)}`);
        if (resp.ok) {
          const body: unknown = await resp.json();
          const preview = isRecord(body) ? extractPreviewUrl(body) : undefined;
          if (preview !== undefined) {
            // If hifi integration is enabled on the server, point users to its route
              const hifiEnabled = USE_HIFI === 'true';
            if (hifiEnabled) {
              return `${TIDAL_PROXY}/hifi-stream/${encodeURIComponent(trackId)}`;
            }
            // Ask the proxy to stream the audio; return the proxy stream endpoint (same-origin)
            return `${TIDAL_PROXY}/stream-proxy/${encodeURIComponent(trackId)}`;
          }
        }
      } catch (err) {
        // ignore proxy errors and fall back
      }
    }
      if (hasToken && TIDAL_TOKEN !== null) {
      try {
        const resp = await fetch(`${TIDAL_API_BASE}/tracks/${encodeURIComponent(trackId)}`, {
          headers: {
            Authorization: `Bearer ${TIDAL_TOKEN}`,
            Accept: 'application/json',
          },
        });
        if (resp.ok) {
          const body: unknown = await resp.json();
          if (isRecord(body)) {
            const preview = extractPreviewUrl(body);
            if (preview !== undefined) return preview;
          }
        }
      } catch (err) {
        // ignore API errors and fall back
      }
    }

    // No token or fallback case: use the local library search
    const results = await searchLocalTracks({ query: trackId, limit: 1 });
    const match = results.tracks.find((t: LocalTrack) => t.id === trackId) ?? results.tracks[0];
    // Fallback to a local match if available, otherwise return null to indicate no stream
    if (match === undefined) return null;
    const localUrl = typeof match.audioUrl === 'string' && match.audioUrl !== '' ? match.audioUrl : null;
    return localUrl;
  },

  // Search tracks and return a Tidal-like payload
  async searchTracks(query: string) {
    // If proxy is configured, call proxy search endpoint (server will add auth header)
    if (hasProxy && TIDAL_PROXY !== null) {
      try {
        const resp = await fetch(`${TIDAL_PROXY}/search?q=${encodeURIComponent(query)}&types=TRACKS&limit=35`);
        if (resp.ok) {
          const body: unknown = await resp.json();
          const tracks = mapRemoteTracks(body);
          return { items: tracks };
        } else {
          return { items: [], error: `Tidal proxy search returned ${resp.status} ${resp.statusText}` };
        }
      } catch (err) {
        // Return structured error payload so UI can show meaningful message
        return { items: [], error: `Proxy search failed: ${String(err)}` };
      }
    }
    // If we have a configured TIDAL token, call Tidal's search endpoint
    if (hasToken && TIDAL_TOKEN !== null) {
      try {
        const resp = await fetch(`${TIDAL_API_BASE}/search?query=${encodeURIComponent(query)}&types=TRACKS&limit=35`, {
          headers: { Authorization: `Bearer ${TIDAL_TOKEN}` },
        });
        if (!resp.ok) throw new Error(`Tidal search failed: ${resp.status} ${resp.statusText}`);
        const body: unknown = await resp.json();
        // Map Tidal response to our Track shape
        const tracks = mapRemoteTracks(body);
        return { items: tracks };
      } catch (err) {
        return { items: [], error: `Tidal API search failed: ${String(err)}` };
      }
    }

    const res = await searchLocalTracks({ query, limit: 35 });
    const items = res.tracks.map((t: LocalTrack) => convertLocalToTidal(t));
    return { items };
  },

  async searchArtists(query: string) {
    if (hasProxy && TIDAL_PROXY !== null) {
      try {
        const resp = await fetch(`${TIDAL_PROXY}/search?q=${encodeURIComponent(query)}&types=ARTISTS&limit=18`);
        if (resp.ok) {
          const body: unknown = await resp.json();
          const artists = mapRemoteArtists(body);
          return { items: artists };
        } else {
          return { items: [], error: `Tidal proxy artist search returned ${resp.status} ${resp.statusText}` };
        }
      } catch (err) {
        return { items: [], error: `Proxy artist search failed: ${String(err)}` };
      }
    }
    if (hasToken && TIDAL_TOKEN !== null) {
      try {
        const resp = await fetch(`${TIDAL_API_BASE}/search?query=${encodeURIComponent(query)}&types=ARTISTS&limit=18`, {
          headers: { Authorization: `Bearer ${TIDAL_TOKEN}` },
        });
        if (!resp.ok) throw new Error(`Tidal artist search failed: ${resp.status} ${resp.statusText}`);
        const body: unknown = await resp.json();
        const artists = mapRemoteArtists(body);
        return { items: artists };
      } catch (err) {
        return { items: [], error: `Tidal API artist search failed: ${String(err)}` };
      }
    }
    const artists = getAllArtists()
      .filter(name => name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 18)
      .map(name => ({ id: `artist-${name.toLowerCase().replace(/\s+/g, '-')}`, name, picture: undefined } as Artist));

    return { items: artists };
  },

  getCoverUrl,
  getArtistPictureUrl,
  formatDuration,
};

export default tidalService;

// Export small helper that indicates if we have a configured provider endpoint
export const isConfigured = hasProxy || hasToken;
