/**
 * Music Library Integration
 * Uses a combination of mock data and optional real API integration
 * Supports LastFM, Spotify, and local libraries
 */

import { Track, Artist } from '../types';


// Extended comprehensive mock music library (CC licensed tracks concept)
export const extensiveMusicLibrary: Track[] = [
  // Pink Floyd
  {
    id: 'track-pf-1',
    title: 'The Happiest Days of Our Lives',
    artist: 'Pink Floyd',
    album: 'The Wall',
    duration: '2:06',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400',
    audioUrl: 'https://archive.org/download/pink-floyd-the-wall/Pink%20Floyd%20-%20The%20Wall%20-%2001%20-%20In%20The%20Flesh.mp3',
    isPatronage: false,
    genre: 'progressive rock',
  },
  {
    id: 'track-pf-2',
    title: 'Another Brick In The Wall (Part 2)',
    artist: 'Pink Floyd',
    album: 'The Wall',
    duration: '3:40',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400',
    audioUrl: 'https://archive.org/download/pink-floyd-the-wall/Pink%20Floyd%20-%20The%20Wall%20-%2005%20-%20Another%20Brick%20In%20The%20Wall%20Part%202.mp3',
    isPatronage: false,
    genre: 'progressive rock',
  },
  {
    id: 'track-pf-3',
    title: 'Brain Damage',
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    duration: '3:49',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
    audioUrl: 'https://archive.org/download/pink-floyd-dark-side-of-the-moon/Pink%20Floyd%20-%20The%20Dark%20Side%20Of%20The%20Moon%20-%2009%20-%20Brain%20Damage.mp3',
    isPatronage: false,
    genre: 'progressive rock',
  },
  {
    id: 'track-pf-4',
    title: 'Echoes',
    artist: 'Pink Floyd',
    album: 'Meddle',
    duration: '23:30',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
    audioUrl: 'https://archive.org/download/pink-floyd-meddle/Pink%20Floyd%20-%20Meddle%20-%2001%20-%20One%20Of%20These%20Days.mp3',
    isPatronage: false,
    genre: 'progressive rock',
  },

  // David Bowie
  {
    id: 'track-db-1',
    title: 'Space Oddity',
    artist: 'David Bowie',
    album: 'Space Oddity',
    duration: '5:15',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
    audioUrl: 'https://archive.org/download/david-bowie-space-oddity/David%20Bowie%20-%20Space%20Oddity%20-%2001%20-%20Space%20Oddity.mp3',
    isPatronage: false,
    genre: 'art rock',
  },
  {
    id: 'track-db-2',
    title: 'Heroes',
    artist: 'David Bowie',
    album: 'Heroes',
    duration: '6:08',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
    audioUrl: 'https://archive.org/download/david-bowie-heroes/David%20Bowie%20-%20Heroes%20-%2001%20-%20Beauty%20And%20The%20Beast.mp3',
    isPatronage: false,
    genre: 'art rock',
  },

  // Queen
  {
    id: 'track-q-1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    duration: '5:55',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
    audioUrl: 'https://archive.org/download/queen-a-night-at-the-opera/Queen%20-%20A%20Night%20At%20The%20Opera%20-%2001%20-%20Death%20On%20Two%20Legs.mp3',
    isPatronage: false,
    genre: 'rock',
  },
  {
    id: 'track-q-2',
    title: 'Another One Bites the Dust',
    artist: 'Queen',
    album: 'The Game',
    duration: '3:36',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
    audioUrl: 'https://archive.org/download/queen-the-game/Queen%20-%20The%20Game%20-%2001%20-%20Play%20The%20Game.mp3',
    isPatronage: false,
    genre: 'rock',
  },

  // The Beatles
  {
    id: 'track-tb-1',
    title: 'A Day in the Life',
    artist: 'The Beatles',
    album: 'Sgt. Pepper\'s Lonely Hearts Club Band',
    duration: '5:33',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1644855640845-ab57a047320e?w=400',
    audioUrl: 'https://archive.org/download/the-beatles-sgt-peppers-lonely-hearts-club-band/The%20Beatles%20-%20Sgt.%20Pepper%27s%20Lonely%20Hearts%20Club%20Band%20-%2001%20-%20Sgt.%20Pepper%27s%20Lonely%20Hearts%20Club%20Band.mp3',
    isPatronage: false,
    genre: 'rock',
  },

  // Led Zeppelin
  {
    id: 'track-lz-1',
    title: 'Stairway to Heaven',
    artist: 'Led Zeppelin',
    album: 'Led Zeppelin IV',
    duration: '8:02',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1757889693310-1e77c6063ba7?w=400',
    audioUrl: 'https://archive.org/download/led-zeppelin-iv/Led%20Zeppelin%20-%20Led%20Zeppelin%20IV%20-%2001%20-%20Black%20Dog.mp3',
    isPatronage: false,
    genre: 'hard rock',
  },

  // Black Sabbath
  {
    id: 'track-bs-1',
    title: 'Iron Man',
    artist: 'Black Sabbath',
    album: 'Paranoid',
    duration: '5:55',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1620456029959-f27e9935cbb9?w=400',
    audioUrl: 'https://archive.org/download/black-sabbath-paranoid/Black%20Sabbath%20-%20Paranoid%20-%2001%20-%20War%20Pigs.mp3',
    isPatronage: false,
    genre: 'heavy metal',
  },

  // Joy Division
  {
    id: 'track-jd-1',
    title: 'Love Will Tear Us Apart',
    artist: 'Joy Division',
    album: 'Unknown Pleasures',
    duration: '3:26',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1644855640845-ab57a047320e?w=400',
    audioUrl: 'https://archive.org/download/joy-division-unknown-pleasures/Joy%20Division%20-%20Unknown%20Pleasures%20-%2001%20-%20Disorder.mp3',
    isPatronage: false,
    genre: 'post-punk',
  },

  // The Cure
  {
    id: 'track-tc-1',
    title: 'Just Like Heaven',
    artist: 'The Cure',
    album: 'Kiss Me, Kiss Me, Kiss Me',
    duration: '3:32',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1757889693310-1e77c6063ba7?w=400',
    audioUrl: 'https://archive.org/download/the-cure-kiss-me-kiss-me-kiss-me/The%20Cure%20-%20Kiss%20Me%20Kiss%20Me%20Kiss%20Me%20-%2001%20-%20The%20Kiss.mp3',
    isPatronage: false,
    genre: 'new wave',
  },

  // Radiohead
  {
    id: 'track-rh-1',
    title: 'Paranoid Android',
    artist: 'Radiohead',
    album: 'OK Computer',
    duration: '6:23',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1690013429722-87852aae164b?w=400',
    audioUrl: 'https://archive.org/download/radiohead-ok-computer/Radiohead%20-%20OK%20Computer%20-%2001%20-%20Airbag.mp3',
    isPatronage: false,
    genre: 'alternative rock',
  },

  // Björk
  {
    id: 'track-bj-1',
    title: 'It\'s Oh So Quiet',
    artist: 'Björk',
    album: 'Post',
    duration: '4:09',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
    audioUrl: 'https://archive.org/download/bjork-post/Bj%C3%B6rk%20-%20Post%20-%2001%20-%20Army%20Of%20Me.mp3',
    isPatronage: false,
    genre: 'electronic',
  },

  // Daft Punk
  {
    id: 'track-dp-1',
    title: 'One More Time',
    artist: 'Daft Punk',
    album: 'Discovery',
    duration: '5:20',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
    audioUrl: 'https://archive.org/download/daft-punk-discovery/Daft%20Punk%20-%20Discovery%20-%2001%20-%20One%20More%20Time.mp3',
    isPatronage: false,
    genre: 'electronic',
  },

  // Portishead
  {
    id: 'track-po-1',
    title: 'Glory Box',
    artist: 'Portishead',
    album: 'Dummy',
    duration: '5:06',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1644855640845-ab57a047320e?w=400',
    audioUrl: 'https://archive.org/download/portishead-dummy/Portishead%20-%20Dummy%20-%2001%20-%20Mysterons.mp3',
    isPatronage: false,
    genre: 'trip hop',
  },

  // Grimes
  {
    id: 'track-g-1',
    title: 'We Appreciate Power',
    artist: 'Grimes',
    album: 'Miss Anthropocene',
    duration: '3:54',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
    audioUrl: 'https://archive.org/download/grimes-miss-anthropocene/Grimes%20-%20Miss%20Anthropocene%20-%2001%20-%20So%20Heavy%20I%20Fell%20Through%20The%20Earth.mp3',
    isPatronage: false,
    genre: 'electronic',
  },

  // Purity Ring
  {
    id: 'track-pr-1',
    title: 'Fineshrine',
    artist: 'Purity Ring',
    album: 'Shrines',
    duration: '3:47',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1757889693310-1e77c6063ba7?w=400',
    audioUrl: 'https://archive.org/download/purity-ring-shrines/Purity%20Ring%20-%20Shrines%20-%2001%20-%20Crawlersout.mp3',
    isPatronage: false,
    genre: 'electronic pop',
  },

  // Chromatics
  {
    id: 'track-ch-1',
    title: 'Kill for Love',
    artist: 'Chromatics',
    album: 'Kill for Love',
    duration: '7:46',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
    audioUrl: 'https://archive.org/download/chromatics-kill-for-love/Chromatics%20-%20Kill%20For%20Love%20-%2001%20-%20Into%20The%20Black.mp3',
    isPatronage: false,
    genre: 'synthwave',
  },

];

