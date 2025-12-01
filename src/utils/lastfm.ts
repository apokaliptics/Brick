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
}

// Create a singleton instance
// You'll need to get an API key from https://www.last.fm/api/account/create
const lastFmService = new LastFmService('YOUR_LASTFM_API_KEY_HERE');

export { lastFmService, type LastFmTrackInfo, type LastFmArtistInfo };
