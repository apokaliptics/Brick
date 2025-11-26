import { useState, useEffect, useRef } from 'react';
import { Home, Zap, User, Plus, List, Search, Disc3, Play, X } from 'lucide-react';
import { HomeScreenV2 } from './components/screens/HomeScreenV2';
import { RadarScreen } from './components/screens/RadarScreen';
import { VaultScreen } from './components/screens/VaultScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { FeedScreen } from './components/screens/FeedScreen';
import { PlaylistCreationScreen } from './components/screens/PlaylistCreationScreen';
import { LoginScreen } from './components/screens/LoginScreen';
import { ImportScreen } from './components/screens/ImportScreen';
import { ConnectionManagementScreen } from './components/screens/ConnectionManagementScreen';
import { ArtistProfileScreenV2 } from './components/screens/ArtistProfileScreenV2';
import { MusicPlayer } from './components/MusicPlayer';
import { LocalMusicUploader } from './components/LocalMusicUploader';
import { PlayerV3 } from './components/PlayerV3';
import { Navigation } from './components/Navigation';
import { ConnectionAuditModal } from './components/modals/ConnectionAuditModal';
import { ConnectionSuccessModal } from './components/modals/ConnectionSuccessModal';
import { PatronageLockModal } from './components/modals/PatronageLockModal';
import { ImageWithFallback } from './components/figma/ImageWithFallback';
import type { Track as MusicPlayerTrack } from './components/MusicPlayer';
import { mockPlaylists, mockTracks, mockCurrentUser, mockArtists, mockConnections } from './data/mockData';
import type { Track, Playlist, Screen } from './types';
import './styles/globals.css';

