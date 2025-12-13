/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Users, Music, Play, Pause, Volume2, Maximize, Clock, Disc } from 'lucide-react';
// import { useTheme } from '../../contexts/ThemeContext'; // UNRESOLVED: Mocking dependency
// import { mockConnections } from '../../data/mockData'; // UNRESOLVED: Mocking dependency
// Removed: import { searchTracks, getAllArtists, getAllGenres } from '../../utils/musicLibrary';
// The following imports are commented out as they are from the original file, 
// but we will define a simple type structure below.
// import type { Track, Artist } from '../../types'; 

// --- START: Mocked Dependencies for Compilation ---

// Mock data (previously from ../../data/mockData)
const mockConnections = [
    { user: { id: 'user1', name: 'Alina R.', avatar: 'https://placehold.co/40x40/4f46e5/ffffff?text=AR' }, matchScore: 85, x: 25, y: 75 },
    { user: { id: 'user2', name: 'Ben C.', avatar: 'https://placehold.co/40x40/10b981/ffffff?text=BC' }, matchScore: 72, x: 70, y: 20 },
    { user: { id: 'user3', name: 'Cathy L.', avatar: 'https://placehold.co/40x40/f97316/ffffff?text=CL' }, matchScore: 91, x: 45, y: 55 },
    { user: { id: 'user4', name: 'David M.', avatar: 'https://placehold.co/40x40/ef4444/ffffff?text=DM' }, matchScore: 65, x: 10, y: 30 },
];

// Mock useTheme hook (previously from ../../contexts/ThemeContext)
const useTheme = () => ({
    colors: {
        bg: { primary: '#1a1a1a', secondary: '#252525' },
        text: { primary: '#e0e0e0', secondary: '#a0aaae' },
        border: '#333333',
        accent: '#d32f2f', // Red accent color for the "Radar" theme
    }
});
// --- END: Mocked Dependencies for Compilation ---


// --- START: Internet Archive Utility Functions & Types ---

// Define simple types for search results, replacing external imports
interface SimpleArtist {
  id: string;
  name: string;
  genre: string;
  globalChosenUsers?: number;
  image?: string;
}

interface Track {
    id: string;
    title: string;
    artist: string;
    album: string;
    coverArt: string;
    duration: string;
    // IA-specific fields for display
    bitrate: string;
    downloadUrl: string;
}

// Global API constants
const IA_METADATA_BASE_URL = 'https://archive.org/metadata';
const IA_SEARCH_BASE_URL = 'https://archive.org/advancedsearch.php';
const IA_COVER_IMAGE_BASE_URL = 'https://archive.org/services/img';

// Utility function to format duration string/seconds to MM:SS or cleaner
const formatDuration = (length: string | undefined): string => {
    if (!length) return 'N/A';
    const totalSeconds = parseFloat(length);
    if (isNaN(totalSeconds)) return length; // Return original if not a number but exists
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Utility for robust API fetching with exponential backoff
const fetchWithRetry = async (url: string, maxRetries = 3): Promise<any> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                // If the error is 404/403, don't retry, just fail fast
                if (response.status === 404 || response.status === 403) {
                    throw new Error(`Item not found or forbidden (Status: ${response.status})`);
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // For the Search API, we sometimes need to handle non-JSON responses gracefully
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return response.json();
            } else {
                // Return text if not JSON (e.g., in some IA endpoints)
                return response.text(); 
            }

        } catch (err) {
            if (attempt < maxRetries - 1) {
                const delay = 2 ** attempt * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw err;
            }
        }
    }
};

// --- END: Internet Archive Utility Functions & Types ---


interface Connection {
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  matchScore: number;
  x: number;
  y: number;
}

interface RadarScreenProps {
  onUserClick: (userId: string) => void;
  onTrackClick?: (track: any, playlist: any[]) => void;
}

// --- Audio Player Component ---

