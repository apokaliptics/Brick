// Lightweight TidalService mock/wrapper for the project
// This file implements the minimal API the UI expects: search tracks/artists, get cover/artist urls, and basic helpers.

import { Track as LocalTrack, Artist as LocalArtist } from '../types';
import { searchTracks as searchLocalTracks, getAllArtists } from '../utils/musicLibrary';

// Read vite env var for client-side use, fallback to process.env if present server-side
const TIDAL_TOKEN = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TIDAL_TOKEN) || (typeof process !== 'undefined' && (process.env as any).TIDAL_TOKEN);
const TIDAL_API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TIDAL_API_BASE) || (typeof process !== 'undefined' && (process.env as any).TIDAL_API_BASE) || 'https://api.tidal.com/v1';
// Optional proxy server to avoid CORS and not expose server token; set VITE_TIDAL_PROXY=https://localhost:4000/api/tidal
const TIDAL_PROXY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TIDAL_PROXY) || (typeof process !== 'undefined' && (process.env as any).TIDAL_PROXY);

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
const convertLocalToTidal = (t: LocalTrack): Track => ({
  id: t.id,
  title: t.title || t.name || 'Unknown Title',
  album: { id: t.album, cover: t.coverArt || t.coverImage, title: t.album },
  artists: [{ id: `artist-${t.artist.toLowerCase().replace(/\s+/g, '-')}`, name: t.artist, picture: undefined }],
  duration: typeof t.duration === 'number' ? t.duration : (t.duration || '0:00'),
});

// Helper to format artist arrays to a single string
export const formatArtists = (artists: Artist[] | undefined | null): string => {
  if (!artists || artists.length === 0) return 'Unknown Artist';
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
  if (!cover) return `https://placehold.co/${size}x${size}/222/ffffff?text=No+Cover`;
  // If cover appears to already be a URL, return it
  try {
    const url = new URL(cover);
    return cover;
  } catch (e) {
    // fallback: construct a URL-like string or placeholder
    return `https://placehold.co/${size}x${size}/333/ffffff?text=${encodeURIComponent(cover)}`;
  }
};

export const getArtistPictureUrl = (picture?: string) => {
  if (!picture) return 'https://placehold.co/80x80/777/ffffff?text=No+Pic';
  try {
    const url = new URL(picture);
    return picture;
  } catch (e) {
    return `https://placehold.co/80x80/777/ffffff?text=${encodeURIComponent(picture)}`;
  }
}

