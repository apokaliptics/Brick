import { useState, useEffect } from 'react';
import { HeroCarousel } from '../HeroCarousel';
import { NetworkStories } from '../NetworkStories';
import { BrickCard } from '../BrickCard';
import { LocalMusicUploader } from '../LocalMusicUploader';
import { mockArtists, mockPlaylists, mockConnections } from '../../data/mockData';
import { getRecentlyPlayedTracks, RecentlyPlayedTrack } from '../../utils/recentlyPlayed';
import { getRecentlyPlayedPlaylists, RecentlyPlayedPlaylist } from '../../utils/recentlyPlayedPlaylists';
import { Play, X, Grid3x3, Orbit } from 'lucide-react';

interface HomeScreenV2Props {
  onPlaylistClick: (playlistId: string) => void;
  onArtistPress: (artistId: string) => void;
  onFeedClick?: () => void;
  activeFilter?: 'all' | 'payroll' | 'network' | 'recent' | 'feed';
  onFilterChange?: (filter: 'all' | 'payroll' | 'network' | 'recent' | 'feed') => void;
  onLocalTrackPlay?: (track: any) => void;
  onLocalAlbumPlay?: (tracks: any[]) => void;
}

export function HomeScreenV2({ 
  onPlaylistClick, 
  onArtistPress, 
  onFeedClick, 
  activeFilter: externalActiveFilter, 
  onFilterChange: externalOnFilterChange,
  onLocalTrackPlay,
  onLocalAlbumPlay,
}: HomeScreenV2Props) {
  const [internalActiveFilter, setInternalActiveFilter] = useState<'all' | 'payroll' | 'network' | 'recent' | 'feed'>('all');
  const [localAudio, setLocalAudio] = useState<HTMLAudioElement | null>(null);
  const [currentLocalTrack, setCurrentLocalTrack] = useState<any>(null);
  const [isLocalPlaying, setIsLocalPlaying] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'brick' | 'spiral'>('brick');
  const [recentPlaylists, setRecentPlaylists] = useState<RecentlyPlayedPlaylist[]>([]);
  const [recentTracks, setRecentTracks] = useState<RecentlyPlayedTrack[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Use external filter state if provided, otherwise use internal state
  const activeFilter = externalActiveFilter !== undefined ? externalActiveFilter : internalActiveFilter;
  const onFilterChange = externalOnFilterChange || setInternalActiveFilter;

  // Load recently played items
  useEffect(() => {
    console.log('HomeScreenV2 useEffect triggered - loading recent items');
    let isMounted = true;

    const loadRecentItems = async () => {
      try {
        console.log('Starting sequential loading of recent items...');
        setLoadingRecent(true);

        // Load playlists first
        console.log('Loading recently played playlists...');
        const playlists = await getRecentlyPlayedPlaylists(3);
        console.log('Successfully loaded playlists:', playlists);

        if (!isMounted) {
          console.log('Component unmounted during playlist loading, aborting');
          return;
        }

        // Load tracks second
        console.log('Loading recently played tracks...');
        const tracks = await getRecentlyPlayedTracks(3);
        console.log('Successfully loaded tracks:', tracks);

        if (!isMounted) {
          console.log('Component unmounted during track loading, aborting');
          return;
        }

        // Update state
        console.log('Setting recent items state');
        setRecentPlaylists(playlists);
        setRecentTracks(tracks);
        console.log('Recent items state updated successfully');

      } catch (error) {
        console.error('Failed to load recent items:', error);
        if (isMounted) {
          setRecentPlaylists([]);
          setRecentTracks([]);
        }
      } finally {
        if (isMounted) {
          setLoadingRecent(false);
          console.log('Loading recent items completed');
        }
      }
    };

    loadRecentItems();

    return () => {
      console.log('HomeScreenV2 useEffect cleanup - component unmounting');
      isMounted = false;
    };
  }, []);

  const chosenArtists = mockArtists.slice(0, 2);
  const networkPlaylists = mockPlaylists.slice(0, 5);

  const handleFilterChange = (filter: 'all' | 'payroll' | 'network' | 'recent' | 'feed') => {
    if (filter === 'feed' && onFeedClick) {
      onFeedClick();
    } else {
      onFilterChange(filter);
    }
  };

  // Handle local track playback
  const handlePlayLocalTrack = (track: any) => {
    // Stop previous audio if exists
    if (localAudio) {
      localAudio.pause();
      localAudio.currentTime = 0;
    }

    // If same track, toggle play/pause
    if (currentLocalTrack?.id === track.id) {
      if (isLocalPlaying) {
        localAudio?.pause();
        setIsLocalPlaying(false);
      } else {
        localAudio?.play();
        setIsLocalPlaying(true);
      }
      return;
    }

    // Play new track
    const audio = new Audio(track.url);
    audio.addEventListener('ended', () => {
      setIsLocalPlaying(false);
    });
    audio.play();
    
    setLocalAudio(audio);
    setCurrentLocalTrack(track);
    setIsLocalPlaying(true);

    // Call onLocalTrackPlay if provided
    if (onLocalTrackPlay) {
      onLocalTrackPlay(track);
    }
  };

  // Get dynamic size based on structural integrity
  const getCardSize = (structuralIntegrity: number | undefined): 'small' | 'medium' | 'large' => {
    if (!structuralIntegrity) return 'medium';
    if (structuralIntegrity >= 85) return 'large';
    if (structuralIntegrity >= 70) return 'medium';
    return 'small';
  };

  // Render bricks in spiral layout
  const renderSpiralLayout = (playlists: any[]) => {
    // Sort by structural integrity descending
    const sorted = [...playlists].sort((a, b) => 
      (b.structuralIntegrity || 0) - (a.structuralIntegrity || 0)
    );

    return (
      <div 
        className="relative rounded-2xl mb-6 overflow-hidden flex items-center justify-center"
        style={{ 
          minHeight: '800px',
          backgroundColor: '#151515',
          border: '1px solid #333333',
        }}
      >
        {/* Concentric Circles */}
        {[150, 300, 450].map((size, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              border: '1px solid rgba(211, 47, 47, 0.15)',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}

        {/* Center Album (Highest Integrity) */}
        {sorted[0] && (
          <div
            className="absolute cursor-pointer group"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            onClick={() => onPlaylistClick(sorted[0].id)}
          >
            <img
              src={sorted[0].coverImage}
              alt={sorted[0].name}
              className="rounded-xl transition-all duration-300 group-hover:scale-110"
              style={{
                width: '140px',
                height: '140px',
                objectFit: 'cover',
                boxShadow: '0 0 40px rgba(211, 47, 47, 0.6)',
                border: '3px solid #d32f2f',
              }}
            />
            {/* Tooltip */}
            <div
              className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{
                backgroundColor: '#252525',
                border: '1px solid #333333',
              }}
            >
              <p className="mono" style={{ color: '#e0e0e0', fontSize: '0.75rem' }}>
                {sorted[0].name}
              </p>
              <p className="mono" style={{ color: '#d32f2f', fontSize: '0.7rem' }}>
                {sorted[0].structuralIntegrity}% Integrity
              </p>
            </div>
          </div>
        )}

        {/* Orbiting Albums */}
        {sorted.slice(1).map((playlist, index) => {
          const integrity = playlist.structuralIntegrity || 50;
          const size = integrity >= 85 ? 100 : integrity >= 70 ? 80 : 60;
          
          // Position in orbit
          const totalItems = sorted.length - 1;
          const angle = (index / totalItems) * Math.PI * 2;
          const orbitRadius = integrity >= 85 ? 150 : integrity >= 70 ? 220 : 290;
          const x = 50 + Math.cos(angle) * (orbitRadius / 8);
          const y = 50 + Math.sin(angle) * (orbitRadius / 8);

          return (
            <div
              key={playlist.id}
              className="absolute cursor-pointer group"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              onClick={() => onPlaylistClick(playlist.id)}
            >
              {/* Pulse Effect */}
              <div
                className="absolute inset-0 rounded-lg animate-ping"
                style={{
                  backgroundColor: 'rgba(211, 47, 47, 0.2)',
                  width: `${size}px`,
                  height: `${size}px`,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
              
              {/* Album Image */}
              <img
                src={playlist.coverImage}
                alt={playlist.name}
                className="relative rounded-lg transition-all duration-300 group-hover:scale-125"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  objectFit: 'cover',
                  border: '2px solid #d32f2f',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
                }}
              />

              {/* Tooltip */}
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                style={{
                  backgroundColor: '#252525',
                  border: '1px solid #333333',
                }}
              >
                <p className="mono" style={{ color: '#e0e0e0', fontSize: '0.7rem' }}>
                  {playlist.name}
                </p>
                <p className="mono" style={{ color: '#d32f2f', fontSize: '0.65rem' }}>
                  {integrity}% Integrity
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderContent = () => {
    // FEED VIEW
    if (activeFilter === 'feed') {
      return null; // Will be handled by parent
    }

    // ALL VIEW (Default)
    if (activeFilter === 'all') {
      return (
        <>
          {/* Hero Carousel - Chosen Artists */}
          <HeroCarousel artists={chosenArtists} onArtistPress={onArtistPress} />

          {/* Local Music Uploader */}
          <div className="px-6 pt-8">
            <LocalMusicUploader
              onPlayTrack={handlePlayLocalTrack}
              onPlayAlbum={onLocalAlbumPlay}
              currentPlayingId={currentLocalTrack?.id}
              isPlaying={isLocalPlaying}
            />
          </div>

          {/* Recent Materials Section */}
          <div className="px-6 pb-24">
            <h3 className="mb-4" style={{ color: '#e0e0e0' }}>
              Recent Materials
            </h3>

            {loadingRecent ? (
              <div className="text-center py-8">
                <p style={{ color: '#a0a0a0' }}>Loading recent materials...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Recently Played Playlists */}
                {recentPlaylists.map((playlist: RecentlyPlayedPlaylist) => (
                  <button
                    key={`playlist-${playlist.playlistId}`}
                    onClick={() => onPlaylistClick(playlist.playlistId)}
                    className="w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 hover:bg-[#252525]"
                    style={{
                      backgroundColor: 'rgba(37, 37, 37, 0.5)',
                    }}
                  >
                    {/* Album Art */}
                    <img
                      src={playlist.coverImage}
                      alt={playlist.playlistName}
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <h4 className="truncate mb-1" style={{ color: '#e0e0e0' }}>
                        {playlist.playlistName}
                      </h4>
                      <p
                        className="truncate"
                        style={{ color: '#a0a0a0', fontSize: '0.875rem' }}
                      >
                        {typeof playlist.creatorName === 'string' ? playlist.creatorName : 'Your Collection'} • {playlist.trackCount} tracks
                      </p>
                    </div>

                    {/* Play Button */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: '#d32f2f',
                      }}
                    >
                      <Play size={16} fill="#e0e0e0" color="#e0e0e0" />
                    </div>
                  </button>
                ))}

                {/* Recently Played Tracks */}
                {recentTracks.map((track: RecentlyPlayedTrack) => (
                  <button
                    key={`track-${track.trackId}`}
                    onClick={() => {
                      // Handle track play - you might need to pass this up to parent
                      if (onLocalTrackPlay) {
                        onLocalTrackPlay({
                          id: track.trackId,
                          name: track.trackTitle,
                          artist: track.artistName,
                          coverArt: track.coverArt,
                          url: track.audioUrl,
                          duration: '0:00', // Will be updated by player
                          format: 'MP3',
                        });
                      }
                    }}
                    className="w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 hover:bg-[#252525]"
                    style={{
                      backgroundColor: 'rgba(37, 37, 37, 0.5)',
                    }}
                  >
                    {/* Album Art */}
                    <img
                      src={track.coverArt}
                      alt={track.trackTitle}
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <h4 className="truncate mb-1" style={{ color: '#e0e0e0' }}>
                        {track.trackTitle}
                      </h4>
                      <p
                        className="truncate"
                        style={{ color: '#a0a0a0', fontSize: '0.875rem' }}
                      >
                        {track.artistName}
                      </p>
                    </div>

                    {/* Play Button */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: '#d32f2f',
                      }}
                    >
                      <Play size={16} fill="#e0e0e0" color="#e0e0e0" />
                    </div>
                  </button>
                ))}

                {/* Show message if no recent items */}
                {recentPlaylists.length === 0 && recentTracks.length === 0 && (
                  <div className="text-center py-8">
                    <p style={{ color: '#a0a0a0' }}>No recent materials yet</p>
                    <p style={{ color: '#666666', fontSize: '0.875rem' }}>Play some music to see it here</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      );
    }

    // PAYROLL VIEW
    if (activeFilter === 'payroll') {
      return (
        <>
          <HeroCarousel artists={chosenArtists} onArtistPress={onArtistPress} />

          <div className="px-6 pt-8 pb-24">
            <div
              className="p-6 rounded-2xl text-center"
              style={{
                backgroundColor: 'rgba(30, 30, 30, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <h4 className="mb-2" style={{ color: '#e0e0e0' }}>
                Your Monthly Support
              </h4>
              <p className="mono mb-4" style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
                You're directly supporting {chosenArtists.length} artists this month
              </p>
              <div className="flex justify-center gap-8">
                {chosenArtists.map((artist) => (
                  <div key={artist.id}>
                    <p className="mono" style={{ color: '#d32f2f', fontSize: '1.5rem' }}>
                      $8.00
                    </p>
                    <p style={{ color: '#cccccc', fontSize: '0.875rem' }}>
                      {artist.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      );
    }

    // NETWORK VIEW
    if (activeFilter === 'network') {
      return (
        <>
          {/* Stories */}
          <NetworkStories
            connections={mockConnections}
            onStoryClick={(id) => console.log('Story clicked:', id)}
          />

          {/* Network Feed */}
          <div className="px-6 pt-4 pb-24">
            {/* Header with Layout Toggle */}
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: '#e0e0e0' }}>
                From Your Connections
              </h3>
              
              {/* Layout Mode Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setLayoutMode('brick')}
                  className="p-2 rounded-lg transition-all duration-200"
                  style={{
                    backgroundColor: layoutMode === 'brick' ? 'rgba(211, 47, 47, 0.15)' : 'rgba(37, 37, 37, 0.5)',
                    border: `1px solid ${layoutMode === 'brick' ? '#d32f2f' : 'rgba(255, 255, 255, 0.05)'}`,
                  }}
                  title="Brick Look"
                >
                  <Grid3x3 size={18} color={layoutMode === 'brick' ? '#d32f2f' : '#a0a0a0'} />
                </button>
                <button
                  onClick={() => setLayoutMode('spiral')}
                  className="p-2 rounded-lg transition-all duration-200"
                  style={{
                    backgroundColor: layoutMode === 'spiral' ? 'rgba(211, 47, 47, 0.15)' : 'rgba(37, 37, 37, 0.5)',
                    border: `1px solid ${layoutMode === 'spiral' ? '#d32f2f' : 'rgba(255, 255, 255, 0.05)'}`,
                  }}
                  title="Spiral View"
                >
                  <Orbit size={18} color={layoutMode === 'spiral' ? '#d32f2f' : '#a0a0a0'} />
                </button>
              </div>
            </div>

            {/* Render based on layout mode */}
            {layoutMode === 'brick' ? (
              <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {networkPlaylists
                  .sort((a, b) => (b.structuralIntegrity || 0) - (a.structuralIntegrity || 0))
                  .map((playlist) => {
                    const size = getCardSize(playlist.structuralIntegrity);
                    return (
                      <div
                        key={playlist.id}
                        className={size === 'large' ? 'col-span-2' : ''}
                      >
                        <BrickCard
                          playlist={playlist}
                          onClick={() => onPlaylistClick(playlist.id)}
                          size="small"
                        />
                      </div>
                    );
                  })}
              </div>
            ) : (
              renderSpiralLayout(networkPlaylists)
            )}
          </div>
        </>
      );
    }

    // RECENT VIEW
    if (activeFilter === 'recent') {
      return (
        <div className="px-6 pt-6 pb-24">
          {/* Header with Layout Toggle */}
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ color: '#e0e0e0' }}>
              Recently Played
            </h3>
            
            {/* Layout Mode Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setLayoutMode('brick')}
                className="p-2 rounded-lg transition-all duration-200"
                style={{
                  backgroundColor: layoutMode === 'brick' ? 'rgba(211, 47, 47, 0.15)' : 'rgba(37, 37, 37, 0.5)',
                  border: `1px solid ${layoutMode === 'brick' ? '#d32f2f' : 'rgba(255, 255, 255, 0.05)'}`,
                }}
                title="Brick Look"
              >
                <Grid3x3 size={18} color={layoutMode === 'brick' ? '#d32f2f' : '#a0a0a0'} />
              </button>
              <button
                onClick={() => setLayoutMode('spiral')}
                className="p-2 rounded-lg transition-all duration-200"
                style={{
                  backgroundColor: layoutMode === 'spiral' ? 'rgba(211, 47, 47, 0.15)' : 'rgba(37, 37, 37, 0.5)',
                  border: `1px solid ${layoutMode === 'spiral' ? '#d32f2f' : 'rgba(255, 255, 255, 0.05)'}`,
                }}
                title="Spiral View"
              >
                <Orbit size={18} color={layoutMode === 'spiral' ? '#d32f2f' : '#a0a0a0'} />
              </button>
            </div>
          </div>

          {/* Recently Played Tracks Section */}
          {recentTracks.length > 0 && (
            <div className="mb-8">
              <h4 className="mb-4" style={{ color: '#e0e0e0' }}>
                Recent Tracks
              </h4>
              <div className="space-y-3">
                {recentTracks.map((track: RecentlyPlayedTrack) => (
                  <button
                    key={`track-${track.trackId}`}
                    onClick={() => {
                      // Handle track play - you might need to pass this up to parent
                      if (onLocalTrackPlay) {
                        onLocalTrackPlay({
                          id: track.trackId,
                          name: track.trackTitle,
                          artist: track.artistName,
                          coverArt: track.coverArt,
                          url: track.audioUrl,
                          duration: '0:00', // Will be updated by player
                          format: 'MP3',
                        });
                      }
                    }}
                    className="w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 hover:bg-[#252525]"
                    style={{
                      backgroundColor: 'rgba(37, 37, 37, 0.5)',
                    }}
                  >
                    {/* Album Art */}
                    <img
                      src={track.coverArt}
                      alt={track.trackTitle}
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <h4 className="truncate mb-1" style={{ color: '#e0e0e0' }}>
                        {track.trackTitle}
                      </h4>
                      <p
                        className="truncate"
                        style={{ color: '#a0a0a0', fontSize: '0.875rem' }}
                      >
                        {track.artistName}
                      </p>
                    </div>

                    {/* Play Button */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: '#d32f2f',
                      }}
                    >
                      <Play size={16} fill="#e0e0e0" color="#e0e0e0" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recently Played Playlists Section */}
          {recentPlaylists.length > 0 && (
            <div className="mb-8">
              <h4 className="mb-4" style={{ color: '#e0e0e0' }}>
                Recent Playlists
              </h4>

              {/* Render based on layout mode */}
              {layoutMode === 'brick' ? (
                <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {recentPlaylists
                    .sort((a, b) => (b.structuralIntegrity || 0) - (a.structuralIntegrity || 0))
                    .map((playlist) => {
                      // Convert RecentlyPlayedPlaylist to Playlist format for BrickCard
                      const playlistForCard = {
                        id: playlist.playlistId,
                        name: playlist.playlistName,
                        coverImage: playlist.coverImage,
                        creator: playlist.creatorName,
                        trackCount: playlist.trackCount,
                        structuralIntegrity: playlist.structuralIntegrity || 50,
                      };
                      const size = getCardSize(playlist.structuralIntegrity);
                      return (
                        <div
                          key={playlist.playlistId}
                          className={size === 'large' ? 'col-span-2' : ''}
                        >
                          <BrickCard
                            playlist={playlistForCard}
                            onClick={() => onPlaylistClick(playlist.playlistId)}
                            size="small"
                          />
                        </div>
                      );
                    })}
                </div>
              ) : (
                renderSpiralLayout(recentPlaylists.map(p => ({
                  id: p.playlistId,
                  name: p.playlistName,
                  coverImage: p.coverImage,
                  structuralIntegrity: p.structuralIntegrity || 50,
                })))
              )}
            </div>
          )}

          {/* Show message if no recent items */}
          {recentPlaylists.length === 0 && recentTracks.length === 0 && (
            <div className="text-center py-12">
              <p style={{ color: '#a0a0a0' }}>No recently played items yet</p>
              <p style={{ color: '#666666', fontSize: '0.875rem' }}>Play some music to see it here</p>
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div className={`min-h-screen ${(activeFilter === 'network' || activeFilter === 'recent' || activeFilter === 'feed') ? 'pt-6 md:pt-16' : ''}`}>
      {/* Dynamic Content */}
      {renderContent()}
    </div>
  );
}
