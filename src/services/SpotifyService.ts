// @ts-nocheck
// SpotifyService: Minimal client credentials wrapper for Spotify Web API
// NOTE: For production, never expose client secret to the client. Use a server-side proxy.

export type SpotifyArtist = { id: string; name: string; picture?: string };
export type SpotifyTrack = {
  id: string;
  title: string;
  album: { id?: string; cover?: string; title?: string };
  artists: SpotifyArtist[];
  duration?: number | string; // seconds
  preview_url?: string | null;
};

const importMetaEnv = typeof import.meta !== 'undefined' && typeof (import.meta as { env?: unknown }).env === 'object'
  ? (import.meta as { env?: Record<string, unknown> }).env
  : undefined;
const nodeEnv = typeof process !== 'undefined' && typeof process.env === 'object'
  ? process.env as Record<string, unknown>
  : undefined;

const resolveEnvString = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

const CLIENT_ID = resolveEnvString(importMetaEnv?.VITE_SPOTIFY_CLIENT_ID) ?? resolveEnvString(nodeEnv?.VITE_SPOTIFY_CLIENT_ID);
const CLIENT_SECRET = resolveEnvString(importMetaEnv?.VITE_SPOTIFY_CLIENT_SECRET) ?? resolveEnvString(nodeEnv?.SPOTIFY_CLIENT_SECRET);

let _token: string | null = null;
let _tokenExpires = 0;

async function getAccessToken(): Promise<string | null> {
  if (_token === null || Date.now() >= _tokenExpires) {
    if (CLIENT_ID === null || CLIENT_SECRET === null) {
      return null; // Not configured
    }
    const auth = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      console.warn('Spotify token request failed', res.status);
      return null;
    }
    const body: unknown = await res.json();
    const accessToken = typeof (body as Record<string, unknown>).access_token === 'string' ? (body as Record<string, unknown>).access_token : null;
    const expiresIn = typeof (body as Record<string, unknown>).expires_in === 'number' ? (body as Record<string, unknown>).expires_in : 3600;
    if (accessToken === null) {
      return null;
    }
    _token = accessToken;
    _tokenExpires = Date.now() + expiresIn * 1000 - 60000; // expire 1 minute early
  }
  return _token;
}

// Internal helper for API GET
async function spotifyGet(endpoint: string): Promise<unknown> {
  const token = await getAccessToken();
  if (token === null) throw new Error('Spotify not configured');
  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify API error ${res.status}`);
  const body: unknown = await res.json();
  return body;
}

export const formatDuration = (val?: number | string) => {
  if (val === undefined || val === null) return '0:00';
  const seconds = typeof val === 'number' ? val : Number(val || 0);
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export const getCoverUrl = (cover?: string, size = '80') => {
  if (cover === undefined || cover === null || cover === '') return `https://placehold.co/${size}x${size}/222/ffffff?text=No+Cover`;
  return cover;
};

export const getArtistPictureUrl = (picture?: string) => {
  if (picture === undefined || picture === null || picture === '') return 'https://placehold.co/80x80/777/ffffff?text=No+Pic';
  return picture;
};

export const SpotifyService = {
  isConfigured: CLIENT_ID !== null && CLIENT_SECRET !== null,

  async searchTracks(query: string) {
    const q = encodeURIComponent(query);
    const body = await spotifyGet(`/search?q=${q}&type=track&limit=35`);
    const trackItems = typeof body === 'object' && body !== null && 'tracks' in body && typeof (body as Record<string, unknown>).tracks === 'object' && (body as { tracks?: { items?: unknown[] } }).tracks?.items;
    const items = Array.isArray(trackItems)
      ? trackItems
          .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
          .map<SpotifyTrack & { previewAvailable?: boolean }>((t) => {
            const album = typeof t.album === 'object' && t.album !== null ? t.album as Record<string, unknown> : {};
            const images = Array.isArray((album as { images?: unknown }).images) ? (album as { images?: Array<Record<string, unknown>> }).images : [];
            const artists = Array.isArray(t.artists) ? t.artists : [];
            const durationMs = typeof t.duration_ms === 'number' ? t.duration_ms : 0;
            const previewUrl = typeof t.preview_url === 'string' ? t.preview_url : null;
            const title = typeof t.name === 'string' ? t.name : 'Unknown Title';
            const id = typeof t.id === 'string' ? t.id : title;
            return {
              id,
              title,
              album: {
                id: typeof album.id === 'string' ? album.id : undefined,
                cover: typeof images?.[0]?.url === 'string' ? images[0].url : undefined,
                title: typeof album.name === 'string' ? album.name : undefined,
              },
              artists: artists
                .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
                .map<SpotifyArtist>((a) => ({
                  id: typeof a.id === 'string' ? a.id : 'unknown',
                  name: typeof a.name === 'string' ? a.name : 'Unknown Artist',
                  picture: Array.isArray((a as { images?: unknown }).images) && typeof (a as { images: Array<Record<string, unknown>> }).images[0]?.url === 'string'
                    ? (a as { images: Array<Record<string, unknown>> }).images[0].url
                    : undefined,
                })),
              duration: durationMs / 1000,
              preview_url: previewUrl,
              previewAvailable: previewUrl !== null && previewUrl !== '',
            };
          })
      : [];
    return { items };
  },

  async searchArtists(query: string) {
    const q = encodeURIComponent(query);
    const body = await spotifyGet(`/search?q=${q}&type=artist&limit=20`);
    const artistItems = typeof body === 'object' && body !== null && 'artists' in body && typeof (body as Record<string, unknown>).artists === 'object' && (body as { artists?: { items?: unknown[] } }).artists?.items;
    const items = Array.isArray(artistItems)
      ? artistItems
          .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
          .map<SpotifyArtist>((a) => {
            const images = Array.isArray((a as { images?: unknown }).images) ? (a as { images: Array<Record<string, unknown>> }).images : [];
            return {
              id: typeof a.id === 'string' ? a.id : 'unknown',
              name: typeof a.name === 'string' ? a.name : 'Unknown Artist',
              picture: typeof images?.[0]?.url === 'string' ? images[0].url : undefined,
            };
          })
      : [];
    return { items };
  },

  async getStreamUrl(trackId: string) {
    // Spotify provides a `preview_url` field for tracks
    try {
      const body = await spotifyGet(`/tracks/${encodeURIComponent(trackId)}`);
      const previewUrl = typeof (body as Record<string, unknown>).preview_url === 'string' ? (body as Record<string, unknown>).preview_url : null;
      if (previewUrl === null || previewUrl === '') return null;
      return previewUrl;
    } catch (e) {
      console.warn('Spotify getStreamUrl failed', e);
      return null;
    }
  },

  formatDuration,
  getCoverUrl,
  getArtistPictureUrl,
};

export default SpotifyService;