// Map local music library functions into a Tidal-like interface
export const tidalService = {
  // Return a usable stream URL for a track id (uses the mock library's audioUrl where present)
  async getStreamUrl(trackId: string) {
    console.log('[TidalService] getStreamUrl trackId', trackId, 'proxy=', !!TIDAL_PROXY, 'token=', !!TIDAL_TOKEN);
    // Search the local library for the track and return audioUrl if present
    // If a TIDAL_PROXY is configured, prefer a proxy-based stream path
    if (TIDAL_PROXY) {
      try {
        // Check if the proxy exposes a preview URL for us (returns JSON with previewUrl)
        const resp = await fetch(`${TIDAL_PROXY}/stream/${encodeURIComponent(trackId)}`);
        if (resp.ok) {
          const body = await resp.json();
          const preview = body.previewUrl || body.preview_url || body.sample || body.preview || null;
          if (preview) {
            // If hifi integration is enabled on the server, point users to its route
            const HIFI_ENABLED = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_USE_HIFI) || false;
            if (HIFI_ENABLED || (typeof window !== 'undefined' && (import.meta as any).env?.VITE_USE_HIFI)) {
              try {
                return `${TIDAL_PROXY}/hifi-stream/${encodeURIComponent(trackId)}`;
              } catch (e) {
                return `${TIDAL_PROXY}/stream-proxy/${encodeURIComponent(trackId)}`;
              }
            }
            // Ask the proxy to stream the audio; return the proxy stream endpoint (same-origin)
            return `${TIDAL_PROXY}/stream-proxy/${encodeURIComponent(trackId)}`;
          }
        }
      } catch (err) {
        console.warn('Tidal proxy track fetch failed', err);
      }
    }
    if (TIDAL_TOKEN) {
      try {
        const resp = await fetch(`${TIDAL_API_BASE}/tracks/${encodeURIComponent(trackId)}`, {
          headers: {
            Authorization: `Bearer ${TIDAL_TOKEN}`,
            Accept: 'application/json',
          },
        });
        if (resp.ok) {
          const body = await resp.json();
          // The Tidal API doesn't expose raw mp3 streams; return previewURL or some field if present
          if (body.previewUrl) return body.previewUrl;
          if (body.sample) return body.sample; // fallback
        }
      } catch (err) {
        console.warn('Tidal API stream lookup failed:', err);
      }
    }

    // No token or fallback case: use the local library search
    console.log('[TidalService] fallback to local search for stream', trackId);
    const results = await searchLocalTracks({ query: trackId, limit: 1 });
    const match = results.tracks.find((t: LocalTrack) => t.id === trackId) || results.tracks[0];
    // Fallback to a local match if available, otherwise return null to indicate no stream
    if (match) return (match.audioUrl || null);
    return null;
  },

  // Search tracks and return a Tidal-like payload
  async searchTracks(query: string) {
    console.log('[TidalService] searchTracks query', query, 'proxy=', !!TIDAL_PROXY, 'token=', !!TIDAL_TOKEN);
    // If proxy is configured, call proxy search endpoint (server will add auth header)
    if (TIDAL_PROXY) {
      try {
        const resp = await fetch(`${TIDAL_PROXY}/search?q=${encodeURIComponent(query)}&types=TRACKS&limit=35`);
        if (resp.ok) {
          const body = await resp.json();
          const tracks: Track[] = (body.tracks?.items || []).map((t: any) => ({
            id: String(t.id),
            title: t.title || t.name || 'Unknown Title',
            album: { id: t.album?.id, cover: t.album?.cover || t.album?.coverUrl, title: t.album?.title || t.album?.name },
            artists: (t.artists || t.artists?.items || []).map((a: any) => ({ id: String(a.id), name: a.name })),
            duration: t.duration || t.playbackLength || t.durationInSeconds || undefined,
            // Provide a quick preview/sample URL if available (but don't fetch audio content here)
            // We prefer to stream via proxy (same-origin) when configured.
            previewUrl: t.previewUrl || t.preview_url || t.sample || t.sampleUrl || undefined,
            previewAvailable: !!(t.previewUrl || t.preview_url || t.sample || t.sampleUrl || t.audioUrl || undefined),
          }));
          return { items: tracks };
        } else {
          return { items: [], error: `Tidal proxy search returned ${resp.status} ${resp.statusText}` } as any;
        }
      } catch (err) {
        console.warn('Tidal proxy search failed, falling back to direct search', err);
        // Return structured error payload so UI can show meaningful message
        return { items: [], error: `Proxy search failed: ${String(err)}` } as any;
      }
    }
    // If we have a configured TIDAL token, call Tidal's search endpoint
    if (TIDAL_TOKEN) {
      try {
        const resp = await fetch(`${TIDAL_API_BASE}/search?query=${encodeURIComponent(query)}&types=TRACKS&limit=35`, {
          headers: { Authorization: `Bearer ${TIDAL_TOKEN}` },
        });
        if (!resp.ok) throw new Error(`Tidal search failed: ${resp.status} ${resp.statusText}`);
        const body = await resp.json();
        // Map Tidal response to our Track shape
        const tracks: Track[] = (body.tracks?.items || []).map((t: any) => ({
          id: String(t.id),
          title: t.title || t.name || 'Unknown Title',
          album: { id: t.album?.id, cover: t.album?.cover || t.album?.coverUrl, title: t.album?.title || t.album?.name },
          artists: (t.artists || t.artists?.items || []).map((a: any) => ({ id: String(a.id), name: a.name })),
          duration: t.duration || t.playbackLength || t.durationInSeconds || undefined,
          previewUrl: t.previewUrl || t.preview_url || t.sample || t.sampleUrl || undefined,
          previewAvailable: !!(t.previewUrl || t.preview_url || t.sample || t.sampleUrl || t.audioUrl || undefined),
        }));
        return { items: tracks };
      } catch (err) {
        console.warn('Tidal search failed, falling back to local search', err);
        return { items: [], error: `Tidal API search failed: ${String(err)}` } as any;
      }
    }

    const res = await searchLocalTracks({ query, limit: 35 });
    console.log('[TidalService] local search result count', res.tracks.length);
    const items = res.tracks.map((t: LocalTrack) => convertLocalToTidal(t));
    return { items };
  },

  async searchArtists(query: string) {
    if (TIDAL_PROXY) {
      try {
        const resp = await fetch(`${TIDAL_PROXY}/search?q=${encodeURIComponent(query)}&types=ARTISTS&limit=18`);
        if (resp.ok) {
          const body = await resp.json();
          const artists = (body.artists?.items || []).map((a: any) => ({ id: String(a.id), name: a.name, picture: a.picture }));
          return { items: artists };
        } else {
          return { items: [], error: `Tidal proxy artist search returned ${resp.status} ${resp.statusText}` } as any;
        }
      } catch (err) {
        console.warn('Tidal proxy artist search failed, falling back to direct search', err);
        return { items: [], error: `Proxy artist search failed: ${String(err)}` } as any;
      }
    }
    if (TIDAL_TOKEN) {
      try {
        const resp = await fetch(`${TIDAL_API_BASE}/search?query=${encodeURIComponent(query)}&types=ARTISTS&limit=18`, {
          headers: { Authorization: `Bearer ${TIDAL_TOKEN}` },
        });
        if (!resp.ok) throw new Error(`Tidal artist search failed: ${resp.status} ${resp.statusText}`);
        const body = await resp.json();
        const artists = (body.artists?.items || []).map((a: any) => ({ id: String(a.id), name: a.name, picture: a.picture }));
        return { items: artists };
      } catch (err) {
        console.warn('Tidal artist search failed, falling back to local artist search', err);
        return { items: [], error: `Tidal API artist search failed: ${String(err)}` } as any;
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
export const isConfigured = !!TIDAL_PROXY || !!TIDAL_TOKEN;
