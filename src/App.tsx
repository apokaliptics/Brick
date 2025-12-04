import { useState, useEffect } from 'react';
import { Home, Zap, Plus, List, Search, Disc3, Play, X, HardDrive, Cloud } from 'lucide-react';
import { useTheme } from './contexts/ThemeContext';
import { useWall } from './contexts/WallContext';
import { HomeScreenV2 } from './components/screens/HomeScreenV2';
import { RadarScreen } from './components/screens/RadarScreen_temp';
import { VaultScreen } from './components/screens/VaultScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { FeedScreen } from './components/screens/FeedScreen';
import { PlaylistCreationScreen } from './components/screens/PlaylistCreationScreen';
import { LoginScreen } from './components/screens/LoginScreen';
import { ImportScreen } from './components/screens/ImportScreen';
import { ConnectionManagementScreen } from './components/screens/ConnectionManagementScreen';
import { ArtistProfileScreenV2 } from './components/screens/ArtistProfileScreenV2';
import { MusicPlayer } from './components/MusicPlayer';
import { WallOverlay } from './components/WallOverlay';
import { LocalMusicUploader } from './components/LocalMusicUploader';
import { PlayerApple } from './components/PlayerApple';
import { Navigation } from './components/Navigation';
import { ConnectionAuditModal } from './components/modals/ConnectionAuditModal';
import { ConnectionSuccessModal } from './components/modals/ConnectionSuccessModal';
import { PatronageLockModal } from './components/modals/PatronageLockModal';
import { UserSettingsModal } from './components/modals/UserSettingsModal';
import { ImageWithFallback } from './components/figma/ImageWithFallback';
import { logoutUser } from './utils/auth';
import { formatBitrate } from './utils/audioMetaHelpers';
import { useTrackAudioMeta } from './hooks/useTrackAudioMeta';
import { mockPlaylists, mockTracks, mockCurrentUser, mockArtists, mockConnections } from './data/mockData';
import type { Track, Playlist, Screen, User } from './types';
import { addRecentlyPlayedPlaylist } from './utils/recentlyPlayedPlaylists';
import { addRecentlyPlayedTrack } from './utils/recentlyPlayed';
import './styles/globals.css';
import pinkStyles from './styles/pinkTier.module.css';

