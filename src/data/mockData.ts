import { User, Artist, Playlist, Connection, FeedEvent, Track } from '../types';

export const mockCurrentUser: User = {
  id: 'user-1',
  name: 'Alex Morgan',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
  diversityScore: 92,
  connectionsUsed: 12,
  connectionsMax: 20,
  tier: 'Mason',
  playlists: [],
  chosenArtists: [],
};

export const mockArtists: Artist[] = [
  {
    id: 'artist-1',
    name: 'Pink Floyd',
    image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800',
    globalChosenUsers: 234567,
    genre: 'Progressive Rock',
  },
  {
    id: 'artist-2',
    name: 'David Bowie',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800',
    globalChosenUsers: 198432,
    genre: 'Art Rock',
  },
  {
    id: 'artist-3',
    name: 'Luna Chen',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    globalChosenUsers: 15203,
    genre: 'Jazz Fusion',
  },
  {
    id: 'artist-4',
    name: 'Broken Compass',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
    globalChosenUsers: 6892,
    genre: 'Post-Rock',
  },
];

export const mockTracks: Track[] = [
  {
    id: 'track-1',
    title: 'Concrete Dreams',
    artist: 'Nora Vex',
    album: 'Industrial Soundscapes',
    duration: '4:32',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1644855640845-ab57a047320e?w=400',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    id: 'track-2',
    title: 'Midnight Foundation',
    artist: 'The Midnight Architects',
    album: 'Structural Integrity',
    duration: '5:18',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1757889693310-1e77c6063ba7?w=400',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    id: 'track-3',
    title: 'Brass & Stone',
    artist: 'Luna Chen',
    album: 'Material Studies',
    duration: '3:45',
    quality: '320kbps',
    coverArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
  {
    id: 'track-4',
    title: 'Cement Horizon',
    artist: 'Broken Compass',
    album: 'The Wall',
    duration: '6:12',
    quality: 'FLAC',
    coverArt: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  },
];

export const mockPlaylists: Playlist[] = [
  {
    id: 'playlist-1',
    name: 'Foundation Mix',
    coverImage: 'https://images.unsplash.com/photo-1644855640845-ab57a047320e?w=400',
    trackCount: 24,
    isPublic: true,
    hiRes: true,
    creator: {
      id: 'user-2',
      name: 'Jordan Rivera',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    },
    structuralIntegrity: 85,
    tracks: [mockTracks[0], mockTracks[1], mockTracks[2], mockTracks[3]],
  },
  {
    id: 'playlist-2',
    name: 'Industrial Lounge',
    coverImage: 'https://images.unsplash.com/photo-1757889693310-1e77c6063ba7?w=400',
    trackCount: 18,
    isPublic: true,
    hiRes: true,
    creator: {
      id: 'user-3',
      name: 'Sam Chen',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    },
    structuralIntegrity: 92,
    tracks: [mockTracks[1], mockTracks[2], mockTracks[3], mockTracks[0]],
  },
  {
    id: 'playlist-3',
    name: 'Night Builds',
    coverImage: 'https://images.unsplash.com/photo-1690013429722-87852aae164b?w=400',
    trackCount: 32,
    isPublic: true,
    hiRes: false,
    creator: {
      id: 'user-1',
      name: 'Alex Morgan',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
    },
    structuralIntegrity: 78,
    tracks: [mockTracks[2], mockTracks[3], mockTracks[0], mockTracks[1]],
  },
  {
    id: 'playlist-4',
    name: 'Concrete Soul',
    coverImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
    trackCount: 15,
    isPublic: true,
    hiRes: true,
    creator: {
      id: 'user-4',
      name: 'Taylor Brooks',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    },
    structuralIntegrity: 88,
    tracks: [mockTracks[3], mockTracks[0], mockTracks[1], mockTracks[2]],
  },
  {
    id: 'playlist-5',
    name: 'Mortar Sessions',
    coverImage: 'https://images.unsplash.com/photo-1620456029959-f27e9935cbb9?w=400',
    trackCount: 21,
    isPublic: true,
    hiRes: true,
    creator: {
      id: 'user-5',
      name: 'Casey Wu',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    },
    structuralIntegrity: 95,
    tracks: [mockTracks[0], mockTracks[2], mockTracks[1], mockTracks[3]],
  },
];

export const mockConnections: Connection[] = [
  {
    id: 'conn-1',
    user: {
      id: 'user-2',
      name: 'Jordan Rivera',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    },
    matchScore: 88,
    mutualArtists: ['Nora Vex', 'Luna Chen', 'Broken Compass'],
    connectedDate: '2025-10-15',
  },
  {
    id: 'conn-2',
    user: {
      id: 'user-3',
      name: 'Sam Chen',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    },
    matchScore: 82,
    mutualArtists: ['The Midnight Architects', 'Luna Chen'],
    connectedDate: '2025-11-02',
  },
  {
    id: 'conn-3',
    user: {
      id: 'user-4',
      name: 'Taylor Brooks',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    },
    matchScore: 76,
    mutualArtists: ['Nora Vex', 'Broken Compass'],
    connectedDate: '2025-11-10',
  },
];

export const mockFeedEvents: FeedEvent[] = [
  {
    id: 'event-1',
    type: 'playlist_created',
    timestamp: '2025-11-22T14:30:00Z',
    data: {
      user: mockConnections[0].user,
      playlist: mockPlaylists[0],
    },
  },
  {
    id: 'event-2',
    type: 'connection_formed',
    timestamp: '2025-11-21T09:15:00Z',
    data: {
      userA: mockConnections[1].user,
      userB: {
        id: 'user-6',
        name: 'Riley Martinez',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400',
      },
      matchScore: 84,
    },
  },
  {
    id: 'event-3',
    type: 'patronage_update',
    timestamp: '2025-11-20T18:45:00Z',
    data: {
      user: mockConnections[0].user,
      artist: mockArtists[0],
    },
  },
  {
    id: 'event-4',
    type: 'playlist_created',
    timestamp: '2025-11-19T11:20:00Z',
    data: {
      user: mockConnections[2].user,
      playlist: mockPlaylists[3],
    },
  },
];