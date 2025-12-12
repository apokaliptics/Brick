import { SpotifyService } from './SpotifyService';
import { tidalService, isConfigured as isTidalConfigured } from './TidalService';
import { musicBrainzService } from './MusicBrainzService';

const PROVIDER = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_MUSIC_PROVIDER) || 'tidal';
export const CURRENT_PROVIDER = PROVIDER;

// Default wrapper to select provider
export const musicService = {
  async searchTracks(query: string) {
    console.log('[musicService] searchTracks', { provider: PROVIDER, query });
    if (PROVIDER === 'spotify' && SpotifyService.isConfigured) {
      return SpotifyService.searchTracks(query);
    }
    // Fallback logic: if tidal is not configured for this environment (no token/proxy), prefer MusicBrainz over local fallback
    if (!isTidalConfigured) {
      console.warn('[musicService] tidal is not configured; using MusicBrainz search');
      const mb = await musicBrainzService.searchTracks(query);
      return mb;
    }
    // fallback to tidal
    const resp = await tidalService.searchTracks(query);
    if ((resp as any).error || !(resp.items && resp.items.length>0)) {
      console.warn('[musicService] tidal search empty or error; falling back to MusicBrainz', (resp as any).error);
      const mb = await musicBrainzService.searchTracks(query);
      return mb;
    }
    return resp;
  },

  async searchArtists(query: string) {
    console.log('[musicService] searchArtists', { provider: PROVIDER, query });
    if (PROVIDER === 'spotify' && SpotifyService.isConfigured) {
      return SpotifyService.searchArtists(query);
    }
    // Prefer MusicBrainz if tidal isn't configured (avoid local fallback results)
    if (!isTidalConfigured) {
      console.warn('[musicService] tidal is not configured; using MusicBrainz artist search');
      const mb = await musicBrainzService.searchArtists(query);
      return mb;
    }
    const resp = await tidalService.searchArtists(query);
    if ((resp as any).error || !(resp.items && resp.items.length>0)) {
      console.warn('[musicService] tidal artist search empty or error; falling back to MusicBrainz', (resp as any).error);
      const mb = await musicBrainzService.searchArtists(query);
      return mb;
    }
    return resp;
  },

  async getStreamUrl(id: string) {
    console.log('[musicService] getStreamUrl', { provider: PROVIDER, id });
    if (PROVIDER === 'spotify' && SpotifyService.isConfigured) {
      return SpotifyService.getStreamUrl(id);
    }
    return tidalService.getStreamUrl(id);
  },

  getCoverUrl: tidalService.getCoverUrl,
  getArtistPictureUrl: tidalService.getArtistPictureUrl,
  formatDuration: tidalService.formatDuration,
};

export default musicService;