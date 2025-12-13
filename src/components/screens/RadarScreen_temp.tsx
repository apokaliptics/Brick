/* eslint-disable */
import React, { useState, useEffect, useCallback } from 'react';
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




  // Clear search results and RESET FILTER when switching modes
  useEffect(() => {
    setMusicSearchResults({ artists: [], tracks: [] });
    setSearchError(null);
    setActiveFilter('all'); // Reset filter to All when switching between Users/Music
  }, [searchMode]);


  // Sort connections by matchScore (highest first) and position them by proximity to center
  const sortedConnections = [...mockConnections].sort((a, b) => b.matchScore - a.matchScore);
  
  // Add x/y coordinates to connections for radar visualization
  // Higher matchScore = closer to center (smaller radius)
  const mockUsers: Connection[] = sortedConnections.map((conn, i) => {
    // Map matchScore (0-100) to radius (5-40), higher score = smaller radius
    const radius = 40 - (conn.matchScore / 100) * 35; // 5 to 40 range
    const angle = (i / sortedConnections.length) * Math.PI * 2;
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
        // SIMPLIFIED QUERY: Broader search to avoid "No matching items"
        // We now just search for the term within audio media types, without strict field restrictions
        const safeQuery = query.replace(/[()]/g, '').trim();
        const q = `${safeQuery} AND mediatype:(audio OR etree)`;
        
        const searchUrl = `${IA_SEARCH_BASE_URL}?q=${encodeURIComponent(q)}&sort[]=downloads+desc&fl[]=identifier&output=json&rows=15`;
        
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
        const artistsMap = new Map<string, SimpleArtist>(); // Use Map to deduplicate artists by Name

        const fetchPromises = identifiers.map(async (identifier) => {
            try {
                const metadataUrl = `${IA_METADATA_BASE_URL}/${identifier}`;
                const itemData = await fetchWithRetry(metadataUrl);

                // Process Album Artist info from Item Metadata
                const albumArtist = Array.isArray(itemData.metadata.creator) ? itemData.metadata.creator[0] : itemData.metadata.creator || 'Unknown Artist';
                const coverArt = `${IA_COVER_IMAGE_BASE_URL}/${identifier}`;
                const albumTitle = Array.isArray(itemData.metadata.title) ? itemData.metadata.title[0] : itemData.metadata.title;

                // Add to Artists map if not already present
                if (!artistsMap.has(albumArtist)) {
                    artistsMap.set(albumArtist, {
                        id: `artist-${identifier}`, 
                        name: albumArtist,
                        genre: itemData.metadata.mediatype || 'Audio',
                        globalChosenUsers: Math.floor(Math.random() * 1000) + 100, 
                        image: coverArt
                    });
                }

                if (itemData.files) {
                    itemData.files
                        .filter((file: any) => file.source === 'original' && file.format && file.format.includes('MP3'))
                        .forEach((file: any) => {
                            const trackName = file.title || file.name.replace(/\.(mp3|flac|ogg)$/i, '').replace(/_/g, ' ');
                            const trackDuration = formatDuration(file.length);
                            const trackBitrate = file.bitrate ? `${file.bitrate} kbps` : 'N/A';
                            const downloadUrl = `https://archive.org/download/${identifier}/${file.name}`;
                            
                            // Prefer file-level artist, then creator, then fallback to album artist
                            const trackArtist = file.artist || file.creator || albumArtist;

                            allTracks.push({
                                id: `${identifier}-${file.name}`,
                                title: trackName,
                                artist: trackArtist,
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
        const uniqueArtists = Array.from(artistsMap.values());
        
        setMusicSearchResults({ artists: uniqueArtists, tracks: uniqueTracks });

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
    <div className="px-6 pt-6 md:pt-16 min-h-screen">
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

      {/* REMOVED DEBUG INFO BLOCK */}


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

      {/* Filter Chips - Renders for both Users and Music now */}
      <div className="flex gap-2 mb-8 overflow-x-auto">
        {searchMode === 'users' ? (
            // Users Filters
            [
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
            ))
        ) : (
            // Music Filters
            [
            { id: 'all', label: 'All' },
            { id: 'tracks', label: 'Tracks' },
            { id: 'artists', label: 'Artists' },
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
            ))
        )}
      </div>

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
            
            {/* Artists Section - Show if 'All' or 'Artists' is selected */}
            {musicSearchResults.artists.length > 0 && (activeFilter === 'all' || activeFilter === 'artists') && (
              <div className="mb-6">
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
            
            {/* Tracks Section - Show if 'All' or 'Tracks' is selected */}
            {musicSearchResults.tracks.length > 0 && (activeFilter === 'all' || activeFilter === 'tracks') && (
              <div>
                <p className="mono mb-3" style={{ color: '#a0a0a0', fontSize: '0.8rem' }}>
                  {musicSearchResults.tracks.length} TRACKS FOUND
                </p>
                <div className="space-y-2">
                  {musicSearchResults.tracks.map((track) => (
                    // Replaced <a> tag with div and onClick handler
                    <div
                      key={track.id}
                      onClick={() => onTrackClick && onTrackClick(track, musicSearchResults.tracks)} // Set the current track to trigger the global player
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
    </div>
  );
}

export default RadarScreen;