export default function App() {
  const { colors } = useTheme();
  const { wallState, pinkTierUnlocked } = useWall();
  const wallShellClass = `app-shell brick-shell wall-state-${wallState.toLowerCase()}`;

  // Helper function to format duration
  const formatDuration = (duration: string | number): string => {
    if (typeof duration === 'string') {
      if (duration.includes(':')) return duration;
      const secs = parseFloat(duration);
      if (isNaN(secs)) return '0:00';
      const mins = Math.floor(secs / 60);
      const remainingSecs = Math.floor(secs % 60);
      return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
    } else {
      if (isNaN(duration)) return '0:00';
      const mins = Math.floor(duration / 60);
      const secs = Math.floor(duration % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // Helper function to format time for PlayerApple
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auth states
  const [authState, setAuthState] = useState<'login' | 'import' | 'authenticated'>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Set document title and check for existing session
  useEffect(() => {
    document.title = 'Brick';
    
    // Check if user is already logged in
    const loadUser = async () => {
      const { getCurrentUser } = await import('./utils/auth');
      const user = getCurrentUser();
      if (user) {
        setCurrentUser(user);
        setAuthState('authenticated');
      }
    };
    loadUser();
  }, []);
  
  // Screen states
  const [activeTab, setActiveTab] = useState<Screen>('home');
  const [homeFilter, setHomeFilter] = useState<'all' | 'payroll' | 'network' | 'recent' | 'feed'>('all');
  const [showPlayer, setShowPlayer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  
  // Music player state
  const [currentPlayingTrack, setCurrentPlayingTrack] = useState<Track | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [musicPlayerControls, setMusicPlayerControls] = useState<any>(null);
  const [isPink, setIsPink] = useState(false);

  const nowPlayingTrack = currentTrack ?? currentPlayingTrack;
  const nowPlayingMeta = useTrackAudioMeta(nowPlayingTrack);
  const codecBadge = nowPlayingMeta?.codecLabel
    ?? nowPlayingTrack?.codecLabel
    ?? nowPlayingTrack?.quality?.toUpperCase();
  const bitDepthBadge = nowPlayingMeta?.bitDepth ?? nowPlayingTrack?.bitDepth;
  const sampleRateBadge = nowPlayingMeta?.sampleRate ?? nowPlayingTrack?.sampleRate;
  const bitrateBadge = nowPlayingMeta?.bitrateKbps ?? nowPlayingTrack?.bitrateKbps;
  const isLocalSource = Boolean(
    nowPlayingTrack?.file ||
    (nowPlayingTrack?.audioUrl && !String(nowPlayingTrack.audioUrl).startsWith('http'))
  );

  useEffect(() => {
    if (!pinkTierUnlocked && isPink) {
      setIsPink(false);
    }
  }, [pinkTierUnlocked, isPink]);

  const notifyWallSessionReset = (reason: string) => {
    musicPlayerControls?.invalidateWallSession?.(reason);
  };
  
  // Modal states
  const [showArtistProfile, setShowArtistProfile] = useState(false);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [showPlaylistCreation, setShowPlaylistCreation] = useState(false);
  const [showConnectionAudit, setShowConnectionAudit] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showConnectionSuccess, setShowConnectionSuccess] = useState(false);
  const [showPatronageLock, setShowPatronageLock] = useState(false);
  const [showConnectionManagement, setShowConnectionManagement] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false);

  // UI states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Auth handlers
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setAuthState('authenticated');
  };

  const handleSignup = () => {
    // After signup, load the newly created user
    const loadUser = async () => {
      const { getCurrentUser } = await import('./utils/auth');
      const user = getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }
    };
    loadUser();
    setAuthState('import');
  };

  const handleImport = (platform: string) => {
    console.log('Importing from:', platform);
    setAuthState('authenticated');
  };

  const handleSkipImport = () => {
    setAuthState('authenticated');
  };

  // App handlers
  const handlePlaylistClick = async (playlistId: string) => {
    notifyWallSessionReset('playlist-start');
    // Check if it's a local playlist in IndexedDB
    try {
      const db = await openPlaylistDB();
      const transaction = db.transaction(['playlists'], 'readonly');
      const store = transaction.objectStore('playlists');
      const localPlaylist = await new Promise<Playlist | undefined>((resolve) => {
        const request = store.get(playlistId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(undefined);
      });
      
      if (localPlaylist) {
        // Handle local playlist - need to recreate blob URLs for local tracks
        if (!localPlaylist.tracks || localPlaylist.tracks.length === 0) {
          console.error('Local playlist has no tracks');
          return;
        }
        
        // Load local tracks from IndexedDB to get blob URLs
        const tracksTransaction = db.transaction(['localTracks'], 'readonly');
        const tracksStore = tracksTransaction.objectStore('localTracks');
        
        const playerTracks = await Promise.all(
          localPlaylist.tracks.map(async (track: Track) => {
            let audioUrl = track.audioUrl;
            let fileRef = track.file;
            let bitDepth = track.bitDepth;
            let sampleRate = track.sampleRate;
            let bitrateKbps = track.bitrateKbps;
            let codecLabel = track.codecLabel;
            
            // If no audioUrl or it's a local track ID, try to load from IndexedDB
            if (!audioUrl || !audioUrl.startsWith('http')) {
              try {
                const localTrack = await new Promise<any>((resolve) => {
                  const request = tracksStore.get(track.id);
                  request.onsuccess = () => resolve(request.result);
                  request.onerror = () => resolve(null);
                });
                
                if (localTrack && localTrack.file) {
                  // Create blob URL from the stored file
                  audioUrl = URL.createObjectURL(localTrack.file);
                  fileRef = localTrack.file;
                  bitDepth = bitDepth ?? localTrack.bitDepth;
                  sampleRate = sampleRate ?? localTrack.sampleRate;
                  bitrateKbps = bitrateKbps ?? localTrack.bitrateKbps;
                  codecLabel = codecLabel ?? localTrack.codecLabel;
                  console.log('Recreated blob URL for track:', track.title);
                }
              } catch (error) {
                console.error('Failed to load local track:', error);
              }
            }
            
            return {
              id: track.id,
              title: track.title,
              name: track.title,
              artist: track.artist,
              album: track.album,
              coverImage: track.coverArt,
              coverArt: track.coverArt,
              audioUrl: audioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
              quality: track.quality,
              duration: track.duration,
              bitDepth,
              sampleRate,
              bitrateKbps,
              codecLabel,
              file: fileRef,
            } as Track;
          })
        );
        
        console.log('Loaded local playlist with tracks:', playerTracks);
        setPlaylist(playerTracks);
        setCurrentPlayingTrack(playerTracks[0]);

        // Track recently played playlist
        console.log('Adding local playlist to recently played:', localPlaylist.name);
        addRecentlyPlayedPlaylist({
          playlistId: localPlaylist.id,
          playlistName: localPlaylist.name,
          coverImage: localPlaylist.coverImage,
          creatorName: typeof localPlaylist.creator === 'string' ? localPlaylist.creator : localPlaylist.creator?.name || 'Your Collection',
          trackCount: localPlaylist.trackCount,
          structuralIntegrity: localPlaylist.structuralIntegrity,
        }).then(() => {
          console.log('Successfully added local playlist to recently played');
        }).catch(err => console.error('Failed to track recently played playlist:', err));
        
        // Convert first track to Track format for PlayerApple
        const firstPlayerTrack = playerTracks[0];
        const trackFormat: Track = {
          id: firstPlayerTrack.id,
          title: firstPlayerTrack.name,
          artist: firstPlayerTrack.artist,
          album: firstPlayerTrack.album,
          coverArt: firstPlayerTrack.coverImage,
          audioUrl: firstPlayerTrack.audioUrl,
          quality: firstPlayerTrack.quality,
          duration: '0:00', // Will be updated by player
          isPatronage: false,
          bitDepth: firstPlayerTrack.bitDepth,
          sampleRate: firstPlayerTrack.sampleRate,
          bitrateKbps: firstPlayerTrack.bitrateKbps,
          codecLabel: firstPlayerTrack.codecLabel,
          file: firstPlayerTrack.file,
        };
        
        setCurrentTrack(trackFormat);
        setShowPlayer(true);
        setIsPlaying(true);
        return;
      }
    } catch (error) {
      console.error('Error loading playlist from IndexedDB:', error);
    }
    
    // Handle online playlist
    const foundPlaylist = mockPlaylists.find(p => p.id === playlistId);

    if (!foundPlaylist || !foundPlaylist.tracks || foundPlaylist.tracks.length === 0) {
      console.error('Playlist not found or has no tracks');
      return;
    }

    // Track recently played playlist
    console.log('Adding online playlist to recently played:', foundPlaylist.name);
    addRecentlyPlayedPlaylist({
      playlistId: foundPlaylist.id,
      playlistName: foundPlaylist.name,
      coverImage: foundPlaylist.coverImage,
      creatorName: typeof foundPlaylist.creator === 'string' ? foundPlaylist.creator : foundPlaylist.creator?.name || 'Your Collection',
      trackCount: foundPlaylist.trackCount,
      structuralIntegrity: foundPlaylist.structuralIntegrity,
    }).then(() => {
      console.log('Successfully added online playlist to recently played');
    }).catch(err => console.error('Failed to track recently played playlist:', err));
    
    const playerTracks = foundPlaylist.tracks.map(track => ({
      id: track.id,
      name: track.title,
      artist: track.artist,
      album: track.album,
      coverImage: track.coverArt,
      audioUrl: track.audioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      quality: track.quality,
      bitDepth: track.bitDepth,
      sampleRate: track.sampleRate,
      bitrateKbps: track.bitrateKbps,
      codecLabel: track.codecLabel,
      file: track.file,
    }));
    
    setPlaylist(playerTracks);
    setCurrentPlayingTrack(playerTracks[0]);
    
    // Also keep old player for backward compatibility
    setCurrentTrack(playerTracks[0]);
    setShowPlayer(true);
    setIsPlaying(true);
  };

  const handleLocalTrackPlay = (localTrack: any) => {
    notifyWallSessionReset('local-track');
    console.log('Playing local track:', localTrack);

    // Track recently played track
    addRecentlyPlayedTrack({
      trackId: localTrack.id,
      trackTitle: localTrack.name,
      artistName: localTrack.artist || 'Unknown Artist',
      coverArt: localTrack.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      audioUrl: localTrack.url,
      playedAt: Date.now(),
    }).catch(err => console.error('Failed to track recently played track:', err));

    // Convert local track to player format with actual metadata
    const playerTrack: Track = {
      id: localTrack.id,
      title: localTrack.name,
      name: localTrack.name,
      artist: localTrack.artist || 'Unknown Artist',
      album: localTrack.album || 'Unknown Album',
      coverImage: localTrack.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      coverArt: localTrack.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      audioUrl: localTrack.url,
      quality: localTrack.format,
      duration: localTrack.duration,
      bitDepth: localTrack.bitDepth,
      sampleRate: localTrack.sampleRate,
      bitrateKbps: localTrack.bitrateKbps,
      codecLabel: localTrack.codecLabel,
      file: localTrack.file,
    };

    // Convert to Track format for PlayerV3
    const trackFormat: Track = {
      id: localTrack.id,
      title: localTrack.name,
      name: localTrack.name,
      artist: localTrack.artist || 'Unknown Artist',
      album: localTrack.album || 'Unknown Album',
      coverArt: localTrack.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      audioUrl: localTrack.url,
      quality: localTrack.format,
      duration: formatDuration(localTrack.duration),
      isPatronage: false,
      bitDepth: localTrack.bitDepth,
      sampleRate: localTrack.sampleRate,
      bitrateKbps: localTrack.bitrateKbps,
      codecLabel: localTrack.codecLabel,
      file: localTrack.file,
    };

    // Set as single-track playlist
    setPlaylist([playerTrack]);
    setCurrentPlayingTrack(playerTrack);
    setCurrentTrack(trackFormat);
    setShowPlayer(true);
    setIsPlaying(true);
  };

  const handleLocalAlbumPlay = (localTracks: any[]) => {
    notifyWallSessionReset('local-album');
    console.log('Playing local album with', localTracks.length, 'tracks');
    
    // Convert local tracks to player format
    const playerTracks = localTracks.map(track => ({
      id: track.id,
      title: track.name,
      name: track.name,
      artist: track.artist || 'Unknown Artist',
      album: track.album || 'Unknown Album',
      coverImage: track.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      coverArt: track.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      audioUrl: track.url,
      quality: track.format,
      duration: track.duration,
      bitDepth: track.bitDepth,
      sampleRate: track.sampleRate,
      bitrateKbps: track.bitrateKbps,
      codecLabel: track.codecLabel,
      file: track.file,
    }));

    // Convert first track to Track format for PlayerApple
    const firstTrack = localTracks[0];
    const trackFormat: Track = {
      id: firstTrack.id,
      title: firstTrack.name,
      name: firstTrack.name,
      artist: firstTrack.artist || 'Unknown Artist',
      album: firstTrack.album || 'Unknown Album',
      coverArt: firstTrack.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      audioUrl: firstTrack.url,
      quality: firstTrack.format,
      duration: firstTrack.duration.toString(),
      isPatronage: false,
      bitDepth: firstTrack.bitDepth,
      sampleRate: firstTrack.sampleRate,
      bitrateKbps: firstTrack.bitrateKbps,
      codecLabel: firstTrack.codecLabel,
      file: firstTrack.file,
    };

    // Set album playlist with gapless playback enabled
    setPlaylist(playerTracks);
    setCurrentPlayingTrack(playerTracks[0]);
    setCurrentTrack(trackFormat);
    setShowPlayer(true);
    setIsPlaying(true);
  };

  const handleTrackChange = (track: any) => {
    setCurrentPlayingTrack(track);
    
    // Also update currentTrack to sync with PlayerV3
    // Convert from player format back to Track format
    const updatedTrack: Track = {
      id: track.id,
      title: track.name,
      artist: track.artist,
      album: track.album || 'Unknown Album',
      coverArt: track.coverImage,
      audioUrl: track.audioUrl,
      quality: track.quality || 'MP3',
      duration: track.duration || '3:45',
      isPatronage: track.isPatronage || false,
      bitDepth: track.bitDepth,
      sampleRate: track.sampleRate,
      bitrateKbps: track.bitrateKbps,
      codecLabel: track.codecLabel,
      file: track.file,
    };
    
    setCurrentTrack(updatedTrack);
    console.log('Track changed to:', updatedTrack.title);
  };

  const handleArtistPress = (artistId: string) => {
    setSelectedArtistId(artistId);
    setShowArtistProfile(true);
  };

  const handleArtistClickFromPlayer = () => {
    // Find artist ID from current track - for now use first artist
    const artist = mockArtists.find(a => a.name === currentTrack?.artist);
    if (artist) {
      setShowPlayer(false); // Hide the player
      setSelectedArtistId(artist.id);
      setShowArtistProfile(true);
    }
  };

  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
    setShowConnectionAudit(true);
  };

  const handleConnect = () => {
    console.log('Connection request sent');
    setShowConnectionAudit(false);
    setShowConnectionSuccess(true);
  };

  const handlePublishPlaylist = async (name: string, tracks: Track[]) => {
    console.log('Playlist published:', name, tracks);
    
    // Get custom cover image if it was set
    const customCover = sessionStorage.getItem('playlistCustomCover');
    sessionStorage.removeItem('playlistCustomCover');
    
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name,
      coverImage: customCover || tracks[0]?.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      customCoverImage: customCover || undefined,
      trackCount: tracks.length,
      creator: currentUser?.id || 'user-1',
      likes: 0,
      isLocked: false,
      structuralIntegrity: Math.round(calculateStructuralIntegrity(tracks)),
      tracks,
    };
    
    try {
      // Save to IndexedDB instead of localStorage
      const db = await openPlaylistDB();
      const transaction = db.transaction(['playlists'], 'readwrite');
      const store = transaction.objectStore('playlists');
      await new Promise<void>((resolve, reject) => {
        const request = store.add(newPlaylist);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      console.log('Playlist saved successfully to IndexedDB');
    } catch (error) {
      console.error('Failed to save playlist:', error);
      alert('Failed to save playlist. Please try again.');
      return;
    }
    
    setShowPlaylistCreation(false);
    
    // Navigate to profile and trigger a custom event to switch to local view
    setActiveTab('profile' as Screen);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('switchToLocalWall'));
    }, 100);
  };
  
  const calculateStructuralIntegrity = (tracks: Track[]): number => {
    if (tracks.length === 0) return 0;
    if (tracks.length === 1) return 100;

    // Enhanced genre compatibility with weighted scoring
    // Groups that are closely related
    const genreGroups = {
      rock: ['rock', 'alternative rock', 'indie rock', 'hard rock', 'punk rock', 'grunge', 'alt-rock', 'alternative', 'punk', 'garage rock', 'psychedelic rock'],
      metal: ['metal', 'heavy metal', 'thrash metal', 'death metal', 'black metal', 'metalcore', 'doom metal', 'progressive metal', 'nu metal'],
      indie_adjacent: ['indie', 'indie rock', 'alternative rock', 'shoegaze', 'post-rock', 'dream pop'],
      electronic: ['electronic', 'house', 'techno', 'ambient', 'idm', 'downtempo', 'drum and bass', 'dance', 'edm', 'trance', 'dubstep'],
      hip_hop: ['hip hop', 'rap', 'trap', 'drill', 'grime', 'hip-hop', 'r&b', 'rnb'],
      pop: ['pop', 'synth pop', 'indie pop', 'electropop', 'k-pop', 'j-pop'],
      jazz: ['jazz', 'bebop', 'smooth jazz', 'jazz fusion', 'free jazz', 'blues'],
      classical: ['classical', 'orchestral', 'chamber music', 'baroque', 'romantic', 'contemporary classical'],
      folk: ['folk', 'indie folk', 'americana', 'bluegrass', 'singer-songwriter', 'acoustic'],
      country: ['country', 'alt-country', 'outlaw country', 'bluegrass', 'nashville'],
    };

    const normalizeGenre = (genre: string | undefined): string => {
      if (!genre) return 'unknown';
      const normalized = genre.toLowerCase().trim();
      
      for (const [groupName, genres] of Object.entries(genreGroups)) {
        for (const g of genres) {
          if (normalized.includes(g) || g.includes(normalized)) {
            return g;
          }
        }
      }
      
      return normalized;
    };

    // Get genres from tracks and normalize them
    const trackGenres = tracks.map(t => normalizeGenre(t.genre));
    
    // Count unknown genres
    const unknownCount = trackGenres.filter(g => g === 'unknown').length;
    
    // All unknown = 50%
    if (unknownCount === tracks.length) return 50;
    
    const unknownPenalty = (unknownCount / tracks.length) * 20;

    // Find genre groups for each track
    const trackGroupMemberships = trackGenres.map(genre => {
      const groups: string[] = [];
      Object.entries(genreGroups).forEach(([groupName, genres]) => {
        if (genres.includes(genre)) {
          groups.push(groupName);
        }
      });
      return { genre, groups };
    });

    // Same genre = 100%
    const knownGenres = trackGenres.filter(g => g !== 'unknown');
    const uniqueGenres = new Set(knownGenres);
    if (uniqueGenres.size === 1 && unknownCount === 0) return 100;
    if (uniqueGenres.size === 1 && unknownCount > 0) return Math.max(50, 100 - unknownPenalty);

    // Calculate compatibility with weighted scoring
    let totalScore = 0;
    let totalComparisons = 0;

    // Genre similarity mapping with confidence scores (0-100)
    const genreSimilarity: Record<string, Record<string, number>> = {
      'indie': {
        'indie': 100, 'indie rock': 95, 'alternative rock': 85, 'shoegaze': 75, 'dream pop': 70, 
        'post-rock': 65, 'alt-rock': 90, 'alternative': 85, 'indie pop': 90, 'punk': 60, 'psychedelic rock': 60,
        'rap': 10, 'hip hop': 10, 'trap': 5, 'metal': 15, 'heavy metal': 10, 'country': 20
      },
      'shoegaze': {
        'shoegaze': 100, 'indie': 75, 'indie rock': 80, 'dream pop': 85, 'post-rock': 80, 
        'ambient': 75, 'alternative rock': 70, 'ethereal': 90, 'noise rock': 70,
        'rap': 5, 'hip hop': 5, 'country': 10, 'metal': 10
      },
      'post-rock': {
        'post-rock': 100, 'indie': 65, 'shoegaze': 80, 'ambient': 80, 'alternative rock': 75, 
        'dream pop': 75, 'progressive rock': 80, 'art rock': 85,
        'rap': 10, 'hip hop': 10, 'metal': 20, 'pop': 15
      },
      'rock': {
        'rock': 100, 'alternative rock': 90, 'indie rock': 85, 'hard rock': 85, 'punk': 80, 
        'garage rock': 85, 'psychedelic rock': 85, 'art rock': 80, 'progressive rock': 80,
        'rap': 20, 'hip hop': 15, 'country': 30
      },
      'metal': {
        'metal': 100, 'heavy metal': 95, 'thrash metal': 90, 'death metal': 90, 'black metal': 90, 
        'metalcore': 90, 'doom metal': 95, 'progressive metal': 85, 'nu metal': 85,
        'rock': 50, 'punk': 40, 'rap': 15, 'hip hop': 10
      },
      'electronic': {
        'electronic': 100, 'house': 95, 'techno': 95, 'ambient': 85, 'idm': 85, 'downtempo': 80,
        'edm': 90, 'trance': 90, 'dubstep': 80, 'synth pop': 75, 'dance': 90,
        'pop': 60, 'indie': 50, 'rap': 40
      },
      'hip hop': {
        'hip hop': 100, 'rap': 95, 'trap': 90, 'drill': 85, 'grime': 85, 'r&b': 85, 'rnb': 85,
        'pop': 50, 'indie': 15, 'rock': 20, 'country': 10
      },
      'pop': {
        'pop': 100, 'synth pop': 95, 'indie pop': 90, 'electropop': 90, 'k-pop': 85,
        'electronic': 70, 'hip hop': 40, 'indie': 60, 'rock': 40
      },
    };

    // Score each pair of tracks
    for (let i = 0; i < trackGroupMemberships.length; i++) {
      for (let j = i + 1; j < trackGroupMemberships.length; j++) {
        if (trackGenres[i] === 'unknown' || trackGenres[j] === 'unknown') continue;
        
        totalComparisons++;
        const genre1 = trackGenres[i];
        const genre2 = trackGenres[j];
        
        // Look up similarity score
        let score = 50; // default neutral score
        if (genreSimilarity[genre1] && genreSimilarity[genre1][genre2] !== undefined) {
          score = genreSimilarity[genre1][genre2];
        } else if (genreSimilarity[genre2] && genreSimilarity[genre2][genre1] !== undefined) {
          score = genreSimilarity[genre2][genre1];
        } else if (genre1 === genre2) {
          score = 100;
        }
        
        totalScore += score;
      }
    }

    if (totalComparisons === 0) return 50;

    const averageScore = totalScore / totalComparisons;
    
    // Apply unknown penalty
    let finalScore = averageScore - unknownPenalty;
    
    return Math.max(0, Math.round(finalScore));
  };

  const handleFilterChange = (filter: 'all' | 'payroll' | 'network' | 'recent' | 'feed') => {
    if (filter === 'feed') {
      setActiveTab('feed' as Screen);
    } else {
      setHomeFilter(filter);
    }
  };

  const selectedArtist = mockArtists.find(a => a.id === selectedArtistId);
  const selectedConnection = mockConnections.find(c => c.user.id === selectedUserId);

  const operatorName = currentUser?.name || 'Guest';
  const baseTierLabel = (currentUser?.tier || 'Foundation').toUpperCase();
  const tierLabel = isPink ? 'PINK ARCHITECT' : baseTierLabel;
  const pageLabelMap: Record<Screen, string> = {
    home: 'HOME GRID',
    radar: 'RADAR SCAN',
    profile: 'PERSONAL WALL',
    vault: 'VAULT',
    feed: 'NEIGHBORHOOD',
  };
  const currentPageLabel = pageLabelMap[activeTab];
  const navTab: Exclude<Screen, 'feed'> = activeTab === 'feed' ? 'home' : activeTab;
  const topBarItems = [
    { label: 'OPERATOR', value: operatorName },
    { label: 'TIER', value: tierLabel, isPink: isPink },
    { label: 'CURRENT PAGE', value: currentPageLabel },
    { label: 'SYSTEM', value: 'NO ALERT' },
  ];

  // Handle track click from radar screen
  const handleTrackClick = (track: Track, playlist: Track[]) => {
    console.log('Playing track from radar:', track.title);
    notifyWallSessionReset('radar-play');
    setPlaylist(playlist);
    setCurrentPlayingTrack(track);
    setCurrentTrack(track);
    setShowPlayer(true);
    setIsPlaying(true);
  };

  // Show login flow
  if (authState === 'login') {
    return <LoginScreen onLogin={handleLogin} onSignup={handleSignup} />;
  }

  // Show import flow
  if (authState === 'import') {
    return <ImportScreen onImport={handleImport} onSkip={handleSkipImport} />;
  }

  // Main app
  return (
    <div className={wallShellClass} style={{ backgroundColor: colors.bg.primary }}>
      <WallOverlay enabled={isPink} />
      {/* Main Content - Centered between fixed sidebars */}
      <div className="flex-1 overflow-x-hidden pb-32 app-main-rails">
        {/* Unified center column for all screens */}
        <div className="mx-auto responsive-main-shell">
          {/* Ultra-thin command bar */}
          <div className="sticky top-0 z-20 mb-4 px-3">
            <div
              className="flex flex-wrap items-center justify-center rounded-[4px] border px-5 py-2 command-bar"
              style={{
                background: 'linear-gradient(135deg, rgba(18,18,18,0.92), rgba(28,18,18,0.85))',
                borderColor: 'rgba(211,47,47,0.25)',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.45), 0 0 30px rgba(161,24,24,0.35)'
              }}
            >
              {topBarItems.map((item, idx) => (
                <div key={`${item.label}-${idx}`} className="flex items-center uppercase command-bar-item">
                  <span className="mono command-bar-label">
                    {item.label}:
                  </span>
                  <span
                    className={`mono command-bar-value ${item.isPink ? pinkStyles.pinkBadgeText : ''}`}
                  >
                    {item.value}
                  </span>
                  {idx < topBarItems.length - 1 && (
                    <span className="mono" style={{ color: '#444444', letterSpacing: '0' }}>
                      •
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        {activeTab === 'home' && (
          <>
            <HomeScreenV2
              key="home-screen-stable"
              onPlaylistClick={handlePlaylistClick}
              onArtistPress={handleArtistPress}
              onFeedClick={() => setActiveTab('feed' as Screen)}
              activeFilter={homeFilter}
              onFilterChange={handleFilterChange}
              onLocalTrackPlay={handleLocalTrackPlay}
              onLocalAlbumPlay={handleLocalAlbumPlay}
            />
            
            {/* Playlist creation moved into player */}
          </>
        )}
        
        {activeTab === 'radar' && (
          <RadarScreen onUserClick={handleUserClick} onTrackClick={handleTrackClick} />
        )}
        
        {activeTab === 'profile' && (
          <>
            <ProfileScreen
              onPlaylistClick={handlePlaylistClick}
              onCreatePlaylist={() => setShowPlaylistCreation(true)}
              currentUser={currentUser}
              isPinkMode={isPink}
              onPinkToggle={(value) => setIsPink(value)}
              pinkTierUnlocked={pinkTierUnlocked}
            />
            
            {/* Playlist creation moved into player */}
          </>
        )}
        
        {activeTab === 'vault' && (
          <VaultScreen
            onOpenConnectionManagement={() => setShowConnectionManagement(true)}
            onSignOut={() => {
              try {
                logoutUser();
              } catch {}
              setCurrentUser(null);
              setAuthState('login');
              setActiveTab('home' as Screen);
            }}
          />
        )}
        
        {/* Feed Button - Removed, now in pill navigation */}
        </div>
      </div>

      {/* Right Sidebar - Currently Playing (Fixed) */}
      {(currentPlayingTrack || !currentPlayingTrack) && (
        <div
            className="hidden md:flex md:flex-col border-l overflow-hidden fixed right-0 top-0 bottom-0 z-30 now-playing-rail"
            style={{
              backgroundColor: 'rgba(30, 30, 30, 0.8)',
              backdropFilter: 'blur(40px)',
              borderColor: 'rgba(255, 255, 255, 0.05)',
              boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.3)',
            }}
          >
                {/* Sidebar Content - Scrollable */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 flex flex-col items-center" style={{ width: '100%', maxWidth: 'min(320px, 100%)', minWidth: 0 }}>
                  <p className="mono mb-3 px-2 text-center" style={{ color: '#666666', fontSize: '0.65rem', letterSpacing: '0.05em' }}>NOW PLAYING</p>

                  {/* Cover Art or Empty State */}
                  {currentPlayingTrack ? (
                    <div
                      className="mb-4 rounded-lg overflow-hidden mx-auto cursor-pointer transition-all duration-200 hover:scale-105"
                      style={{ width: '180px', height: '180px', maxWidth: '180px', minWidth: '180px', boxShadow: '0 4px 16px rgba(211, 47, 47, 0.15)' }}
                      onClick={() => setShowPlayer(true)}
                    >
                      <ImageWithFallback
                        src={currentPlayingTrack.coverImage || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300'}
                        alt={currentPlayingTrack.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="mb-4 rounded-lg mx-auto flex items-center justify-center" style={{ width: '180px', height: '180px', border: '1px dashed rgba(255,255,255,0.1)', backgroundColor: 'rgba(26,26,26,0.6)' }}>
                      <span className="mono" style={{ color: '#888888', fontSize: '0.8rem' }}>No track playing</span>
                    </div>
                  )}

                  {/* Track Info - Compact Style (FIXED for overflow) */}
                  {currentPlayingTrack && (
                  <div className="mb-4 text-center px-4 overflow-hidden" style={{ width: '100%', maxWidth: 'min(320px, 100%)' }}>
                    {/* Audio quality chips under cover */}
                    {/* Do not use hooks here; read from currentTrack/currentPlayingTrack props */}
                    <div className="flex items-center justify-center gap-2 mb-3">
                      {codecBadge && (
                        <span
                          className="mono px-2 py-0.5 rounded"
                          style={{
                            border: '1px solid #333333',
                            background: 'rgba(26,26,26,0.6)',
                            color: '#e0e0e0',
                            fontSize: '0.7rem',
                            minWidth: '72px'
                          }}
                        >
                          {String(codecBadge).toUpperCase()}
                        </span>
                      )}
                      <span
                        className="mono px-2 py-0.5 rounded flex items-center gap-1"
                        style={{
                          border: '1px solid #333333',
                          background: 'rgba(26,26,26,0.6)',
                          color: '#e0e0e0',
                          fontSize: '0.7rem'
                        }}
                      >
                        {isLocalSource ? <HardDrive size={12} color="#e0e0e0" /> : <Cloud size={12} color="#e0e0e0" />}
                        {isLocalSource ? 'Local' : 'Cloud'}
                      </span>
                      {(bitDepthBadge || sampleRateBadge) && (
                        <span
                          className="mono px-2 py-0.5 rounded"
                          style={{
                            border: '1px solid #333333',
                            background: 'rgba(26,26,26,0.6)',
                            color: '#e0e0e0',
                            fontSize: '0.7rem'
                          }}
                        >
                          {bitDepthBadge ? `${bitDepthBadge}-bit` : ''}
                          {bitDepthBadge && sampleRateBadge ? ' / ' : ''}
                          {sampleRateBadge ? `${sampleRateBadge}kHz` : ''}
                        </span>
                      )}
                      {bitrateBadge && (
                        <span
                          className="mono px-2 py-0.5 rounded"
                          style={{
                            border: '1px solid #333333',
                            background: 'rgba(26,26,26,0.6)',
                            color: '#e0e0e0',
                            fontSize: '0.7rem'
                          }}
                        >
                          {formatBitrate(bitrateBadge)}
                        </span>
                      )}
                    </div>
                    <p
                      style={{ color: '#e0e0e0' }}
                      className="text-sm font-bold mb-2 truncate w-full min-w-0 cursor-pointer hover:text-[#d32f2f] transition-colors"
                      onClick={() => setShowPlayer(true)}
                      title={currentPlayingTrack.name}
                    >
                      {currentPlayingTrack.name}
                    </p>
                    
                    {/* Added Artist Name for better context */}
                    <p 
                      style={{ color: '#888888' }} 
                      className="text-xs truncate w-full min-w-0 mb-3"
                      title={currentPlayingTrack.artist}
                    >
                      {currentPlayingTrack.artist}
                    </p>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div
                        className="w-full rounded-full h-1 mb-2 cursor-pointer"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                      >
                        <div
                          className="h-1 rounded-full transition-all"
                          style={{
                            width: `${musicPlayerControls?.duration ? (musicPlayerControls.currentTime / musicPlayerControls.duration) * 100 : 0}%`,
                            background: 'linear-gradient(to right, #d32f2f, #b71c1c)',
                            boxShadow: '0 0 10px rgba(211, 47, 47, 0.5)',
                          }}
                        />
                      </div>
                      <div className="flex justify-between mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
                        <span>{musicPlayerControls?.formatTime ? musicPlayerControls.formatTime(musicPlayerControls.currentTime) : '0:00'}</span>
                        <span>{musicPlayerControls?.formatTime ? musicPlayerControls.formatTime(musicPlayerControls.duration) : '0:00'}</span>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Queue Info - Industrial Luxury Design */}
                  {playlist.length > 1 && (
                    <div className="mt-4 overflow-hidden" style={{ width: '100%', maxWidth: 'min(320px, 100%)' }}>
                      {/* Header with divider line */}
                      <div className="px-4 mb-4 flex items-center gap-3">
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(211, 47, 47, 0.3), transparent)' }} />
                        <p className="mono" style={{ 
                          color: '#d32f2f', 
                          fontSize: '0.6rem', 
                          letterSpacing: '0.15em', 
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          textShadow: '0 0 10px rgba(211, 47, 47, 0.3)'
                        }}>
                          Up Next
                        </p>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(211, 47, 47, 0.3), transparent)' }} />
                      </div>
                      
                      <div className="px-3 flex flex-col gap-0 overflow-hidden" style={{ width: '100%', maxWidth: 'min(320px, 100%)' }}>
                        {(() => {
                          const currentIndex = playlist.findIndex(t => t.id === currentPlayingTrack?.id);
                          const upcomingTracks = playlist.slice(currentIndex + 1, currentIndex + 4);
                          
                          return upcomingTracks.map((track, idx) => (
                            <div key={`${track.id}-${idx}`} className="w-full min-w-0 overflow-hidden">
                              <div
                                className="py-2.5 px-2 transition-all duration-300 cursor-pointer group w-full min-w-0 rounded"
                                style={{
                                  backgroundColor: 'transparent',
                                  border: '1px solid transparent',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(211, 47, 47, 0.05)';
                                  e.currentTarget.style.borderColor = 'rgba(211, 47, 47, 0.2)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.borderColor = 'transparent';
                                }}
                                onClick={() => {
                                  const targetIndex = playlist.findIndex(t => t.id === track.id);
                                  if (targetIndex !== -1) {
                                    const trackToPlay = playlist[targetIndex];
                                    notifyWallSessionReset('queue-jump');
                                    setCurrentPlayingTrack(trackToPlay);
                                    // Update legacy state
                                    setCurrentTrack({
                                      id: trackToPlay.id,
                                      title: trackToPlay.title || trackToPlay.name || 'Untitled',
                                      name: trackToPlay.name || trackToPlay.title,
                                      artist: trackToPlay.artist,
                                      album: trackToPlay.album || 'Unknown Album',
                                      coverArt: trackToPlay.coverArt || trackToPlay.coverImage,
                                      audioUrl: trackToPlay.audioUrl,
                                      quality: trackToPlay.quality || 'MP3',
                                      duration: '0:00',
                                      isPatronage: false,
                                    });
                                  }
                                }}
                              >
                                <div className="flex items-center gap-3 w-full min-w-0 max-w-full overflow-hidden">
                                  {/* Track Number - Industrial Style */}
                                  <div 
                                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center mono" 
                                    style={{ 
                                      backgroundColor: 'rgba(211, 47, 47, 0.08)',
                                      border: '1px solid rgba(211, 47, 47, 0.2)',
                                      color: '#d32f2f',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      letterSpacing: '0.05em',
                                      clipPath: 'polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)',
                                      textShadow: '0 0 8px rgba(211, 47, 47, 0.2)'
                                    }}
                                  >
                                    {String(currentIndex + idx + 2).padStart(2, '0')}
                                  </div>
                                  
                                  {/* Track Text - Refined Typography */}
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <p 
                                      style={{ 
                                        color: '#e8e8e8',
                                        fontSize: '0.825rem',
                                        fontWeight: 600,
                                        letterSpacing: '0.02em',
                                        lineHeight: '1.2',
                                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                                      }} 
                                      className="truncate w-full min-w-0 group-hover:text-[#d32f2f] transition-colors"
                                      title={track.name}
                                    >
                                      {track.name}
                                    </p>
                                    <p 
                                      style={{ 
                                        color: '#7a7a7a',
                                        fontSize: '0.7rem',
                                        fontWeight: 500,
                                        letterSpacing: '0.03em',
                                        lineHeight: '1.3',
                                        marginTop: '2px',
                                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                                      }} 
                                      className="truncate w-full min-w-0"
                                      title={track.artist}
                                    >
                                      {track.artist}
                                    </p>
                                  </div>

                                  {/* Subtle play indicator on hover */}
                                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2">
                                      <polygon points="5 3 19 12 5 21 5 3" fill="#d32f2f" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Separator - Refined */}
                              {idx < upcomingTracks.length - 1 && (
                                <div className="mx-10 my-1.5" style={{ 
                                  height: '1px',
                                  background: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.06), transparent)' 
                                }} />
                              )}
                            </div>
                          ));
                        })()}

                        {/* "+ More" Indicator - Refined */}
                        {(() => {
                          const currentIndex = playlist.findIndex(t => t.id === currentPlayingTrack?.id);
                          const remainingTracks = playlist.length - currentIndex - 4;
                          return remainingTracks > 0 && (
                            <div className="py-3 w-full mt-2">
                              <div className="flex items-center justify-center gap-2">
                                <div style={{ width: '20px', height: '1px', backgroundColor: 'rgba(211, 47, 47, 0.2)' }} />
                                <p className="mono" style={{ 
                                  color: '#666666', 
                                  fontSize: '0.65rem', 
                                  letterSpacing: '0.08em',
                                  fontWeight: 600
                                }}>
                                  +{remainingTracks} more
                                </p>
                                <div style={{ width: '20px', height: '1px', backgroundColor: 'rgba(211, 47, 47, 0.2)' }} />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

            </div>
      )}
      {/* Feed Screen (Full screen overlay) */}
      {(activeTab as string) === 'feed' && (
        <div className="fixed inset-0 z-50 bg-[#1a1a1a] overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
              style={{
                backgroundColor: 'rgba(30, 30, 30, 0.95)',
                backdropFilter: 'blur(40px)',
                borderColor: colors.border,
              }}
            >
              <h3 style={{ color: '#e0e0e0' }}>The Neighborhood</h3>
              <button
                onClick={() => setActiveTab('home')}
                className="px-4 py-2 rounded-full transition-colors hover:bg-[#2a2a2a]"
                style={{
                  backgroundColor: 'rgba(37, 37, 37, 0.5)',
                  color: '#a0a0a0',
                }}
              >
                <span className="mono" style={{ fontSize: '0.75rem' }}>
                  Close
                </span>
              </button>
            </div>
            <FeedScreen currentUser={currentUser} />
          </div>
        </div>
      )}

      {/* Navigation */}
      <Navigation
        activeTab={navTab}
        onTabChange={(tab) => setActiveTab(tab)}
        activeFilter={activeTab === 'home' ? homeFilter : undefined}
        onFilterChange={activeTab === 'home' ? handleFilterChange : undefined}
        onSettingsClick={() => setShowUserSettings(true)}
        isPinkMode={isPink}
      />

      {/* Player Overlay */}
      {showPlayer && musicPlayerControls && currentTrack && (
        <PlayerApple
          track={currentTrack}
          connectionName="Jordan Rivera"
          isPlaying={musicPlayerControls.isPlaying}
          onPlayPause={musicPlayerControls.togglePlayPause}
          onNext={musicPlayerControls.handleNext}
          onPrevious={musicPlayerControls.handlePrevious}
          currentTime={musicPlayerControls.currentTime}
          duration={musicPlayerControls.duration}
          formatTime={musicPlayerControls.formatTime}
          volumeLevel={musicPlayerControls.volume}
          onVolumeChange={musicPlayerControls.setVolume}
          eqBands={musicPlayerControls.eqBands ? {
            low: musicPlayerControls.eqBands.bass,
            mid: musicPlayerControls.eqBands.mid,
            high: musicPlayerControls.eqBands.treble,
          } : undefined}
          onEqChange={musicPlayerControls.setEqBands ? (bands) => musicPlayerControls.setEqBands({
            bass: bands.low,
            mid: bands.mid,
            treble: bands.high,
          }) : undefined}
          onClose={() => setShowPlayer(false)}
          isPatronageUnlock={false}
          onArtistClick={handleArtistClickFromPlayer}
        />
      )}



      {/* Artist Profile Modal */}
      {showArtistProfile && selectedArtist && (
        <ArtistProfileScreenV2
          artist={selectedArtist}
          onClose={() => setShowArtistProfile(false)}
          onShowPatronageLock={() => setShowPatronageLock(true)}
        />
      )}

      {/* Playlist Creation Modal */}
      {showPlaylistCreation && (
        <PlaylistCreationScreen
          onClose={() => setShowPlaylistCreation(false)}
          onPublish={handlePublishPlaylist}
        />
      )}

      {/* Connection Audit Modal */}
      {showConnectionAudit && selectedConnection && (
        <ConnectionAuditModal
          isOpen={showConnectionAudit}
          onClose={() => setShowConnectionAudit(false)}
          userName={selectedConnection.user.name}
          userAvatar={selectedConnection.user.avatar}
          matchScore={selectedConnection.matchScore}
          mutualArtists={selectedConnection.mutualArtists}
          onConnect={handleConnect}
          onConnectSuccess={() => setShowConnectionSuccess(true)}
        />
      )}

      {/* Connection Success Modal */}
      {showConnectionSuccess && selectedConnection && (
        <ConnectionSuccessModal
          isOpen={showConnectionSuccess}
          onClose={() => setShowConnectionSuccess(false)}
          userName={selectedConnection.user.name}
          userAvatar={selectedConnection.user.avatar}
        />
      )}

      {/* Patronage Lock Modal */}
      {showPatronageLock && selectedArtist && (
        <PatronageLockModal
          isOpen={showPatronageLock}
          onClose={() => setShowPatronageLock(false)}
          artistName={selectedArtist.name}
          daysRemaining={18}
          onPayEarlyUnlock={() => {
            console.log('Early unlock paid');
            setShowPatronageLock(false);
          }}
        />
      )}

      {/* Connection Management Modal */}
      {showConnectionManagement && (
        <ConnectionManagementScreen
          isOpen={showConnectionManagement}
          onClose={() => setShowConnectionManagement(false)}
        />
      )}

      {/* User Settings Modal */}
      <UserSettingsModal
        isOpen={showUserSettings}
        onClose={() => setShowUserSettings(false)}
        userName={currentUser?.name || 'Guest'}
        userAvatar={currentUser?.avatar || ''}
      />

      {/* Music Player - always fixed (shows empty state without a track) */}
      <MusicPlayer
        currentTrack={currentPlayingTrack}
        playlist={playlist}
        onTrackChange={handleTrackChange}
        isVisible={true}
        onControlsReady={setMusicPlayerControls}
        sidebarCollapsed={sidebarCollapsed}
        externalIsPlaying={isPlaying}
        onCreatePlaylist={() => setShowPlaylistCreation(true)}
        onExpandPlayer={() => {
          // Ensure PlayerApple has a track to render
          if (!currentTrack && currentPlayingTrack) {
            setCurrentTrack({
              id: currentPlayingTrack.id,
              title: currentPlayingTrack.title || currentPlayingTrack.name || 'Untitled',
              name: currentPlayingTrack.name || currentPlayingTrack.title,
              artist: currentPlayingTrack.artist,
              album: currentPlayingTrack.album || 'Unknown Album',
              coverArt: currentPlayingTrack.coverArt || currentPlayingTrack.coverImage,
              audioUrl: currentPlayingTrack.audioUrl,
              quality: currentPlayingTrack.quality || 'MP3',
              duration: '0:00',
              isPatronage: false,
            });
          }
          setShowPlayer(true);
        }}
      />
    </div>
  );
}

const openPlaylistDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BrickMusicDB', 4);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create localTracks store if it doesn't exist
      if (!db.objectStoreNames.contains('localTracks')) {
        db.createObjectStore('localTracks', { keyPath: 'id' });
      }
      
      // Create playlists store if it doesn't exist
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id' });
      }
    };
  });
};