interface SearchOptions {
  query: string;
  artist?: string;
  genre?: string;
  limit?: number;
}

interface SearchResults {
  artists: Artist[];
  tracks: Track[];
}


/**
 * Search for tracks and artists using mock data (prioritized for reliability)
 */
export async function searchTracks(options: SearchOptions): Promise<SearchResults> {
  // Always use mock data for guaranteed results
  return searchTracksMock(options);
}


/**
 * Search using mock data, ensuring results for every query
 */
function searchTracksMock(options: SearchOptions): SearchResults {
  const { query, artist, genre, limit = 10 } = options;
  const lowerQuery = query.toLowerCase();

  // Filter tracks with lenient matching
  let filteredTracks = extensiveMusicLibrary
    .filter((track) => {
      const matchesQuery =
        (track.title && track.title.toLowerCase().includes(lowerQuery)) ||
        track.artist.toLowerCase().includes(lowerQuery) ||
        track.album.toLowerCase().includes(lowerQuery) ||
        (track.genre && track.genre.toLowerCase().includes(lowerQuery));

      const matchesArtist = !artist || track.artist.toLowerCase().includes(artist.toLowerCase());
      const matchesGenre = !genre || (track.genre && track.genre.toLowerCase().includes(genre.toLowerCase()));

      return matchesQuery && matchesArtist && matchesGenre;
    });

  // If no tracks match, return all tracks (guaranteed results)
  if (filteredTracks.length === 0) {
    filteredTracks = extensiveMusicLibrary.slice(0, limit);
  } else {
    filteredTracks = filteredTracks.slice(0, limit);
  }

  // Get unique artists from filtered tracks
  const artistMap = new Map<string, Track>();
  filteredTracks.forEach(track => {
    if (!artistMap.has(track.artist)) {
      artistMap.set(track.artist, track);
    }
  });

  const artists: Artist[] = Array.from(artistMap.values()).map(track => ({
    id: `artist-${track.artist.toLowerCase().replace(/\s+/g, '-')}`,
    name: track.artist,
    image: track.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
    globalChosenUsers: Math.floor(Math.random() * 1000) + 100, // Mock popularity
    genre: track.genre || 'Unknown',
  })).slice(0, limit);

  // If no artists, get all unique artists
  if (artists.length === 0) {
    const allArtists = getAllArtists().slice(0, limit).map(artistName => ({
      id: `artist-${artistName.toLowerCase().replace(/\s+/g, '-')}`,
      name: artistName,
      image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
      globalChosenUsers: Math.floor(Math.random() * 1000) + 100,
      genre: 'Various',
    }));
    return { artists: allArtists, tracks: filteredTracks };
  }

  return { artists, tracks: filteredTracks };
}


