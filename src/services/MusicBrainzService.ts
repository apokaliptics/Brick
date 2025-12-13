// MusicBrainz adapter for basic search (no auth, public) - simple mapping to our Track/Artist shape
import type { Track as TidalTrack, Artist as TidalArtist } from './TidalService';

interface MusicBrainzRelease {
  id?: string;
  title?: string;
}

interface MusicBrainzArtistCredit {
  name?: string;
}

interface MusicBrainzRecording {
  id?: string;
  title?: string;
  length?: number;
  releases?: MusicBrainzRelease[];
  ['artist-credit']?: MusicBrainzArtistCredit[];
}

interface MusicBrainzRecordingResponse {
  recordings?: MusicBrainzRecording[];
}

interface MusicBrainzArtist {
  id?: string;
  name?: string;
}

interface MusicBrainzArtistResponse {
  artists?: MusicBrainzArtist[];
}

type TrackSearchResult = { items: TidalTrack[]; error?: string };
type ArtistSearchResult = { items: TidalArtist[]; error?: string };

export const musicBrainzService = {
  async searchTracks(query: string): Promise<TrackSearchResult> {
    try {
      // Use a more targeted query with recording/artist fields where possible
      const qb = `recording:${query} OR artist:${query}`;
      const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(qb)}&fmt=json&limit=35`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'BrickApp/0.1 (dev@localhost)' } });
      if (!resp.ok) {
        return { items: [], error: `MusicBrainz search failed: ${resp.status} ${resp.statusText}` };
      }
      const body: unknown = await resp.json();
      const recordings = (body as MusicBrainzRecordingResponse).recordings;
      const items = Array.isArray(recordings)
        ? recordings
            .filter((r): r is MusicBrainzRecording => typeof r === 'object' && r !== null)
            .map<TidalTrack>((r) => {
              const artistCredit = Array.isArray(r['artist-credit']) ? r['artist-credit'][0] : undefined;
              const artistName = typeof artistCredit?.name === 'string' ? artistCredit.name : 'Unknown';
              const release = Array.isArray(r.releases) ? r.releases[0] : undefined;
              const albumTitle = typeof release?.title === 'string' ? release.title : 'Unknown Album';
              const releaseId = typeof release?.id === 'string' ? release.id : undefined;
              const cover = releaseId !== undefined ? `https://coverartarchive.org/release/${releaseId}/front-250` : undefined;
              return {
                id: typeof r.id === 'string' ? r.id : `mb-${artistName.toLowerCase().replace(/\s+/g, '-')}`,
                title: typeof r.title === 'string' ? r.title : 'Unknown Title',
                album: { id: releaseId, cover, title: albumTitle },
                artists: [{ id: `mb-${artistName.toLowerCase().replace(/\s+/g, '-')}`, name: artistName }],
                duration: typeof r.length === 'number' && Number.isFinite(r.length) ? Math.floor(r.length / 1000) : undefined,
                previewUrl: undefined,
                previewAvailable: false,
              };
            })
        : [];
      return { items };
    } catch (err) {
      return { items: [], error: `MusicBrainz search error: ${String(err)}` };
    }
  },

  async searchArtists(query: string): Promise<ArtistSearchResult> {
    try {
      const url = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(query)}&fmt=json&limit=25`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'BrickApp/0.1 (dev@localhost)' } });
      if (!resp.ok) return { items: [], error: `MusicBrainz artist search failed: ${resp.status}` };
      const body: unknown = await resp.json();
      const artists = (body as MusicBrainzArtistResponse).artists;
      const items = Array.isArray(artists)
        ? artists
            .filter((a): a is MusicBrainzArtist => typeof a === 'object' && a !== null)
            .map<TidalArtist>((a) => ({
              id: typeof a.id === 'string' ? a.id : 'unknown',
              name: typeof a.name === 'string' ? a.name : 'Unknown Artist',
              picture: undefined,
            }))
        : [];
      return { items };
    } catch (err) {
      return { items: [], error: `MusicBrainz artist search error: ${String(err)}` };
    }
  },
};

export default musicBrainzService;
