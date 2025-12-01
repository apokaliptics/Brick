// Type declaration for jsmediatags library loaded via CDN
declare global {
  interface Window {
    jsmediatags: any;
  }
}

import { Upload, Music, Trash2, Play, Pause, Album, ListMusic } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface LocalTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArtist?: string;
  year?: string;
  trackNumber?: number;
  discNumber?: number;
  genre?: string;
  file: File;
  url: string;
  duration: number;
  format: string;
  size: number;
  coverArt?: string; // Base64 encoded image
}

interface LocalMusicUploaderProps {
  onPlayTrack: (track: LocalTrack) => void;
  onPlayAlbum?: (tracks: LocalTrack[]) => void;
  currentPlayingId?: string;
  isPlaying?: boolean;
}

// IndexedDB helper functions
const DB_NAME = 'BrickMusicDB';
const STORE_NAME = 'localTracks';
const DB_VERSION = 4;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open LocalMusicUploader DB:', request.error);
      reject(request.error);
    };
    request.onsuccess = () => {
      console.log('Successfully opened LocalMusicUploader DB');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      console.log('Upgrading LocalMusicUploader DB to version', DB_VERSION);
      const db = (event.target as IDBOpenDBRequest).result;

      // Create localTracks store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        console.log('Creating localTracks object store');
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }

      // Create playlists store if it doesn't exist
      if (!db.objectStoreNames.contains('playlists')) {
        console.log('Creating playlists object store');
        db.createObjectStore('playlists', { keyPath: 'id' });
      }

      // Create recentlyPlayedPlaylists store if it doesn't exist
      if (!db.objectStoreNames.contains('recentlyPlayedPlaylists')) {
        console.log('Creating recentlyPlayedPlaylists object store');
        const store = db.createObjectStore('recentlyPlayedPlaylists', { keyPath: 'playlistId' });
        store.createIndex('playedAt', 'playedAt', { unique: false });
      }

      // Create recentlyPlayedTracks store if it doesn't exist
      if (!db.objectStoreNames.contains('recentlyPlayedTracks')) {
        console.log('Creating recentlyPlayedTracks object store');
        const store = db.createObjectStore('recentlyPlayedTracks', { keyPath: 'trackId' });
        store.createIndex('playedAt', 'playedAt', { unique: false });
      }
    };
  });
};

const saveTrackToDB = async (track: any): Promise<void> => {
  try {
    console.log('Saving track to DB:', track.id, track.name);

    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Store the complete track object (including File) in IndexedDB
    const request = store.put(track);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('Successfully saved track to IndexedDB:', track.id);
        resolve();
      };
      request.onerror = () => {
        console.error('Error saving track to IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error saving track:', error);
    throw error;
  }
};