interface AudioPlayerProps {
    currentTrack: Track | null;
    colors: ReturnType<typeof useTheme>['colors'];
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ currentTrack, colors }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Effect to handle track change and auto-play
    useEffect(() => {
        if (audioRef.current && currentTrack) {
            // Set the audio source
            audioRef.current.src = currentTrack.downloadUrl;
            // Load and attempt to play
            audioRef.current.load();
            audioRef.current.play().then(() => {
                setIsPlaying(true);
            }).catch(error => {
                console.error("Autoplay failed:", error);
                // Autoplay block is common, set playing state to false and let user click play button
                setIsPlaying(false);
            });
        } else if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        }
    }, [currentTrack]);

    const togglePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
            setVolume(newVolume);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
            setCurrentTime(0);
        }
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (!currentTrack) {
        return (
            <footer 
                className="fixed bottom-0 left-0 right-0 p-4 border-t shadow-2xl transition-transform duration-300"
                style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border }}
            >
                <p className="text-center text-sm" style={{ color: colors.text.secondary }}>
                    Search for music to start playing.
                </p>
            </footer>
        );
    }

    return (
        <footer 
            className="fixed bottom-0 left-0 right-0 p-4 border-t shadow-2xl transition-transform duration-300 z-10"
            style={{ backgroundColor: colors.bg.secondary, borderColor: colors.border }}
        >
            <div className="flex items-center space-x-4 max-w-7xl mx-auto">
                {/* Audio Element (Hidden) */}
                <audio 
                    ref={audioRef} 
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                />

                {/* Track Info */}
                <div className="flex items-center flex-1 min-w-0">
                    <img
                        src={currentTrack.coverArt}
                        alt={currentTrack.album}
                        className="w-10 h-10 rounded object-cover flex-shrink-0 mr-3"
                        onError={(e) => {
                            e.currentTarget.src = `https://placehold.co/40x40/252525/ffffff?text=IA`
                        }}
                    />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: colors.text.primary }}>
                            {currentTrack.title}
                        </p>
                        <p className="text-xs truncate" style={{ color: colors.text.secondary }}>
                            {currentTrack.artist} - {currentTrack.album}
                        </p>
                    </div>
                </div>

                {/* Controls */}
                <button
                    onClick={togglePlayPause}
                    className="p-2 rounded-full transition-colors duration-200"
                    style={{ backgroundColor: colors.accent, color: '#ffffff' }}
                >
                    {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
                </button>

                {/* Timeline */}
                <div className="flex items-center space-x-2 w-1/4 hidden md:flex">
                    <span className="text-xs" style={{ color: colors.text.secondary }}>{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        min="0"
                        max={duration}
                        value={currentTime}
                        onChange={(e) => {
                            if (audioRef.current) {
                                audioRef.current.currentTime = parseFloat(e.target.value);
                            }
                        }}
                        className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                        style={{ accentColor: colors.accent }}
                    />
                    <span className="text-xs" style={{ color: colors.text.secondary }}>{formatTime(duration)}</span>
                </div>

                {/* Volume */}
                <div className="flex items-center space-x-2 hidden sm:flex">
                    <Volume2 size={16} style={{ color: colors.text.secondary }} />
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                        style={{ accentColor: colors.accent }}
                    />
                </div>
            </div>
        </footer>
    );
}

// --- Main RadarScreen Component ---

