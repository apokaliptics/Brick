import { useState } from 'react';
import { Navigation } from './components/Navigation';
import { PlayerV3 } from './components/PlayerV3';
import { MusicPlayer } from './components/MusicPlayer';
import { LoginScreen } from './components/screens/LoginScreen';
import { ImportScreen } from './components/screens/ImportScreen';
import { HomeScreenV2 } from './components/screens/HomeScreenV2';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { RadarScreen } from './components/screens/RadarScreen';
import { VaultScreen } from './components/screens/VaultScreen';
import { FeedScreen } from './components/screens/FeedScreen';
import { ArtistProfileScreenV2 } from './components/screens/ArtistProfileScreenV2';
import { PlaylistCreationScreen } from './components/screens/PlaylistCreationScreen';
import { ConnectionManagementScreen } from './components/screens/ConnectionManagementScreen';
import { ConnectionAuditModal } from './components/modals/ConnectionAuditModal';
import { ConnectionSuccessModal } from './components/modals/ConnectionSuccessModal';
import { PatronageLockModal } from './components/modals/PatronageLockModal';
import { mockTracks, mockArtists, mockConnections } from './data/mockData';
import { Plus, X } from 'lucide-react';
import { Track } from './types';

type Screen = 'home' | 'radar' | 'profile' | 'vault' | 'feed';
type AuthState = 'login' | 'import' | 'authenticated';

export default function App() {
  // Auth states
  const [authState, setAuthState] = useState<AuthState>('login');
  
  // Screen states
  const [activeTab, setActiveTab] = useState<Screen>('home');
  const [homeFilter, setHomeFilter] = useState<'all' | 'payroll' | 'network' | 'recent' | 'feed'>('all');
  const [showPlayer, setShowPlayer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(mockTracks[0]);
  
  // Music player state
  const [currentPlayingTrack, setCurrentPlayingTrack] = useState<any>(null);
  const [playlist, setPlaylist] = useState<any[]>([]);
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
  const handlePlaylistClick = (playlistId: string) => {
    // Convert mock tracks to player format and start playing
    const playerTracks = mockTracks.map(track => ({
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
    setCurrentTrack(mockTracks[0]);
    setShowPlayer(true);
    setIsPlaying(true);
  };

  const handleLocalTrackPlay = (localTrack: any) => {
    console.log('Playing local track:', localTrack);
    
    // Convert local track to player format
    const playerTrack = {
      id: localTrack.id,
      name: localTrack.name,
      artist: 'Local Artist',
      album: 'Local Files',
      coverImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      audioUrl: localTrack.url,
      quality: localTrack.format,
      duration: localTrack.duration,
    };

    // Convert to Track format for PlayerV3
    const trackFormat: Track = {
      id: localTrack.id,
      title: localTrack.name,
      artist: 'Local Artist',
      album: 'Local Files',
      coverArt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
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
    const artist = mockArtists.find(a => a.name === currentTrack.artist);
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

  const handlePublishPlaylist = (name: string, tracks: Track[]) => {
    console.log('Playlist published:', name, tracks);
    setShowPlaylistCreation(false);
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
            <img
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