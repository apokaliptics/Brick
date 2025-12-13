// @ts-nocheck
interface LastFmTrackInfo {
  name: string;
  artist: string;
  album?: string;
  duration?: string;
  lyrics?: string;
}

interface LastFmArtistInfo {
  name: string;
  bio?: string;
  image?: string;
  similar?: string[];
}

interface LastFmAlbumInfo {
  title: string;
  artist: string;
  summary?: string;
  image?: string;
  tracks?: Array<{ name: string; duration?: number }>;
}

class LastFmService {
  private apiKey: string;
  private baseUrl = 'https://ws.audioscrobbler.com/2.0/';
  private disabled: boolean;

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.disabled = !apiKey || apiKey === 'YOUR_LASTFM_API_KEY_HERE';
    if (this.disabled) {
      console.warn('Last.fm lookups are disabled (missing API key).');
    }
  }

  private async makeRequest<TResponse>(params: Record<string, string>): Promise<TResponse> {
    if (this.disabled) {
      throw new Error('Last.fm disabled');
    }
    const urlParams = new URLSearchParams({
      ...params,
      api_key: this.apiKey,
      format: 'json',
    });
    const queryString = urlParams.toString();

    const response = await fetch(`${this.baseUrl}?${queryString}`);
    if (!response.ok) {
      throw new Error(`Last.fm API error: ${response.status}`);
    }

    const data: unknown = await response.json();
    return data as TResponse;
  }

  async getTrackInfo(artist: string, track: string): Promise<LastFmTrackInfo | null> {
    if (this.disabled) return null;
    try {
      const data = await this.makeRequest<unknown>({
        method: 'track.getInfo',
        artist,
        track,
      });

      if (this.isRecord(data) && this.isRecord(data.track)) {
        const trackData = data.track;
        const trackName = typeof trackData.name === 'string' ? trackData.name : undefined;
        const artistName = this.isRecord(trackData.artist) && typeof trackData.artist.name === 'string' ? trackData.artist.name : undefined;
        const albumTitle = this.isRecord(trackData.album) && typeof trackData.album.title === 'string' ? trackData.album.title : undefined;
        const durationMs = typeof trackData.duration === 'string' ? Number(trackData.duration) : undefined;

        const hasTrackName = trackName !== undefined && trackName !== '';
        const hasArtistName = artistName !== undefined && artistName !== '';
        if (hasTrackName && hasArtistName) {
          return {
            name: trackName,
            artist: artistName,
            album: albumTitle,
            duration: typeof durationMs === 'number' && Number.isFinite(durationMs)
              ? Math.floor(durationMs / 1000).toString()
              : undefined,
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching track info:', error);
      return null;
    }
  }

  async getArtistInfo(artist: string): Promise<LastFmArtistInfo | null> {
    if (this.disabled) return null;
    try {
      // Try Wikipedia first for better biography
      const wikiResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artist)}`);
      if (wikiResponse.ok) {
        const wikiData: unknown = await wikiResponse.json();
        if (this.isRecord(wikiData) && typeof wikiData.extract === 'string' && wikiData.extract.length > 100) {
          return {
            name: artist,
            bio: wikiData.extract,
            image: this.isRecord(wikiData.thumbnail) && typeof wikiData.thumbnail.source === 'string' ? wikiData.thumbnail.source : undefined,
            similar: [],
          };
        }
      }

      // Fallback to Last.fm
      const data = await this.makeRequest<unknown>({
        method: 'artist.getInfo',
        artist,
      });

      if (this.isRecord(data) && this.isRecord(data.artist)) {
        return {
          name: typeof data.artist.name === 'string' ? data.artist.name : artist,
          bio: this.isRecord(data.artist.bio)
            ? (typeof data.artist.bio.summary === 'string' ? data.artist.bio.summary : (typeof data.artist.bio.content === 'string' ? data.artist.bio.content : undefined))
            : undefined,
          image: Array.isArray(data.artist.image)
            ? data.artist.image
                .filter((img: unknown): img is { size?: string; ['#text']?: string } => this.isRecord(img))
                .find((img) => img.size === 'large')?.['#text']
            : undefined,
          similar: this.isRecord(data.artist.similar) && Array.isArray(data.artist.similar.artist)
            ? data.artist.similar.artist
                .filter((a: unknown): a is { name?: string } => this.isRecord(a) && typeof a.name === 'string')
                .map((a) => a.name)
            : [],
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching artist info:', error);
      return null;
    }
  }

  async getLyrics(artist: string, track: string): Promise<string | null> {
    if (this.disabled) return null;
    try {
      // Try Genius API first (requires API key)
      // For demo purposes, we'll use a lyrics API that doesn't require authentication
      const geniusResponse = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(`${artist} ${track}`)}`, {
        headers: {
          'Authorization': 'Bearer YOUR_GENIUS_ACCESS_TOKEN' // You'd need to get this from Genius
        }
      });

      if (geniusResponse.ok) {
        const geniusData: unknown = await geniusResponse.json();
        const hits = this.isRecord(geniusData) && this.isRecord(geniusData.response) && Array.isArray(geniusData.response.hits)
          ? geniusData.response.hits
          : [];
        const firstHit = hits.find((hit: unknown): hit is { result: { id: number } } => this.isRecord(hit) && this.isRecord(hit.result) && typeof hit.result.id === 'number');
        if (firstHit !== undefined) {
          const songId = firstHit.result.id;
          if (songId === null) {
            return null;
          }
          const lyricsResponse = await fetch(`https://api.genius.com/songs/${songId}`, {
            headers: {
              'Authorization': 'Bearer YOUR_GENIUS_ACCESS_TOKEN'
            }
          });
          if (lyricsResponse.ok) {
            const lyricsData: unknown = await lyricsResponse.json();
            if (this.isRecord(lyricsData) && this.isRecord(lyricsData.response) && this.isRecord(lyricsData.response.song)) {
              const song = lyricsData.response.song;
              const lyrics = this.isRecord(song.lyrics) && typeof song.lyrics.plain === 'string' ? song.lyrics.plain : undefined;
              if (lyrics !== undefined && lyrics !== '') return lyrics;
            }
          }
        }
      }

      // Fallback to Lyrics.ovh (free, no API key needed)
      const lyricsResponse = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(track)}`);
      if (lyricsResponse.ok) {
        const lyricsData: unknown = await lyricsResponse.json();
        if (this.isRecord(lyricsData) && typeof lyricsData.lyrics === 'string') {
          return lyricsData.lyrics;
        }
      }

      console.warn(`Lyrics not found for ${artist} - ${track}`);
      return null;
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      return null;
    }
  }

  sanitizeTitle(title: string | null | undefined): string {
    if (typeof title !== 'string' || title.trim() === '') return '';
    return title
      .replace(/\s*\([^)]*\)/g, '') // remove parentheses
      .replace(/\s*\[[^\]]*\]/g, '') // remove brackets
      .replace(/\s+-\s+.*$/g, '') // remove trailing descriptors
      .trim();
  }

  splitArtists(raw: string | null | undefined): string[] {
    if (typeof raw !== 'string' || raw.trim() === '') return [];
    const delimiters = /(feat\.|featuring|ft\.|with|&|,|;|\+| x )/i;
    return raw
      .split(delimiters)
      .map(s => s.trim())
      .filter(s => s && !delimiters.test(s))
      .map(s => s.replace(/^and\s+/i, '').trim());
  }

  async getAlbumInfoLoose(artist: string, albumTitle: string, trackTitle?: string): Promise<LastFmAlbumInfo | null> {
    if (this.disabled) return null;
    const artistCandidates = this.splitArtists(artist);
    const primaryArtist = artistCandidates.length > 0 && artistCandidates[0] !== '' ? artistCandidates[0] : artist;
    const cleanedAlbum = this.sanitizeTitle(albumTitle);
    const cleanedTrack = typeof trackTitle === 'string' && trackTitle.trim() !== '' ? this.sanitizeTitle(trackTitle) : undefined;

    const tryAlbum = async (artistName: string, title: string): Promise<LastFmAlbumInfo | null> => {
      if (artistName === '' || title === '') return null;
      try {
        const data = await this.makeRequest<unknown>({
          method: 'album.getInfo',
          artist: artistName,
          album: title,
        });
        if (this.isRecord(data) && this.isRecord(data.album)) {
          const album = this.isRecord(data.album) ? data.album : {};
          return {
            title: typeof album.name === 'string' ? album.name : title,
            artist: typeof album.artist === 'string' ? album.artist : artistName,
            summary: this.isRecord(album.wiki) && typeof album.wiki.summary === 'string' ? album.wiki.summary : undefined,
            image: Array.isArray(album.image)
              ? album.image
                  .filter((img: unknown): img is { size?: string; ['#text']?: string } => this.isRecord(img))
                  .reduce<string | undefined>((acc, img) => {
                    if (acc !== undefined && acc !== '') return acc;
                    if (img.size === 'extralarge' && typeof img['#text'] === 'string') return img['#text'];
                    if (typeof img['#text'] === 'string') return img['#text'];
                    return undefined;
                  }, undefined)
              : undefined,
            tracks: this.isRecord(album.tracks)
              ? (() => {
                  const rawTracks = this.isRecord(album.tracks) ? album.tracks.track : undefined;
                  if (!Array.isArray(rawTracks)) return undefined;
                  return rawTracks
                    .filter((t): t is { name: string; duration?: unknown } => this.isRecord(t) && typeof t.name === 'string')
                    .map((t) => ({ name: t.name, duration: typeof t.duration === 'number' ? t.duration : Number(t.duration) || undefined }));
                })()
              : undefined,
          };
        }
      } catch (err) {
        console.warn('album.getInfo failed', artistName, title, err);
      }
      return null;
    };

    // Try with full album + primary artist
    const primaryAlbumTitle = cleanedAlbum !== '' ? cleanedAlbum : albumTitle;

    let result = await tryAlbum(primaryArtist, primaryAlbumTitle);
    if (result !== null) return result;

    // Try with raw album title
    result = await tryAlbum(primaryArtist, albumTitle);
    if (result !== null) return result;

    // Try with track title as album hint (for single/ambiguous titles)
    if (cleanedTrack !== undefined) {
      result = await tryAlbum(primaryArtist, cleanedTrack);
      if (result !== null) return result;
    }

    // Wikipedia fallback with "Album" suffix to reduce ambiguity (e.g., Animals -> Animals (Pink Floyd album))
    try {
      const candidates = [
        cleanedAlbum !== '' ? `${cleanedAlbum || albumTitle} (${primaryArtist} album)` : null,
        `${albumTitle} (${primaryArtist} album)`,
        cleanedAlbum && cleanedAlbum !== '' ? cleanedAlbum : albumTitle,
      ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate !== '');

      for (const candidate of candidates) {
        const wiki = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate)}`);
        if (wiki.ok) {
          const data: unknown = await wiki.json();
          if (this.isRecord(data) && typeof data.title === 'string' && typeof data.extract === 'string') {
            return {
              title: data.title,
              artist: primaryArtist,
              summary: data.extract,
              image: this.isRecord(data.thumbnail) && typeof data.thumbnail.source === 'string' ? data.thumbnail.source : undefined,
            };
          }
        }
      }
    } catch (err) {
      console.error('Wikipedia album fallback failed', err);
    }

    return null;
  }
}

// Create a singleton instance
// You'll need to get an API key from https://www.last.fm/api/account/create
const lastFmService = new LastFmService('YOUR_LASTFM_API_KEY_HERE');

export { lastFmService, type LastFmTrackInfo, type LastFmArtistInfo, type LastFmAlbumInfo };
