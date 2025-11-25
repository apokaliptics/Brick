export interface User {
  id: string;
  name: string;
  avatar: string;
  diversityScore: number;
  connectionsUsed: number;
  connectionsMax: number;
  tier: 'Sketcher' | 'Mason' | 'Architect';
  playlists: Playlist[];
  chosenArtists: Artist[];
}

export interface Artist {
  id: string;
  name: string;
  image: string;
  globalChosenUsers: number;
  genre: string;
}

export interface Playlist {
  id: string;
  name: string;
  coverImage: string;
  trackCount: number;
  isPublic: boolean;
  hiRes: boolean;
  creator: {
    id: string;
    name: string;
    avatar: string;
  };
  tracks?: Track[];
  structuralIntegrity?: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  quality: '128kbps' | '320kbps' | 'FLAC';
  coverArt: string;
  audioUrl?: string;
}

export interface Connection {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  matchScore: number;
  mutualArtists: string[];
  connectedDate: string;
}

export interface FeedEvent {
  id: string;
  type: 'playlist_created' | 'connection_formed' | 'patronage_update';
  timestamp: string;
  data: any;
}