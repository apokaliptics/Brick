// MusicBrainz adapter for basic search (no auth, public) - simple mapping to our Track/Artist shape
import type { Track as TidalTrack, Artist as TidalArtist } from './TidalService';

export const musicBrainzService = {
  async searchTracks(query: string) {
    try {
      // Use a more targeted query with recording/artist fields where possible
      const qb = `recording:${query} OR artist:${query}`;
      const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(qb)}&fmt=json&limit=35`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'BrickApp/0.1 (dev@localhost)' } });
      if (!resp.ok) {
        return { items: [], error: `MusicBrainz search failed: ${resp.status} ${resp.statusText}` } as any;
      }
      const body = await resp.json();
      const items = (body.recordings || []).map((r: any) => {
        const artistName = (r['artist-credit'] && r['artist-credit'][0] && r['artist-credit'][0].name) || 'Unknown';
        const release = (r.releases && r.releases[0]) || null;
        const albumTitle = release ? release.title : 'Unknown Album';
        const releaseId = release ? release.id : null;
        const cover = releaseId ? `https://coverartarchive.org/release/${releaseId}/front-250` : undefined;
        return {
          id: r.id,
          title: r.title,
          album: { id: releaseId, cover: cover, title: albumTitle },
          artists: [{ id: `mb-${artistName.toLowerCase().replace(/\s+/g, '-')}`, name: artistName }],
          duration: r.length ? Math.floor(r.length / 1000) : undefined,
          previewUrl: undefined,
          previewAvailable: false,
        } as TidalTrack;
      });
      return { items };
    } catch (err) {
      return { items: [], error: `MusicBrainz search error: ${String(err)}` } as any;
    }
  },

  async searchArtists(query: string) {
    try {
      const url = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(query)}&fmt=json&limit=25`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'BrickApp/0.1 (dev@localhost)' } });
      if (!resp.ok) return { items: [], error: `MusicBrainz artist search failed: ${resp.status}` } as any;
      const body = await resp.json();
      const items = (body.artists || []).map((a: any) => ({ id: a.id, name: a.name, picture: undefined } as TidalArtist));
      return { items };
    } catch (err) {
      return { items: [], error: `MusicBrainz artist search error: ${String(err)}` } as any;
    }
  },
};

export default musicBrainzService;