const getAllTracksFromDB = async (): Promise<any[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deleteTrackFromDB = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export function LocalMusicUploader({ onPlayTrack, onPlayAlbum, currentPlayingId, isPlaying }: LocalMusicUploaderProps) {
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'tracks' | 'albums'>('tracks');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load jsmediatags library
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Load tracks from IndexedDB on mount
  useEffect(() => {
    const loadTracks = async () => {
      try {
        console.log('Starting to load tracks from IndexedDB...');

        // Clear old localStorage data if it exists
        if (localStorage.getItem('brick_local_tracks')) {
          console.log('Migrating from localStorage to IndexedDB...');
          localStorage.removeItem('brick_local_tracks');
        }

        const storedTracks = await getAllTracksFromDB();
        console.log('Retrieved tracks from IndexedDB:', storedTracks.length);

        // Tracks are stored with File objects directly in IndexedDB
        const tracksWithFiles: LocalTrack[] = storedTracks.map(track => {
          try {
            console.log('Processing track:', track.id, track.name);

            // Create blob URL from the stored File object
            const url = URL.createObjectURL(track.file);
            console.log('Successfully created blob URL for track:', track.id);

            return {
              ...track,
              url,
            };
          } catch (error) {
            console.error('Failed to process track:', track.id, error);
            return null;
          }
        }).filter(Boolean) as LocalTrack[];

        console.log('Successfully loaded tracks:', tracksWithFiles.length);
        setLocalTracks(tracksWithFiles);
      } catch (error) {
        console.error('Error loading local tracks from IndexedDB:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTracks();

    // Cleanup: revoke blob URLs when component unmounts
    return () => {
      localTracks.forEach(track => {
        if (track.url.startsWith('blob:')) {
          URL.revokeObjectURL(track.url);
        }
      });
    };
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    console.log('Processing', files.length, 'files...');

    const newTracks: LocalTrack[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const format = file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN';
      const url = URL.createObjectURL(file);

      console.log('Processing file:', file.name, 'size:', file.size);

      // Extract metadata using jsmediatags
      const metadata = await new Promise<any>((resolve) => {
        // @ts-ignore - jsmediatags is loaded via CDN
        if (typeof window.jsmediatags !== 'undefined') {
          window.jsmediatags.read(file, {
            onSuccess: (tag: any) => resolve(tag),
            onError: () => resolve(null),
          });
        } else {
          resolve(null);
        }
      });

      // Create audio element to get duration
      const audio = new Audio(url);
      await new Promise((resolve) => {
        audio.addEventListener('loadedmetadata', () => {
          const tags = metadata?.tags || {};

          // Extract album art if available
          let coverArt: string | undefined;
          if (tags.picture) {
            const { data, format: imgFormat } = tags.picture;
            let base64String = '';
            for (let j = 0; j < data.length; j++) {
              base64String += String.fromCharCode(data[j]);
            }
            coverArt = `data:${imgFormat};base64,${btoa(base64String)}`;
          }

          const trackId = `local-${Date.now()}-${i}`;
          console.log('Created track with ID:', trackId);

          newTracks.push({
            id: trackId,
            name: tags.title || file.name.replace(/\.(flac|wav|mp3)$/i, ''),
            artist: tags.artist || 'Unknown Artist',
            album: tags.album || 'Unknown Album',
            albumArtist: tags.album_artist,
            year: tags.year,
            trackNumber: tags.track ? parseInt(tags.track) : undefined,
            discNumber: tags.disc ? parseInt(tags.disc) : undefined,
            genre: tags.genre,
            file,
            url,
            duration: audio.duration,
            format,
            size: file.size,
            coverArt,
          });
          resolve(null);
        });
      });
    }

    console.log('Adding', newTracks.length, 'new tracks to state');
    setLocalTracks([...localTracks, ...newTracks]);
    setIsExpanded(true);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Save new tracks to IndexedDB
    console.log('Saving tracks to database...');
    for (const track of newTracks) {
      try {
        await saveTrackToDB(track);
      } catch (error) {
        console.error('Failed to save track:', track.id, error);
      }
    }
    console.log('Finished saving tracks to database');
  };

  const handleDeleteTrack = async (trackId: string) => {
    console.log('Deleting track:', trackId);
    const track = localTracks.find(t => t.id === trackId);
    if (track && track.url.startsWith('blob:')) {
      URL.revokeObjectURL(track.url);
    }

    setLocalTracks(localTracks.filter(t => t.id !== trackId));

    // Delete from IndexedDB
    try {
      await deleteTrackFromDB(trackId);
      console.log('Successfully deleted track:', trackId);
    } catch (error) {
      console.error('Error deleting track from IndexedDB:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Group tracks by album
  const albumGroups = localTracks.reduce((acc, track) => {
    const albumKey = `${track.album}:::${track.albumArtist || track.artist}`;
    if (!acc[albumKey]) {
      acc[albumKey] = [];
    }
    acc[albumKey].push(track);
    return acc;
  }, {} as Record<string, LocalTrack[]>);

  // Sort tracks within each album by track number
  Object.keys(albumGroups).forEach(albumKey => {
    albumGroups[albumKey].sort((a, b) => {
      if (a.discNumber !== b.discNumber) {
        return (a.discNumber || 0) - (b.discNumber || 0);
      }
      return (a.trackNumber || 0) - (b.trackNumber || 0);
    });
  });

  const albums = Object.entries(albumGroups).map(([key, tracks]) => {
    const [albumName, artistName] = key.split(':::');
    return {
      name: albumName,
      artist: artistName,
      tracks,
      coverArt: tracks.find(t => t.coverArt)?.coverArt,
      year: tracks.find(t => t.year)?.year,
      totalDuration: tracks.reduce((sum, t) => sum + t.duration, 0),
    };
  });

  return (
    <div
      className="mb-6 rounded-xl overflow-hidden"
      style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333333',
      }}
    >
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          borderBottom: isExpanded ? '1px solid #333333' : 'none',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{
              backgroundColor: '#252525',
              border: '1px solid #d32f2f',
            }}
          >
            <Music size={20} color="#d32f2f" />
          </div>
          <div>
            <h3 className="mono" style={{ color: '#e0e0e0', fontSize: '0.95rem' }}>
              Local Vault
            </h3>
            <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
              {localTracks.length} {localTracks.length === 1 ? 'track' : 'tracks'} • Private only
            </p>
          </div>
        </div>

        {/* Upload Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105"
          style={{
            backgroundColor: 'rgba(211, 47, 47, 0.15)',
            border: '1px solid #d32f2f',
          }}
        >
          <Upload size={16} color="#d32f2f" />
          <span className="mono" style={{ color: '#d32f2f', fontSize: '0.8rem' }}>
            Import
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".flac,.wav,.mp3,audio/flac,audio/wav,audio/mpeg"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Track List */}
      {isExpanded && (
        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div
                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{
                  backgroundColor: '#252525',
                  border: '1px solid #333333',
                }}
              >
                <Music size={24} color="#a0a0a0" />
              </div>
              <p className="mono mb-2" style={{ color: '#a0a0a0', fontSize: '0.85rem' }}>
                Loading tracks...
              </p>
            </div>
          ) : localTracks.length === 0 ? (
            <div className="text-center py-12">
              <div
                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{
                  backgroundColor: '#252525',
                  border: '1px solid #333333',
                }}
              >
                <Music size={24} color="#a0a0a0" />
              </div>
              <p className="mono mb-2" style={{ color: '#a0a0a0', fontSize: '0.85rem' }}>
                No local tracks imported yet
              </p>
              <p className="mono" style={{ color: '#666666', fontSize: '0.75rem' }}>
                Import FLAC, WAV, or MP3 files to play privately
              </p>
            </div>
          ) : (
            <>
              {/* View Mode Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setViewMode('tracks')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200"
                  style={{
                    backgroundColor: viewMode === 'tracks' ? 'rgba(211, 47, 47, 0.2)' : '#252525',
                    border: `1px solid ${viewMode === 'tracks' ? '#d32f2f' : '#333333'}`,
                  }}
                >
                  <ListMusic size={14} color={viewMode === 'tracks' ? '#d32f2f' : '#a0a0a0'} />
                  <span className="mono" style={{ color: viewMode === 'tracks' ? '#d32f2f' : '#a0a0a0', fontSize: '0.75rem' }}>
                    Tracks
                  </span>
                </button>
                <button
                  onClick={() => setViewMode('albums')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200"
                  style={{
                    backgroundColor: viewMode === 'albums' ? 'rgba(211, 47, 47, 0.2)' : '#252525',
                    border: `1px solid ${viewMode === 'albums' ? '#d32f2f' : '#333333'}`,
                  }}
                >
                  <Album size={14} color={viewMode === 'albums' ? '#d32f2f' : '#a0a0a0'} />
                  <span className="mono" style={{ color: viewMode === 'albums' ? '#d32f2f' : '#a0a0a0', fontSize: '0.75rem' }}>
                    Albums
                  </span>
                </button>
              </div>

              {viewMode === 'tracks' ? (
                <div className="space-y-2">
                  {localTracks.map((track) => (
                    <div
                      key={track.id}
                      className="group flex items-center gap-4 p-3 rounded-lg transition-all duration-200"
                      style={{
                        backgroundColor: currentPlayingId === track.id ? 'rgba(211, 47, 47, 0.1)' : '#252525',
                        border: `1px solid ${currentPlayingId === track.id ? '#d32f2f' : '#333333'}`,
                      }}
                    >
                      {/* Cover Art */}
                      {track.coverArt ? (
                        <img
                          src={track.coverArt}
                          alt={track.album}
                          className="flex-shrink-0 w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <div
                          className="flex-shrink-0 w-12 h-12 rounded flex items-center justify-center"
                          style={{ backgroundColor: '#1a1a1a', border: '1px solid #333333' }}
                        >
                          <Music size={20} color="#666666" />
                        </div>
                      )}

                      {/* Track Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="mono truncate" style={{ color: '#e0e0e0', fontSize: '0.85rem' }}>
                          {track.name}
                        </h4>
                        <p className="mono truncate" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                          {track.artist} • {track.album}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span
                            className="mono px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: '#1a1a1a',
                              color: '#d32f2f',
                              fontSize: '0.65rem',
                            }}
                          >
                            {track.format}
                          </span>
                          <span className="mono" style={{ color: '#666666', fontSize: '0.7rem' }}>
                            {formatDuration(track.duration)}
                          </span>
                        </div>
                      </div>

                      {/* Play Button */}
                      <button
                        onClick={() => onPlayTrack(track)}
                        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
                        style={{
                          backgroundColor: currentPlayingId === track.id ? '#d32f2f' : 'rgba(211, 47, 47, 0.15)',
                          border: '1px solid #d32f2f',
                        }}
                      >
                        {currentPlayingId === track.id && isPlaying ? (
                          <Pause size={16} color="#ffffff" />
                        ) : (
                          <Play size={16} color={currentPlayingId === track.id ? '#ffffff' : '#d32f2f'} />
                        )}
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteTrack(track.id)}
                        className="flex-shrink-0 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
                        style={{
                          backgroundColor: 'rgba(211, 47, 47, 0.15)',
                          border: '1px solid #d32f2f',
                        }}
                      >
                        <Trash2 size={14} color="#d32f2f" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {albums.map((album, index) => (
                    <div
                      key={index}
                      className="group rounded-lg overflow-hidden transition-all duration-200 hover:scale-105"
                      style={{
                        backgroundColor: '#252525',
                        border: '1px solid #333333',
                      }}
                    >
                      {/* Album Cover */}
                      <div className="relative aspect-square">
                        {album.coverArt ? (
                          <img
                            src={album.coverArt}
                            alt={album.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{ backgroundColor: '#1a1a1a' }}
                          >
                            <Album size={48} color="#666666" />
                          </div>
                        )}
                        {/* Play Overlay */}
                        <button
                          onClick={() => onPlayAlbum?.(album.tracks)}
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
                        >
                          <div
                            className="w-16 h-16 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: '#d32f2f' }}
                          >
                            <Play size={24} color="#ffffff" />
                          </div>
                        </button>
                      </div>

                      {/* Album Info */}
                      <div className="p-3">
                        <h4 className="mono truncate" style={{ color: '#e0e0e0', fontSize: '0.85rem' }}>
                          {album.name}
                        </h4>
                        <p className="mono truncate" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                          {album.artist}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {album.year && (
                            <span className="mono" style={{ color: '#666666', fontSize: '0.7rem' }}>
                              {album.year}
                            </span>
                          )}
                          <span className="mono" style={{ color: '#666666', fontSize: '0.7rem' }}>
                            {album.tracks.length} tracks
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Info Banner */}
          <div
            className="mt-4 p-3 rounded-lg"
            style={{
              backgroundColor: 'rgba(211, 47, 47, 0.05)',
              border: '1px solid rgba(211, 47, 47, 0.2)',
            }}
          >
            <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
              🔒 Local files are stored in your browser and only playable on this device. They cannot be shared or accessed by others.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