export default function App() {
  // Auth states
  const [authState, setAuthState] = useState<'login' | 'import' | 'authenticated'>('login');
  
  // Set document title
  useEffect(() => {
    document.title = 'Brick';
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
  
  // Modal states
  const [showArtistProfile, setShowArtistProfile] = useState(false);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [showPlaylistCreation, setShowPlaylistCreation] = useState(false);
  const [showConnectionAudit, setShowConnectionAudit] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showConnectionSuccess, setShowConnectionSuccess] = useState(false);
  const [showPatronageLock, setShowPatronageLock] = useState(false);
  const [showConnectionManagement, setShowConnectionManagement] = useState(false);

  // Auth handlers
  const handleLogin = () => {
    setAuthState('authenticated');
  };

  const handleSignup = () => {
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
                  console.log('Recreated blob URL for track:', track.title);
                }
              } catch (error) {
                console.error('Failed to load local track:', error);
              }
            }
            
            return {
              id: track.id,
              name: track.title,
              artist: track.artist,
              album: track.album,
              coverImage: track.coverArt,
              audioUrl: audioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
              quality: track.quality,
            };
          })
        );
        
        console.log('Loaded local playlist with tracks:', playerTracks);
        setPlaylist(playerTracks);
        setCurrentPlayingTrack(playerTracks[0]);
        
        // Convert first track to Track format for PlayerV3
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
    
    const playerTracks = foundPlaylist.tracks.map(track => ({
      id: track.id,
      name: track.title,
      artist: track.artist,
      album: track.album,
      coverImage: track.coverArt,
      audioUrl: track.audioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      quality: track.quality,
    }));
    
    setPlaylist(playerTracks);
    setCurrentPlayingTrack(playerTracks[0]);
    
    // Also keep old player for backward compatibility
    setCurrentTrack(playerTracks[0]);
    setShowPlayer(true);
    setIsPlaying(true);
  };

  const handleLocalTrackPlay = (localTrack: any) => {
    console.log('Playing local track:', localTrack);
    
    // Convert local track to player format with actual metadata
    const playerTrack = {
      id: localTrack.id,
      name: localTrack.name,
      artist: localTrack.artist || 'Unknown Artist',
      album: localTrack.album || 'Unknown Album',
      coverImage: localTrack.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      audioUrl: localTrack.url,
      quality: localTrack.format,
      duration: localTrack.duration,
    };

    // Convert to Track format for PlayerV3
    const trackFormat: Track = {
      id: localTrack.id,
      title: localTrack.name,
      artist: localTrack.artist || 'Unknown Artist',
      album: localTrack.album || 'Unknown Album',
      coverArt: localTrack.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      audioUrl: localTrack.url,
      quality: localTrack.format,
      duration: localTrack.duration.toString(),
      isPatronage: false,
    };

    // Set as single-track playlist
    setPlaylist([playerTrack]);
    setCurrentPlayingTrack(playerTrack);
    setCurrentTrack(trackFormat);
    setShowPlayer(true);
    setIsPlaying(true);
  };

  const handleLocalAlbumPlay = (localTracks: any[]) => {
    console.log('Playing local album with', localTracks.length, 'tracks');
    
    // Convert local tracks to player format
    const playerTracks = localTracks.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artist || 'Unknown Artist',
      album: track.album || 'Unknown Album',
      coverImage: track.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      audioUrl: track.url,
      quality: track.format,
      duration: track.duration,
    }));

    // Convert first track to Track format for PlayerV3
    const firstTrack = localTracks[0];
    const trackFormat: Track = {
      id: firstTrack.id,
      title: firstTrack.name,
      artist: firstTrack.artist || 'Unknown Artist',
      album: firstTrack.album || 'Unknown Album',
      coverArt: firstTrack.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      audioUrl: firstTrack.url,
      quality: firstTrack.format,
      duration: firstTrack.duration.toString(),
      isPatronage: false,
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
    
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name,
      artist: 'Your Collection',
      coverImage: tracks[0]?.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      totalDuration: tracks.reduce((acc, track) => {
        const [mins, secs] = track.duration.split(':').map(Number);
        return acc + (mins * 60) + secs;
      }, 0),
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

    // Genre compatibility matrix
    const genreGroups = {
      rock: ['rock', 'alternative rock', 'indie rock', 'hard rock', 'punk rock', 'grunge', 'alt-rock', 'alternative', 'punk', 'garage rock', 'psychedelic rock'],
      metal: ['metal', 'heavy metal', 'thrash metal', 'death metal', 'black metal', 'metalcore', 'doom metal', 'progressive metal', 'nu metal'],
      shoegaze: ['shoegaze', 'dream pop', 'ambient', 'post-rock', 'noise rock', 'ethereal', 'atmospheric'],
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

    // Calculate compatibility
    let compatiblePairs = 0;
    let totalPairs = 0;

    for (let i = 0; i < trackGroupMemberships.length; i++) {
      for (let j = i + 1; j < trackGroupMemberships.length; j++) {
        if (trackGenres[i] === 'unknown' || trackGenres[j] === 'unknown') continue;
        
        totalPairs++;
        const track1Groups = trackGroupMemberships[i].groups;
        const track2Groups = trackGroupMemberships[j].groups;
        
        const hasSharedGroup = track1Groups.some(g => track2Groups.includes(g));
        if (hasSharedGroup) compatiblePairs++;
      }
    }

    if (totalPairs === 0) return 50;

    const compatibilityRatio = compatiblePairs / totalPairs;
    
    let baseScore;
    if (compatibilityRatio >= 0.9) baseScore = 95;
    else if (compatibilityRatio >= 0.7) baseScore = 80;
    else if (compatibilityRatio >= 0.5) baseScore = 60;
    else if (compatibilityRatio >= 0.3) baseScore = 40;
    else baseScore = Math.round(compatibilityRatio * 100);
    
    return Math.max(0, Math.round(baseScore - unknownPenalty));
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
    <div className="min-h-screen" style={{ backgroundColor: '#1a1a1a' }}>
      {/* Main Content */}
      <div className="max-w-6xl mx-auto pb-20 md:pb-6">
        {activeTab === 'home' && (
          <>
            <HomeScreenV2
              onPlaylistClick={handlePlaylistClick}
              onArtistPress={handleArtistPress}
              onFeedClick={() => setActiveTab('feed' as Screen)}
              activeFilter={homeFilter}
              onFilterChange={handleFilterChange}
              onLocalTrackPlay={handleLocalTrackPlay}
              onLocalAlbumPlay={handleLocalAlbumPlay}
            />
            
            {/* Floating Action Button - Create Blueprint */}
            <button
              onClick={() => setShowPlaylistCreation(true)}
              className="fixed bottom-24 md:bottom-8 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40 transition-all duration-200 hover:scale-110 active:scale-95"
              style={{
                background: 'linear-gradient(to bottom, #d32f2f, #b71c1c)',
                boxShadow: '0 4px 20px rgba(211, 47, 47, 0.4)',
              }}
            >
              <Plus size={24} color="#e0e0e0" strokeWidth={3} />
            </button>
          </>
        )}
        
        {activeTab === 'radar' && (
          <RadarScreen onUserClick={handleUserClick} />
        )}
        
        {activeTab === 'profile' && (
          <>
            <ProfileScreen onPlaylistClick={handlePlaylistClick} />
            
            {/* Floating Action Button - Create Playlist */}
            <button
              onClick={() => setShowPlaylistCreation(true)}
              className="fixed bottom-24 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-40 transition-all duration-200 hover:scale-110 active:scale-95"
              style={{
                background: 'linear-gradient(to bottom, #d32f2f, #b71c1c)',
                boxShadow: '0 4px 20px rgba(211, 47, 47, 0.4)',
              }}
            >
              <Plus size={24} color="#e0e0e0" strokeWidth={3} />
            </button>
          </>
        )}
        
        {activeTab === 'vault' && <VaultScreen onOpenConnectionManagement={() => setShowConnectionManagement(true)} />}
        
        {/* Feed Button - Removed, now in pill navigation */}
      </div>

      {/* Feed Screen (Full screen overlay) */}
      {activeTab === 'feed' && (
        <div className="fixed inset-0 z-50 bg-[#1a1a1a] overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#333333]"
              style={{
                backgroundColor: 'rgba(30, 30, 30, 0.95)',
                backdropFilter: 'blur(40px)',
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
            <FeedScreen />
          </div>
        </div>
      )}

      {/* Navigation */}
      <Navigation
        activeTab={activeTab === 'feed' ? 'home' : activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        activeFilter={activeTab === 'home' ? homeFilter : undefined}
        onFilterChange={activeTab === 'home' ? handleFilterChange : undefined}
      />

      {/* Player Overlay */}
      {showPlayer && musicPlayerControls && (
        <PlayerV3
          track={currentTrack}
          connectionName="Jordan Rivera"
          isPlaying={musicPlayerControls.isPlaying}
          onPlayPause={musicPlayerControls.togglePlayPause}
          onNext={musicPlayerControls.handleNext}
          onPrevious={musicPlayerControls.handlePrevious}
          currentTime={musicPlayerControls.currentTime}
          duration={musicPlayerControls.duration}
          formatTime={musicPlayerControls.formatTime}
          onClose={() => setShowPlayer(false)}
          isPatronageUnlock={false}
          onArtistClick={handleArtistClickFromPlayer}
        />
      )}

      {/* Mini Player Bar (when player is closed but track is active) */}
      {!showPlayer && currentTrack && activeTab !== 'feed' && (
        <div
          onClick={() => setShowPlayer(true)}
          className="fixed bottom-28 md:bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-96 p-3 rounded-xl cursor-pointer z-40 transition-all duration-200 hover:scale-[1.01] spring-in"
          style={{
            backgroundColor: 'rgba(26, 26, 26, 0.5)',
            backdropFilter: 'blur(60px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="flex items-center gap-3">
            <ImageWithFallback
              src={currentTrack.coverArt}
              alt={currentTrack.album}
              className="w-12 h-12 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="truncate" style={{ color: '#e0e0e0' }}>
                {currentTrack.title}
              </p>
              <p className="truncate" style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
                {currentTrack.artist}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPlaying(!isPlaying);
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-110"
              style={{
                backgroundColor: '#d32f2f',
              }}
            >
              {isPlaying ? (
                <span style={{ color: '#e0e0e0', fontSize: '0.875rem' }}>❚❚</span>
              ) : (
                <span style={{ color: '#e0e0e0', fontSize: '0.875rem' }}>▶</span>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentTrack(null);
                setIsPlaying(false);
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-[#333333]"
            >
              <X size={16} color="#a0a0a0" />
            </button>
          </div>
        </div>
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

      {/* Music Player */}
      {currentPlayingTrack && (
        <MusicPlayer
          currentTrack={currentPlayingTrack}
          playlist={playlist}
          onTrackChange={handleTrackChange}
          isVisible={!showPlayer}
          onControlsReady={setMusicPlayerControls}
        />
      )}
    </div>
  );
}

const openPlaylistDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BrickMusicDB', 2);
    
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