export function RadarScreen({ onUserClick, onTrackClick }: RadarScreenProps) {
  const { colors } = useTheme();
  const [selectedUser, setSelectedUser] = useState<Connection | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchMode, setSearchMode] = useState<'users' | 'music'>('users');
  const [musicSearchResults, setMusicSearchResults] = useState<{ artists: SimpleArtist[], tracks: Track[] }>({ artists: [], tracks: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // NEW STATE: Currently playing track
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);


  // Clear search results when switching modes, but keep query
  useEffect(() => {
    setMusicSearchResults({ artists: [], tracks: [] });
    setSearchError(null);
  }, [searchMode]);


  // Add mock x/y coordinates to connections for radar visualization
  const mockUsers: Connection[] = mockConnections.map((conn, i) => {
    // Invert the score: Higher score = Smaller radius (closer to center)
    // We map 100-0 score to 10-45 radius (keeping some buffer from dead center)
    const normalizedScore = Math.max(0, Math.min(100, conn.matchScore));
    const radius = 45 - (normalizedScore * 0.35); 
    
    // Add some random "scatter" to the angle so they aren't perfectly aligned
    const angle = (i / mockConnections.length) * Math.PI * 2; 

    return {
        ...conn,
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
    };
  });

  // Filter users based on search query
  const filteredUsers = mockUsers.filter(user =>
    user.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearch = useCallback(async (query: string) => {
    setSearchError(null);

    if (searchMode === 'music' && query.length > 2) {
      setIsSearching(true);
      setMusicSearchResults({ artists: [], tracks: [] });

      try {
        // --- STEP 1: Search for Item IDs ---
        const q = `mediatype:audio AND (title:"${query}" OR subject:"${query}")`;
        const searchUrl = `${IA_SEARCH_BASE_URL}?q=${encodeURIComponent(q)}&fl[]=identifier&output=json&rows=15`;
        
        const searchData = await fetchWithRetry(searchUrl);
        
        const parsedSearchData = typeof searchData === 'string' ? JSON.parse(searchData) : searchData;
        const identifiers: string[] = parsedSearchData.response?.docs?.map((doc: { identifier: string }) => doc.identifier).filter(Boolean) || [];
        
        if (identifiers.length === 0) {
            setSearchError('No matching items found on Internet Archive.');
            setIsSearching(false);
            return;
        }

        // --- STEP 2 & 3: Fetch Metadata, Process, and Format Results ---
        const allTracks: Track[] = [];
        const fetchPromises = identifiers.map(async (identifier) => {
            try {
                const metadataUrl = `${IA_METADATA_BASE_URL}/${identifier}`;
                const itemData = await fetchWithRetry(metadataUrl);

                if (itemData.files) {
                    const albumTitle = Array.isArray(itemData.metadata.title) ? itemData.metadata.title[0] : itemData.metadata.title;
                    const artist = Array.isArray(itemData.metadata.creator) ? itemData.metadata.creator[0] : itemData.metadata.creator || 'Unknown Artist';
                    const coverArt = `${IA_COVER_IMAGE_BASE_URL}/${identifier}`;

                    itemData.files
                        .filter((file: any) => file.source === 'original' && file.format && file.format.includes('MP3'))
                        .forEach((file: any) => {
                            const trackName = file.title || file.name.replace(/\.(mp3|flac|ogg)$/i, '').replace(/_/g, ' ');
                            const trackDuration = formatDuration(file.length);
                            const trackBitrate = file.bitrate ? `${file.bitrate} kbps` : 'N/A';
                            const downloadUrl = `https://archive.org/download/${identifier}/${file.name}`;

                            allTracks.push({
                                id: `${identifier}-${file.name}`,
                                title: trackName,
                                artist: artist,
                                album: albumTitle,
                                coverArt: coverArt,
                                duration: trackDuration,
                                bitrate: trackBitrate,
                                downloadUrl: downloadUrl,
                            });
                        });
                }
            } catch (metadataError) {
                console.warn(`Failed to fetch metadata for item ${identifier}:`, metadataError);
            }
        });

        await Promise.allSettled(fetchPromises);
        
        const uniqueTracks = Array.from(new Map(allTracks.map(track => [track.id, track])).values());
        
        setMusicSearchResults(prev => ({ ...prev, tracks: uniqueTracks }));

      } catch (error) {
        console.error('Internet Archive search failed:', error);
        setSearchError('A critical error occurred while searching the Archive.');
      } finally {
        setIsSearching(false);
      }
    } else {
      setMusicSearchResults({ artists: [], tracks: [] });
    }
  }, [searchMode]); 

  const debouncedHandleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    // @ts-ignore
    if (window.searchTimer) {
        // @ts-ignore
        clearTimeout(window.searchTimer);
    }
    // @ts-ignore
    window.searchTimer = setTimeout(() => {
        handleSearch(value);
    }, 500);
  }, [handleSearch]);


  return (
    // Add pb-28 padding to ensure content is above the fixed audio player
    <div className="pb-28 px-6 pt-6 md:pt-16 min-h-screen"> 
      <div className="mb-6">
        <h2 className="mb-2" style={{ letterSpacing: '-0.02em', color: colors.text.primary }}>The Radar</h2>
        <p style={{ color: colors.text.secondary, fontSize: '0.95rem' }}>Discover users with compatible taste.</p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 focus-within:ring-2 focus-within:ring-[#d32f2f] focus-within:ring-opacity-30"
          style={{
            backgroundColor: colors.bg.secondary,
            border: `1px solid ${colors.border}`,
          }}
        >
          <Search size={20} color={colors.text.secondary} />
          <input
            type="text"
            placeholder={searchMode === 'users' ? 'Search for Materials (Architects, Genres, Bricks)...' : 'Search the Archive for songs, artists, albums...'}
            value={searchQuery}
            onChange={(e) => debouncedHandleSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            style={{ color: colors.text.primary, fontSize: '0.95rem' }}
          />
        </div>
      </div>

      {/* Debug Info */}
      <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: '#333333', border: '1px solid #555555' }}>
        <p className="mono text-xs" style={{ color: '#ffffff' }}>
          Debug: Search Mode: {searchMode} | Query: "{searchQuery}" | Artists: {musicSearchResults.artists.length} | Tracks: {musicSearchResults.tracks.length} | Error: {searchError || 'None'}
        </p>
      </div>


      {/* Search Mode Toggle */}
      <div className="mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setSearchMode('users')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: searchMode === 'users' ? colors.accent : colors.bg.secondary,
              color: searchMode === 'users' ? '#ffffff' : colors.text.secondary,
              border: '1px solid',
              borderColor: searchMode === 'users' ? colors.accent : colors.border,
              boxShadow: searchMode === 'users' ? '0 0 12px rgba(211, 47, 47, 0.3)' : 'none',
            }}
          >
            <Users size={16} />
            <span className="mono" style={{ fontSize: '0.8rem', fontWeight: searchMode === 'users' ? 600 : 400 }}>
              USERS
            </span>
          </button>
          <button
            onClick={() => setSearchMode('music')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: searchMode === 'music' ? colors.accent : colors.bg.secondary,
              color: searchMode === 'music' ? '#ffffff' : colors.text.secondary,
              border: '1px solid',
              borderColor: searchMode === 'music' ? colors.accent : colors.border,
              boxShadow: searchMode === 'music' ? '0 0 12px rgba(211, 47, 47, 0.3)' : 'none',
            }}
          >
            <Music size={16} />
            <span className="mono" style={{ fontSize: '0.8rem', fontWeight: searchMode === 'music' ? 600 : 400 }}>
              MUSIC
            </span>
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      {searchMode === 'users' && (
      <div className="flex gap-2 mb-8 overflow-x-auto">
        {[
          { id: 'all', label: 'All' },
          { id: 'architects', label: 'Architects Only' },
          { id: 'local', label: 'Local' },
          { id: 'global', label: 'Global' },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id as any)}
            className="px-4 py-2.5 rounded-xl whitespace-nowrap transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: activeFilter === filter.id ? colors.accent : colors.bg.secondary,
              color: activeFilter === filter.id ? '#ffffff' : colors.text.secondary,
              border: '1px solid',
              borderColor: activeFilter === filter.id ? colors.accent : colors.border,
              boxShadow: activeFilter === filter.id ? '0 0 12px rgba(211, 47, 47, 0.3)' : 'none',
            }}
          >
            <span className="mono" style={{ fontSize: '0.8rem', fontWeight: activeFilter === filter.id ? 600 : 400 }}>
              {filter.label}
            </span>
          </button>
        ))}
      </div>
      )}

      {/* Results Counter */}
      {searchMode === 'users' && (
      <div className="mb-4">
        <p className="mono" style={{ color: colors.text.secondary, fontSize: '0.8rem', letterSpacing: '0.05em' }}>
          {filteredUsers.length} COMPATIBLE USERS FOUND
        </p>
      </div>
      )}

      {/* Music Search Results */}
      {searchMode === 'music' && (
      <div className="mb-6">
        {isSearching ? (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 border-2 border-[#d32f2f] border-t-transparent rounded-full animate-spin"></div>
            <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.8rem' }}>
              SEARCHING INTERNET ARCHIVE...
            </p>
          </div>
        ) : (
          <>
            {/* Display Errors */}
            {searchError && (
                 <div className="p-3 mb-4 rounded-lg" style={{ backgroundColor: 'rgba(211, 47, 47, 0.1)', border: '1px solid #d32f2f' }}>
                    <p className="mono text-sm" style={{ color: '#d32f2f' }}>
                        Error: {searchError}
                    </p>
                </div>
            )}
            
            {/* Artists Section (Kept for existing UI but will be empty from IA search) */}
            {musicSearchResults.artists.length > 0 && (
              <div className="mb-4">
                <p className="mono mb-3" style={{ color: '#a0a0a0', fontSize: '0.8rem' }}>
                  {musicSearchResults.artists.length} ARTISTS FOUND
                </p>
                <div className="space-y-2">
                  {musicSearchResults.artists.map((artist) => (
                    <div
                      key={artist.id}
                      className="p-3 rounded-lg transition-all hover:bg-[#333333]"
                      style={{ backgroundColor: '#252525', border: '1px solid #333333' }}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={artist.image}
                          alt={artist.name}
                          className="w-10 h-10 rounded object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm" style={{ color: '#e0e0e0' }}>
                            {artist.name}
                          </p>
                          <p className="truncate text-xs" style={{ color: '#a0a0a0' }}>
                            {artist.genre} • {artist.globalChosenUsers} users
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Tracks Section (Actual IA Results) */}
            {musicSearchResults.tracks.length > 0 && (
              <div>
                <p className="mono mb-3" style={{ color: '#a0a0a0', fontSize: '0.8rem' }}>
                  {musicSearchResults.tracks.length} TRACKS FOUND
                </p>
                <div className="space-y-2">
                  {musicSearchResults.tracks.map((track) => (
                    // Replaced <a> tag with div and onClick handler
                    <div 
                      key={track.id}
                      onClick={() => {
                        setCurrentTrack(track); // Set the current track to trigger the player
                        if (typeof onTrackClick === 'function') onTrackClick(track, musicSearchResults.tracks);
                      }}
                      className="block p-3 rounded-lg transition-all hover:bg-[#333333] cursor-pointer active:scale-[0.99]"
                      style={{ backgroundColor: '#252525', border: '1px solid #333333' }}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={track.coverArt}
                          alt={track.album}
                          className="w-10 h-10 rounded object-cover flex-shrink-0"
                          // Fallback image using the IA identifier
                          onError={(e) => {
                            e.currentTarget.src = `https://placehold.co/40x40/252525/ffffff?text=IA`
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm" style={{ color: '#e0e0e0' }}>
                            {track.title || 'Unknown Title'}
                          </p>
                          <p className="truncate text-xs" style={{ color: '#a0a0a0' }}>
                            {track.artist} • {track.album} • {track.bitrate}
                          </p>
                        </div>
                        <span className="mono text-xs flex-shrink-0" style={{ color: '#546e7a' }}>
                          {track.duration}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {musicSearchResults.artists.length === 0 && musicSearchResults.tracks.length === 0 && searchQuery.length > 2 && !searchError && (
              <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.8rem' }}>
                NO RESULTS FOUND
              </p>
            )}
          </>
        )}
      </div>
      )}


      {/* Radar Visualization */}
      {searchMode === 'users' && (
      <div
        className="relative rounded-lg mb-6 overflow-hidden"
        style={{
          backgroundColor: colors.bg.primary,
          height: '400px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          border: `1px solid ${colors.border}`,
        }}
      >
        {/* Radar Grid */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative" style={{ width: '100%', height: '100%' }}>
            {/* Concentric Circles */}
            {[100, 200, 300].map((size, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  border: '1px solid rgba(84, 110, 122, 0.2)',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}

            {/* Center Point (You) */}
            <div
              className="absolute w-4 h-4 rounded-full"
              style={{
                backgroundColor: '#d32f2f',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 20px rgba(211, 47, 47, 0.6)',
              }}
            />

            {/* User Dots */}
            {filteredUsers.map((user, i) => (
              <div
                key={i}
                onClick={() => onUserClick(user.user.id)}
                className="absolute cursor-pointer group"
                style={{
                  left: `${user.x}%`,
                  top: `${user.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {/* Pulse Effect */}
                <div
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{
                    backgroundColor: 'rgba(84, 110, 122, 0.4)',
                    width: '32px',
                    height: '32px',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                />

                {/* Avatar */}
                <img
                  src={user.user.avatar}
                  alt={user.user.name}
                  className="relative w-8 h-8 rounded-full border-2 group-hover:scale-125 transition-transform"
                  style={{ borderColor: '#546e7a' }}
                />

                {/* Tooltip */}
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{
                    backgroundColor: '#252525',
                    border: '1px solid #333333',
                  }}
                >
                  <p className="mono" style={{ color: '#e0e0e0', fontSize: '0.7rem' }}>
                    {user.user.name}
                  </p>
                  <p className="mono" style={{ color: '#546e7a', fontSize: '0.65rem' }}>
                    {user.matchScore}% Match
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Instructions */}
      {searchMode === 'users' && (
      <div
        className="p-4 rounded-lg"
        style={{
          backgroundColor: colors.bg.secondary,
          border: `1px solid ${colors.border}`,
        }}
      >
        <p className="mono" style={{ color: colors.text.secondary, fontSize: '0.75rem' }}>
          Tap a dot to view Structural Integrity. Closer dots = Higher compatibility.
        </p>
      </div>
      )}
      
      {/* GLOBAL AUDIO PLAYER */}
      <AudioPlayer currentTrack={currentTrack} colors={colors} />
    </div>
  );
}

export default RadarScreen;