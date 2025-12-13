export interface User {
  id: string;
  name: string;
  avatar: string;
  bio?: string;
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
  description?: string;
  coverImage: string;
  customCoverImage?: string;
  trackCount: number;
  isPublic?: boolean;
  hiRes?: boolean;
  isLocked?: boolean;
  creator: string | {
    id: string;
    name: string;
    avatar: string;
  };
  creatorAvatar?: string;
  duration?: number;
  likes?: number;
  tracks?: Track[];
  structuralIntegrity?: number;
  deletionQueuedAt?: number;
  deletionScheduledFor?: number;
}

export interface Track {
  id: string;
  title?: string; // Optional
  name?: string; // Alternative to title
  artist: string;
  album: string;
  duration?: string;
  quality?: string;
  coverArt?: string;
  coverImage?: string; // Alternative to coverArt
  audioUrl?: string;
  isPatronage?: boolean;
  genre?: string;
  bitDepth?: number;
  sampleRate?: number;
  bitrateKbps?: number;
  bitrate?: number; // Allow both bitrate (kbps) and bitrateKbps for legacy
  codecLabel?: string;
  codec?: string; // Simple codec field
  file?: File;
  filePath?: string;
  isCloud?: boolean;
  cloudProvider?: string;
  cloudId?: string;
  accessToken?: string;
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
  data: unknown;
}

export type Screen = 'home' | 'radar' | 'vault' | 'profile' | 'feed';