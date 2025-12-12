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

const CLIENT_ID = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SPOTIFY_CLIENT_ID) || (typeof process !== 'undefined' && (process.env as any).VITE_SPOTIFY_CLIENT_ID);
const CLIENT_SECRET = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SPOTIFY_CLIENT_SECRET) || (typeof process !== 'undefined' && (process.env as any).SPOTIFY_CLIENT_SECRET);

let _token: string | null = null;
let _tokenExpires = 0;

async function getAccessToken(): Promise<string | null> {
  if (!_token || Date.now() >= _tokenExpires) {
    if (!CLIENT_ID || !CLIENT_SECRET) {
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
    const body = await res.json();
    _token = body.access_token;
    _tokenExpires = Date.now() + (body.expires_in || 3600) * 1000 - 60000; // expire 1 minute early
  }
  return _token;
}

// Internal helper for API GET
async function spotifyGet(endpoint: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Spotify not configured');
  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify API error ${res.status}`);
  return res.json();
}

export const formatDuration = (val?: number | string) => {
  if (!val && val !== 0) return '0:00';
  const seconds = typeof val === 'number' ? val : Number(val || 0);
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export const getCoverUrl = (cover?: string, size = '80') => {
  if (!cover) return `https://placehold.co/${size}x${size}/222/ffffff?text=No+Cover`;
  return cover;
};

export const getArtistPictureUrl = (picture?: string) => {
  if (!picture) return 'https://placehold.co/80x80/777/ffffff?text=No+Pic';
  return picture;
};

export const SpotifyService = {
  isConfigured: !!CLIENT_ID && !!CLIENT_SECRET,

  async searchTracks(query: string) {
    const q = encodeURIComponent(query);
    const body = await spotifyGet(`/search?q=${q}&type=track&limit=35`);
    const items = (body.tracks?.items || []).map((t: any): SpotifyTrack & { previewAvailable?: boolean } => ({
      id: String(t.id),
      title: t.name,
      album: { id: t.album?.id, cover: t.album?.images?.[0]?.url, title: t.album?.name },
      artists: (t.artists || []).map((a: any) => ({ id: String(a.id), name: a.name, picture: a.images?.[0]?.url })),
      duration: (t.duration_ms || 0) / 1000,
      preview_url: t.preview_url,
      previewAvailable: !!t.preview_url,
    }));
    return { items };
  },

  async searchArtists(query: string) {
    const q = encodeURIComponent(query);
    const body = await spotifyGet(`/search?q=${q}&type=artist&limit=20`);
    const items = (body.artists?.items || []).map((a: any) => ({ id: String(a.id), name: a.name, picture: a.images?.[0]?.url }));
    return { items };
  },

  async getStreamUrl(trackId: string) {
    // Spotify provides a `preview_url` field for tracks
    try {
      const body = await spotifyGet(`/tracks/${encodeURIComponent(trackId)}`);
      return body.preview_url || null;
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