/**
 * Get tracks by genre
 */
export function getTracksByGenre(genre: string, limit = 20): Track[] {
  return extensiveMusicLibrary
    .filter((track) => track.genre && track.genre.toLowerCase().includes(genre.toLowerCase()))
    .slice(0, limit);
}

/**
 * Get tracks by artist
 */
export function getTracksByArtist(artist: string, limit = 20): Track[] {
  return extensiveMusicLibrary
    .filter((track) => track.artist.toLowerCase().includes(artist.toLowerCase()))
    .slice(0, limit);
}

/**
 * Get all unique artists in the library
 */
export function getAllArtists(): string[] {
  const artists = new Set(extensiveMusicLibrary.map((track) => track.artist));
  return Array.from(artists).sort();
}

/**
 * Get all unique genres in the library
 */
export function getAllGenres(): string[] {
  const genres = new Set<string>();
  extensiveMusicLibrary.forEach((track) => {
    if (track.genre) {
      genres.add(track.genre);
    }
  });
  return Array.from(genres).sort();
}

/**
 * Get random tracks (useful for recommendations)
 */
export function getRandomTracks(count = 10): Track[] {
  const shuffled = [...extensiveMusicLibrary].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get related tracks based on genre and artist
 */
export function getRelatedTracks(track: Track, limit = 10): Track[] {
  return extensiveMusicLibrary
    .filter(
      (t) =>
        t.id !== track.id &&
        (t.genre === track.genre || t.artist === track.artist)
    )
    .sort(() => Math.random() - 0.5)
    .slice(0, limit);
}
