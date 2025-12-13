// @ts-nocheck
import { musicBrainzService } from './MusicBrainzService';
import { SpotifyService, type SpotifyArtist, type SpotifyTrack } from './SpotifyService';
import { tidalService, isConfigured as isTidalConfigured, type Artist, type Track } from './TidalService';

type TrackSearchResult = { items: Track[]; error?: string };
type ArtistSearchResult = { items: Artist[]; error?: string };

const providerFromEnv = (): string => {
  const metaProviderRaw: unknown = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_MUSIC_PROVIDER : undefined;
  if (typeof metaProviderRaw === 'string' && metaProviderRaw !== '') {
    return metaProviderRaw;
  }
  const nodeProviderRaw: unknown = typeof process !== 'undefined' ? process.env?.VITE_MUSIC_PROVIDER : undefined;
  if (typeof nodeProviderRaw === 'string' && nodeProviderRaw !== '') {
    return nodeProviderRaw;
  }
  return 'tidal';
};

const PROVIDER = providerFromEnv();
export const CURRENT_PROVIDER = PROVIDER;

const hasItems = <T>(resp: unknown): resp is { items: T[] } => {
  if (resp === null || resp === undefined || typeof resp !== 'object') return false;
  return Array.isArray((resp as { items?: unknown }).items);
};

const normalizeSpotifyTrack = (track: SpotifyTrack): Track => ({
  id: track.id,
  title: track.title,
  album: { id: track.album?.id, cover: track.album?.cover, title: track.album?.title },
  artists: (Array.isArray(track.artists) ? track.artists : []).map((a: SpotifyArtist) => ({ id: a.id, name: a.name, picture: a.picture })),
  duration: track.duration,
  previewUrl: typeof track.preview_url === 'string' && track.preview_url !== '' ? track.preview_url : undefined,
  previewAvailable: typeof track.preview_url === 'string' && track.preview_url !== '',
});

const isTrackLike = (item: unknown): item is Track => {
  if (item === null || item === undefined || typeof item !== 'object') return false;
  return 'id' in (item as Record<string, unknown>);
};

const isArtistLike = (item: unknown): item is Artist => {
  if (item === null || item === undefined || typeof item !== 'object') return false;
  const candidate = item as Record<string, unknown>;
  return 'id' in candidate && 'name' in candidate;
};

const toTrackResult = (resp: unknown): TrackSearchResult => {
  if (resp === null || resp === undefined || typeof resp !== 'object') return { items: [] };
  const candidate = resp as { items?: unknown; error?: unknown };
  const items = Array.isArray(candidate.items) ? candidate.items.filter(isTrackLike) : [];
  const errorValue = typeof candidate.error === 'string' ? candidate.error : '';
  const error = errorValue !== '' ? errorValue : undefined;
  const hasErrorMessage = error !== undefined;
  return { items, ...(hasErrorMessage ? { error } : {}) };
};

const toArtistResult = (resp: unknown): ArtistSearchResult => {
  if (resp === null || resp === undefined || typeof resp !== 'object') return { items: [] };
  const candidate = resp as { items?: unknown; error?: unknown };
  const items = Array.isArray(candidate.items) ? candidate.items.filter(isArtistLike) : [];
  const errorValue = typeof candidate.error === 'string' ? candidate.error : '';
  const error = errorValue !== '' ? errorValue : undefined;
  const hasErrorMessage = error !== undefined;
  return { items, ...(hasErrorMessage ? { error } : {}) };
};

const shouldFallbackTracks = (resp: unknown) => {
  const normalized = toTrackResult(resp);
  const errorMessage = typeof normalized.error === 'string' ? normalized.error : '';
  const hasError = errorMessage !== '';
  const hasNonEmptyItems = normalized.items.length > 0;
  return hasError || !hasNonEmptyItems;
};

const shouldFallbackArtists = (resp: unknown) => {
  const normalized = toArtistResult(resp);
  const errorMessage = typeof normalized.error === 'string' ? normalized.error : '';
  const hasError = errorMessage !== '';
  const hasNonEmptyItems = normalized.items.length > 0;
  return hasError || !hasNonEmptyItems;
};

// Default wrapper to select provider
export const musicService = {
  async searchTracks(query: string): Promise<TrackSearchResult> {
    if (PROVIDER === 'spotify' && SpotifyService.isConfigured) {
      const spotify: unknown = await SpotifyService.searchTracks(query);
      const items = hasItems<SpotifyTrack>(spotify) ? spotify.items.map(normalizeSpotifyTrack) : [];
      return { items };
    }
    if (!isTidalConfigured) {
      console.warn('[musicService] tidal is not configured; using MusicBrainz search');
      return musicBrainzService.searchTracks(query);
    }

    const resp: unknown = await tidalService.searchTracks(query);
    const normalized = toTrackResult(resp);
    if (shouldFallbackTracks(resp)) {
      console.warn('[musicService] tidal search empty or error; falling back to MusicBrainz', normalized.error);
      return musicBrainzService.searchTracks(query);
    }
    return normalized;
  },

  async searchArtists(query: string): Promise<ArtistSearchResult> {
    if (PROVIDER === 'spotify' && SpotifyService.isConfigured) {
      const spotify: unknown = await SpotifyService.searchArtists(query);
      return hasItems<Artist>(spotify) ? { items: spotify.items } : { items: [] };
    }
    if (!isTidalConfigured) {
      console.warn('[musicService] tidal is not configured; using MusicBrainz artist search');
      return musicBrainzService.searchArtists(query);
    }

    const resp: unknown = await tidalService.searchArtists(query);
    const normalized = toArtistResult(resp);
    if (shouldFallbackArtists(resp)) {
      console.warn('[musicService] tidal artist search empty or error; falling back to MusicBrainz', normalized.error);
      return musicBrainzService.searchArtists(query);
    }
    return normalized;
  },

  async getStreamUrl(id: string): Promise<string | null> {
    if (PROVIDER === 'spotify' && SpotifyService.isConfigured) {
      const spotifyUrl: unknown = await SpotifyService.getStreamUrl(id);
      if (typeof spotifyUrl === 'string') return spotifyUrl;
      return null;
    }
    const tidalUrl: unknown = await tidalService.getStreamUrl(id);
    if (typeof tidalUrl === 'string') return tidalUrl;
    return null;
  },

  getCoverUrl: tidalService.getCoverUrl,
  getArtistPictureUrl: tidalService.getArtistPictureUrl,
  formatDuration: tidalService.formatDuration,
};

export default musicService;