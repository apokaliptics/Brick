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

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(params: Record<string, string>): Promise<any> {
    const urlParams = new URLSearchParams({
      ...params,
      api_key: this.apiKey,
      format: 'json',
    });

    const response = await fetch(`${this.baseUrl}?${urlParams}`);
    if (!response.ok) {
      throw new Error(`Last.fm API error: ${response.status}`);
    }

    return response.json();
  }

  async getTrackInfo(artist: string, track: string): Promise<LastFmTrackInfo | null> {
    try {
      const data = await this.makeRequest({
        method: 'track.getInfo',
        artist,
        track,
      });

      if (data.track) {
        return {
          name: data.track.name,
          artist: data.track.artist.name,
          album: data.track.album?.title,
          duration: data.track.duration ? Math.floor(parseInt(data.track.duration) / 1000).toString() : undefined,
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching track info:', error);
      return null;
    }
  }

  async getArtistInfo(artist: string): Promise<LastFmArtistInfo | null> {
    try {
      // Try Wikipedia first for better biography
      const wikiResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artist)}`);
      if (wikiResponse.ok) {
        const wikiData = await wikiResponse.json();
        if (wikiData.extract && wikiData.extract.length > 100) {
          return {
            name: artist,
            bio: wikiData.extract,
            image: wikiData.thumbnail?.source,
            similar: [],
          };
        }
      }

      // Fallback to Last.fm
      const data = await this.makeRequest({
        method: 'artist.getInfo',
        artist,
      });

      if (data.artist) {
        return {
          name: data.artist.name,
          bio: data.artist.bio?.summary || data.artist.bio?.content,
          image: data.artist.image?.find((img: any) => img.size === 'large')?.['#text'],
          similar: data.artist.similar?.artist?.map((a: any) => a.name) || [],
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching artist info:', error);
      return null;
    }
  }

  async getLyrics(artist: string, track: string): Promise<string | null> {
    try {
      // Try Genius API first (requires API key)
      // For demo purposes, we'll use a lyrics API that doesn't require authentication
      const geniusResponse = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(`${artist} ${track}`)}`, {
        headers: {
          'Authorization': 'Bearer YOUR_GENIUS_ACCESS_TOKEN' // You'd need to get this from Genius
        }
      });

      if (geniusResponse.ok) {
        const geniusData = await geniusResponse.json();
        if (geniusData.response?.hits?.[0]?.result?.id) {
          const songId = geniusData.response.hits[0].result.id;
          const lyricsResponse = await fetch(`https://api.genius.com/songs/${songId}`, {
            headers: {
              'Authorization': 'Bearer YOUR_GENIUS_ACCESS_TOKEN'
            }
          });
          if (lyricsResponse.ok) {
            const lyricsData = await lyricsResponse.json();
            if (lyricsData.response?.song?.lyrics?.plain) {
              return lyricsData.response.song.lyrics.plain;
            }
          }
        }
      }

      // Fallback to Lyrics.ovh (free, no API key needed)
      const lyricsResponse = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(track)}`);
      if (lyricsResponse.ok) {
        const lyricsData = await lyricsResponse.json();
        if (lyricsData.lyrics) {
          return lyricsData.lyrics;
        }
      }

      console.log(`Lyrics not found for ${artist} - ${track}`);
      return null;
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      return null;
    }
  }

  sanitizeTitle(title: string): string {
    if (!title) return '';
    return title
      .replace(/\s*\([^)]*\)/g, '') // remove parentheses
      .replace(/\s*\[[^\]]*\]/g, '') // remove brackets
      .replace(/\s+-\s+.*$/g, '') // remove trailing descriptors
      .trim();
  }

  splitArtists(raw: string): string[] {
    if (!raw) return [];
    const delimiters = /(feat\.|featuring|ft\.|with|&|,|;|\+| x )/i;
    return raw
      .split(delimiters)
      .map(s => s.trim())
      .filter(s => s && !delimiters.test(s))
      .map(s => s.replace(/^and\s+/i, '').trim());
  }

  async getAlbumInfoLoose(artist: string, albumTitle: string, trackTitle?: string): Promise<LastFmAlbumInfo | null> {
    const primaryArtist = this.splitArtists(artist)[0] || artist;
    const cleanedAlbum = this.sanitizeTitle(albumTitle);
    const cleanedTrack = trackTitle ? this.sanitizeTitle(trackTitle) : undefined;

    const tryAlbum = async (artistName: string, title: string): Promise<LastFmAlbumInfo | null> => {
      if (!artistName || !title) return null;
      try {
        const data = await this.makeRequest({
          method: 'album.getInfo',
          artist: artistName,
          album: title,
        });
        if (data?.album) {
          return {
            title: data.album.name,
            artist: data.album.artist,
            summary: data.album.wiki?.summary,
            image: data.album.image?.find((img: any) => img.size === 'extralarge')?.['#text'] || data.album.image?.[0]?.['#text'],
            tracks: Array.isArray(data.album.tracks?.track)
              ? data.album.tracks.track.map((t: any) => ({ name: t.name, duration: Number(t.duration) || undefined }))
              : undefined,
          };
        }
      } catch (err) {
        console.warn('album.getInfo failed', artistName, title, err);
      }
      return null;
    };

    // Try with full album + primary artist
    let result = await tryAlbum(primaryArtist, cleanedAlbum || albumTitle);
    if (result) return result;

    // Try with raw album title
    result = await tryAlbum(primaryArtist, albumTitle);
    if (result) return result;

    // Try with track title as album hint (for single/ambiguous titles)
    if (cleanedTrack) {
      result = await tryAlbum(primaryArtist, cleanedTrack);
      if (result) return result;
    }

    // Wikipedia fallback with "Album" suffix to reduce ambiguity (e.g., Animals -> Animals (Pink Floyd album))
    try {
      const candidates = [
        `${cleanedAlbum || albumTitle} (${primaryArtist} album)`,
        `${albumTitle} (${primaryArtist} album)`,
        cleanedAlbum || albumTitle,
      ].filter(Boolean) as string[];

      for (const candidate of candidates) {
        const wiki = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate)}`);
        if (wiki.ok) {
          const data = await wiki.json();
          if (data?.title && data.extract) {
            return {
              title: data.title,
              artist: primaryArtist,
              summary: data.extract,
              image: data.thumbnail?.source,
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
