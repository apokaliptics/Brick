import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Play, HardDrive, Music, X, GripVertical } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface PlaylistCreationScreenProps {
  onClose: () => void;
  onPublish: (name: string, tracks: Track[]) => void;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  quality: string;
  coverArt: string;
  audioUrl?: string;
  isPatronage: boolean;
  genre?: string;
}

interface LocalTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  file: File;
  url: string;
  duration: number;
  format: string;
  coverArt?: string;
  genre?: string;
}

export function PlaylistCreationScreen({ onClose, onPublish }: PlaylistCreationScreenProps) {
  const [playlistName, setPlaylistName] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [structuralIntegrity, setStructuralIntegrity] = useState(0);
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [viewMode, setViewMode] = useState<'platform' | 'local'>('platform');
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);

  // Load local tracks from IndexedDB on mount
  useEffect(() => {
    loadLocalTracksFromDB();
  }, []);

  const loadLocalTracksFromDB = async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(['localTracks'], 'readonly');
      const store = transaction.objectStore('localTracks');
      const allTracks = await new Promise<LocalTrack[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Recreate blob URLs for tracks
      const tracksWithUrls = allTracks.map(track => ({
        ...track,
        url: URL.createObjectURL(track.file),
      }));

      setLocalTracks(tracksWithUrls);
      setIsLoadingLocal(false);
    } catch (error) {
      console.error('Failed to load local tracks:', error);
      setIsLoadingLocal(false);
    }
  };

  const openDB = (): Promise<IDBDatabase> => {
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

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Genre compatibility matrix - genres in same group are compatible
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
    // Normalize to lowercase and remove extra spaces
    const normalized = genre.toLowerCase().trim();
    
    // Check if it contains any of the genre keywords
    for (const [groupName, genres] of Object.entries(genreGroups)) {
      for (const g of genres) {
        if (normalized.includes(g) || g.includes(normalized)) {
          return g; // Return the canonical genre name from our list
        }
      }
    }
    
    // If no match found, return the normalized genre as-is
    return normalized;
  };

  const calculateGenreIntegrity = (tracks: Track[]): number => {
    if (tracks.length === 0) return 0;
    if (tracks.length === 1) return 100;

    // Get genres from tracks and normalize them
    const trackGenres = tracks.map(t => normalizeGenre(t.genre));
    
    // Count how many tracks have unknown genres
    const unknownCount = trackGenres.filter(g => g === 'unknown').length;
    
    // If all tracks have no genre, return 50% as neutral
    if (unknownCount === tracks.length) {
      return 50;
    }
    
    // If some tracks have no genre, penalize slightly but don't fail completely
    const unknownPenalty = (unknownCount / tracks.length) * 20; // Up to 20% penalty

    // Find which genre groups each track belongs to
    const trackGroupMemberships = trackGenres.map(genre => {
      const groups: string[] = [];
      Object.entries(genreGroups).forEach(([groupName, genres]) => {
        if (genres.includes(genre)) {
          groups.push(groupName);
        }
      });
      return { genre, groups };
    });

    // If all tracks are in the same specific genre: 100%
    const knownGenres = trackGenres.filter(g => g !== 'unknown');
    const uniqueGenres = new Set(knownGenres);
    if (uniqueGenres.size === 1 && unknownCount === 0) return 100;
    if (uniqueGenres.size === 1 && unknownCount > 0) return Math.max(50, 100 - unknownPenalty);

    // Calculate how many tracks are compatible with each other
    let compatiblePairs = 0;
    let totalPairs = 0;

    for (let i = 0; i < trackGroupMemberships.length; i++) {
      for (let j = i + 1; j < trackGroupMemberships.length; j++) {
        // Skip pairs where either track has unknown genre
        if (trackGenres[i] === 'unknown' || trackGenres[j] === 'unknown') {
          continue;
        }
        
        totalPairs++;
        const track1Groups = trackGroupMemberships[i].groups;
        const track2Groups = trackGroupMemberships[j].groups;
        
        // Check if tracks share any genre group
        const hasSharedGroup = track1Groups.some(g => track2Groups.includes(g));
        if (hasSharedGroup) {
          compatiblePairs++;
        }
      }
    }

    // If no pairs to compare (all unknown), return 50%
    if (totalPairs === 0) return 50;

    // Calculate percentage of compatible pairs
    const compatibilityRatio = compatiblePairs / totalPairs;
    
    // Scale to 0-100, with bonus for high compatibility, minus unknown penalty
    let baseScore;
    if (compatibilityRatio >= 0.9) baseScore = 95; // Highly compatible
    else if (compatibilityRatio >= 0.7) baseScore = 80; // Mostly compatible
    else if (compatibilityRatio >= 0.5) baseScore = 60; // Somewhat compatible
    else if (compatibilityRatio >= 0.3) baseScore = 40; // Mostly incompatible
    else baseScore = Math.round(compatibilityRatio * 100); // Very incompatible
    
    return Math.max(0, Math.round(baseScore - unknownPenalty));
  };

  // Mock available tracks
  const availableTracks: Track[] = [
    {
      id: 'track-1',
      title: 'Concrete Dreams',
      artist: 'Nora Vex',
      album: 'Industrial Soundscapes',
      duration: '4:32',
      quality: 'FLAC',
      coverArt: 'https://images.unsplash.com/photo-1644855640845-ab57a047320e?w=400',
      isPatronage: false,
      genre: 'shoegaze',
    },
    {
      id: 'track-2',
      title: 'Midnight Foundation',
      artist: 'The Midnight Architects',
      album: 'Structural Integrity',
      duration: '5:18',
      quality: 'FLAC',
      coverArt: 'https://images.unsplash.com/photo-1757889693310-1e77c6063ba7?w=400',
      isPatronage: false,
      genre: 'post-rock',
    },
    {
      id: 'track-3',
      title: 'Brass & Stone',
      artist: 'Luna Chen',
      album: 'Material Studies',
      duration: '3:45',
      quality: '320kbps',
      coverArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
      isPatronage: false,
      genre: 'indie rock',
    },
    {
      id: 'track-4',
      title: 'Digital Breakdown',
      artist: 'Marcus Flow',
      album: 'Urban Chronicles',
      duration: '3:22',
      quality: '320kbps',
      coverArt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
      isPatronage: false,
      genre: 'hip hop',
    },
    {
      id: 'track-5',
      title: 'Steel Resonance',
      artist: 'Iron Assembly',
      album: 'Forge',
      duration: '5:45',
      quality: 'FLAC',
      coverArt: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400',
      isPatronage: false,
      genre: 'metal',
    },
  ];

  const addTrack = (track: Track) => {
    const newTracks = [...tracks, track];
    setTracks(newTracks);
    
    // Calculate genre-based structural integrity
    const integrity = calculateGenreIntegrity(newTracks);
    setStructuralIntegrity(integrity);
  };

  const addLocalTrack = (localTrack: LocalTrack) => {
    console.log('Adding local track:', localTrack);
    console.log('Local track genre:', localTrack.genre);
    
    // Convert local track to Track format
    const track: Track = {
      id: localTrack.id,
      title: localTrack.name,
      artist: localTrack.artist,
      album: localTrack.album,
      duration: formatDuration(localTrack.duration),
      quality: localTrack.format,
      coverArt: localTrack.coverArt || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
      audioUrl: localTrack.url,
      isPatronage: false,
      genre: localTrack.genre, // Pass through genre from local track
    };
    
    console.log('Converted track:', track);
    addTrack(track);
  };

  const removeTrack = (trackId: string) => {
    const newTracks = tracks.filter(t => t.id !== trackId);
    setTracks(newTracks);
    
    // Recalculate genre-based structural integrity
    const integrity = calculateGenreIntegrity(newTracks);
    setStructuralIntegrity(integrity);
  };

  const canPublish = playlistName.length > 0 && tracks.length > 0 && structuralIntegrity >= 50;

  // Debug logging
  useEffect(() => {
    console.log('=== Fire Brick Debug ===');
    console.log('Playlist Name:', playlistName);
    console.log('Tracks Count:', tracks.length);
    console.log('Structural Integrity:', structuralIntegrity);
    console.log('Can Publish:', canPublish);
    console.log('Track Genres:', tracks.map(t => ({ title: t.title, genre: t.genre })));
    console.log('========================');
  }, [playlistName, tracks, structuralIntegrity, canPublish]);

  return (
    <div className="fixed inset-0 z-50 bg-[#1a1a1a] overflow-y-auto pb-24">
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-6 py-4 border-b border-[#333333]"
        style={{
          backgroundColor: '#252525',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="p-2">
            <X size={24} color="#a0a0a0" />
          </button>
          <h3 style={{ color: '#e0e0e0' }}>Firing New Brick</h3>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-6 pt-6">
        {/* Brick Name Input */}
        <div className="mb-6">
          <label className="mono mb-2 block" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
            BRICK NAME
          </label>
          <input
            type="text"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            placeholder="Enter playlist name..."
            className="w-full px-4 py-3 rounded-lg outline-none"
            style={{
              backgroundColor: '#252525',
              border: '1px solid #333333',
              color: '#e0e0e0',
            }}
          />
        </div>

        {/* The Batch List */}
        <div className="mb-6">
          <h4 className="mb-3">The Batch ({tracks.length} tracks)</h4>
          
          {tracks.length === 0 ? (
            <div
              className="p-8 rounded-lg text-center"
              style={{
                backgroundColor: '#252525',
                border: '1px dashed #333333',
              }}
            >
              <p style={{ color: '#a0a0a0' }}>No tracks added yet</p>
            </div>
          ) : (
            <div
              className="rounded-lg overflow-hidden"
              style={{
                backgroundColor: '#252525',
                border: '1px solid #333333',
              }}
            >
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 p-3 border-b border-[#333333] last:border-b-0"
                  style={{ backgroundColor: index % 2 === 0 ? '#252525' : '#222222' }}
                >
                  <GripVertical size={16} color="#a0a0a0" className="cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ color: '#e0e0e0', fontSize: '0.875rem' }}>
                      {track.title}
                    </p>
                    <p className="mono truncate" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
                      {track.artist} • {track.duration} {track.genre && <span style={{ color: '#546e7a' }}>• {track.genre}</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => removeTrack(track.id)}
                    className="p-1 hover:bg-[#333333] rounded transition-colors"
                  >
                    <X size={16} color="#a0a0a0" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Tracks */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4>Available Tracks</h4>
            {/* View Mode Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('platform')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  backgroundColor: viewMode === 'platform' ? 'rgba(211, 47, 47, 0.2)' : '#252525',
                  border: `1px solid ${viewMode === 'platform' ? '#d32f2f' : '#333333'}`,
                }}
              >
                <Music size={14} color={viewMode === 'platform' ? '#d32f2f' : '#a0a0a0'} />
                <span className="mono" style={{ color: viewMode === 'platform' ? '#d32f2f' : '#a0a0a0', fontSize: '0.7rem' }}>
                  Platform
                </span>
              </button>
              <button
                onClick={() => setViewMode('local')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  backgroundColor: viewMode === 'local' ? 'rgba(211, 47, 47, 0.2)' : '#252525',
                  border: `1px solid ${viewMode === 'local' ? '#d32f2f' : '#333333'}`,
                }}
              >
                <HardDrive size={14} color={viewMode === 'local' ? '#d32f2f' : '#a0a0a0'} />
                <span className="mono" style={{ color: viewMode === 'local' ? '#d32f2f' : '#a0a0a0', fontSize: '0.7rem' }}>
                  Local ({localTracks.length})
                </span>
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {viewMode === 'platform' ? (
              availableTracks.map((track) => {
                const isAdded = tracks.some(t => t.id === track.id);
                return (
                  <button
                    key={track.id}
                    onClick={() => !isAdded && addTrack(track)}
                    disabled={isAdded}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all"
                    style={{
                      backgroundColor: isAdded ? '#1a1a1a' : '#252525',
                      border: '1px solid #333333',
                      opacity: isAdded ? 0.5 : 1,
                      cursor: isAdded ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <ImageWithFallback
                      src={track.coverArt}
                      alt={track.album}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ color: '#e0e0e0' }}>
                        {track.title}
                      </p>
                      <p className="mono truncate" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                        {track.artist}
                      </p>
                    </div>
                    {!isAdded && <Plus size={20} color="#546e7a" />}
                  </button>
                );
              })
            ) : (
              isLoadingLocal ? (
                <div className="p-8 rounded-lg text-center" style={{ backgroundColor: '#252525', border: '1px dashed #333333' }}>
                  <p style={{ color: '#a0a0a0' }}>Loading local tracks...</p>
                </div>
              ) : localTracks.length === 0 ? (
                <div className="p-8 rounded-lg text-center" style={{ backgroundColor: '#252525', border: '1px dashed #333333' }}>
                  <HardDrive size={32} color="#666666" className="mx-auto mb-3" />
                  <p style={{ color: '#a0a0a0', marginBottom: '8px' }}>No local tracks available</p>
                  <p className="mono" style={{ color: '#666666', fontSize: '0.7rem' }}>
                    Upload tracks from the home screen to add them here
                  </p>
                </div>
              ) : (
                localTracks.map((track) => {
                  const isAdded = tracks.some(t => t.id === track.id);
                  return (
                    <button
                      key={track.id}
                      onClick={() => !isAdded && addLocalTrack(track)}
                      disabled={isAdded}
                      className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all"
                      style={{
                        backgroundColor: isAdded ? '#1a1a1a' : '#252525',
                        border: '1px solid #333333',
                        opacity: isAdded ? 0.5 : 1,
                        cursor: isAdded ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ImageWithFallback
                        src={track.coverArt}
                        alt={track.album}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{ color: '#e0e0e0' }}>
                          {track.name}
                        </p>
                        <p className="mono truncate" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                          {track.artist} {track.genre && <span style={{ color: '#546e7a' }}>• {track.genre}</span>}
                        </p>
                      </div>
                      {!isAdded && <Plus size={20} color="#546e7a" />}
                    </button>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* Structural Integrity Gauge */}
        <div
          className="p-6 rounded-lg mb-6"
          style={{
            backgroundColor: '#252525',
            border: '1px solid #333333',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 style={{ color: '#e0e0e0' }}>Structural Integrity</h4>
            <span
              className="mono"
              style={{
                color: structuralIntegrity >= 50 ? '#4caf50' : '#d32f2f',
                fontSize: '1.25rem',
              }}
            >
              {structuralIntegrity}%
            </span>
          </div>
          
          <div className="w-full bg-[#1a1a1a] rounded-full h-2 mb-3">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${structuralIntegrity}%`,
                background:
                  structuralIntegrity >= 50
                    ? 'linear-gradient(to right, #4caf50, #8bc34a)'
                    : 'linear-gradient(to right, #d32f2f, #b71c1c)',
              }}
            />
          </div>

          <p style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
            {structuralIntegrity < 50
              ? 'Genre clash detected. Mix compatible genres to strengthen this Brick.'
              : 'Genre uniformity maintained. This Brick has strong structural integrity.'}
          </p>
        </div>

        {/* Fire Brick Button */}
        <button
          onClick={() => {
            if (canPublish) {
              // Clean tracks to remove non-serializable data (File objects, blob URLs)
              const cleanedTracks = tracks.map(track => ({
                id: track.id,
                title: track.title,
                artist: track.artist,
                album: track.album,
                duration: track.duration,
                quality: track.quality,
                coverArt: track.coverArt,
                audioUrl: track.audioUrl?.startsWith('blob:') ? undefined : track.audioUrl, // Remove blob URLs
                isPatronage: track.isPatronage,
                genre: track.genre,
              }));
              
              console.log('Publishing cleaned tracks:', cleanedTracks);
              onPublish(playlistName, cleanedTracks);
            }
          }}
          disabled={!canPublish}
          className="w-full py-4 rounded-full transition-all mb-6"
          style={{
            background: canPublish
              ? 'linear-gradient(to bottom, #d32f2f, #b71c1c)'
              : 'linear-gradient(to bottom, #333333, #2a2a2a)',
            color: canPublish ? '#e0e0e0' : '#666666',
            boxShadow: canPublish ? '0 4px 12px rgba(211, 47, 47, 0.3)' : 'none',
            cursor: canPublish ? 'pointer' : 'not-allowed',
          }}
        >
          Fire Brick (Publish)
        </button>
      </div>
    </div>
  );
}