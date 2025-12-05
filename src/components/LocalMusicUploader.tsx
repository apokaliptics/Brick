// Type declaration for jsmediatags library loaded via CDN
// Remove reliance on window.jsmediatags (CDN) for app builds

import { Upload, Music, Trash2, Play, Pause, Album, ListMusic, FolderOpen } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { openBrickDB } from '../utils/db';
// Import jsmediatags via UMD bundle to satisfy Vite/Tauri resolver
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';

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
  addedAt: number;
  file: File;
  format: string;
  size: number;
  coverArt?: string; // Base64 encoded image
  bitDepth?: number;
  sampleRate?: number; // kHz
  codecLabel?: string;
  bitrateKbps?: number;
  duration?: number;
  url?: string;
  isLong?: boolean;
}

// Long-track guardrail to prevent memory/CPU spikes (e.g., 20+ minute Pink Floyd cuts)
const LONG_TRACK_SECONDS = 600; // 10 minutes

const tagNumberKeys = {
  track: ['track', 'tracknumber', 'track_num', 'trackno', 'tracknum', 'trck', 'trk', 'tracknumbertext'],
  disc: ['disc', 'discnumber', 'disc_num', 'discno', 'discnum', 'tpos', 'part_of_a_set', 'partofset', 'set'],
};

const coerceTagNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const match = value.match(/(\d{1,3})/);
    if (match) return parseInt(match[1], 10);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = coerceTagNumber(item);
      if (parsed !== undefined) return parsed;
    }
  }
  if (typeof value === 'object') {
    const possible = (value as { data?: unknown; text?: unknown }).data ?? (value as { text?: unknown }).text;
    return coerceTagNumber(possible);
  }
  return undefined;
};

const extractNumberFromTags = (tags: Record<string, any>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const direct = tags[key];
    if (direct !== undefined) {
      const parsed = coerceTagNumber(direct);
      if (parsed !== undefined) return parsed;
    }

    const lowerKey = key.toLowerCase();
    if (lowerKey !== key && tags[lowerKey] !== undefined) {
      const parsed = coerceTagNumber(tags[lowerKey]);
      if (parsed !== undefined) return parsed;
    }

    const upperKey = key.toUpperCase();
    if (upperKey !== key && tags[upperKey] !== undefined) {
      const parsed = coerceTagNumber(tags[upperKey]);
      if (parsed !== undefined) return parsed;
    }
  }
  return undefined;
};

const stripExtension = (filename: string) => filename.replace(/\.[^.]+$/, '');

const extractNumbersFromFilename = (filename: string) => {
  const base = stripExtension(filename);
  const lower = base.toLowerCase();
  const result: { trackNumber?: number; discNumber?: number } = {};

  const discMatch = lower.match(/(?:disc|cd)\s*0*(\d{1,2})/);
  if (discMatch) {
    result.discNumber = parseInt(discMatch[1], 10);
  }

  const leadingMatch = base.match(/^\s*0*(\d{1,3})(?=[\s._-])/);
  if (leadingMatch) {
    result.trackNumber = parseInt(leadingMatch[1], 10);
  } else {
    const embeddedMatch = base.match(/(?:\s|[-_.])0*(\d{1,3})(?=\s|[-_.]|$)/);
    if (embeddedMatch) {
      const candidate = parseInt(embeddedMatch[1], 10);
      if (candidate <= 99) {
        result.trackNumber = candidate;
      }
    } else {
      const genericMatches = base.match(/0*(\d{1,3})/g);
      if (genericMatches) {
        const usable = genericMatches
          .map(num => parseInt(num, 10))
          .find(num => num > 0 && num <= 99);
        if (usable) {
          result.trackNumber = usable;
        }
      }
    }
  }

  return result;
};

const extractDiscFromPath = (path?: string): number | undefined => {
  if (!path) return undefined;
  const match = path.toLowerCase().match(/(?:disc|cd)\s*0*(\d{1,2})/);
  return match ? parseInt(match[1], 10) : undefined;
};

// Heuristics to derive artist/album/title from path/filename when tags are missing
const sanitizeSegment = (s: string) => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const removeTrackNumberPrefix = (s: string) => s.replace(/^\s*\d{1,3}[\s._-]+/, '').trim();

const deriveFromPath = (path?: string): { artist?: string; album?: string } => {
  if (!path) return {};
  const parts = path.split('/').filter(Boolean);
  if (parts.length >= 3) {
    // Artist/Album/File
    return { artist: sanitizeSegment(parts[parts.length - 3]), album: sanitizeSegment(parts[parts.length - 2]) };
  }
  if (parts.length >= 2) {
    // Album/File
    return { album: sanitizeSegment(parts[parts.length - 2]) };
  }
  return {};
};

const deriveFromFilename = (name: string): { artist?: string; album?: string; title?: string } => {
  const base = stripExtension(name);
  const parts = base.split(' - ').map(sanitizeSegment);
  if (parts.length >= 3) {
    const artist = parts[0];
    const album = parts[1];
    const title = removeTrackNumberPrefix(parts.slice(2).join(' - '));
    return { artist, album, title };
  }
  if (parts.length === 2) {
    const artist = parts[0];
    const title = removeTrackNumberPrefix(parts[1]);
    return { artist, title };
  }
  return { title: removeTrackNumberPrefix(base) };
};

interface LocalMusicUploaderProps {
  onPlayTrack: (track: LocalTrack) => void;
  onPlayAlbum?: (tracks: LocalTrack[]) => void;
  currentPlayingId?: string;
  isPlaying?: boolean;
}

// IndexedDB helper functions
const STORE_NAME = 'localTracks';

const openDB = (): Promise<IDBDatabase> => openBrickDB();

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
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number } | null>(null);
  const [viewMode, setViewMode] = useState<'tracks' | 'albums'>('tracks');
  const [sortMode, setSortMode] = useState<'added' | 'title' | 'artist'>('added');
  const [selectedAlbum, setSelectedAlbum] = useState<{ name: string; artist: string } | null>(null);
  // Pagination state to keep UI concise with large libraries
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const playLockRef = useRef(false);
  const toggleVault = () => setIsExpanded((prev) => !prev);

  // Load jsmediatags library
  // No external script to load; we rely on music-metadata-browser which is bundled
  useEffect(() => { /* noop */ }, []);

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
        const baseTimestamp = Date.now();
        const tracksWithFiles: LocalTrack[] = storedTracks.map((track, index) => {
          try {
            console.log('Processing track:', track.id, track.name);

            // Create blob URL from the stored File object
            const url = URL.createObjectURL(track.file);
            console.log('Successfully created blob URL for track:', track.id);

            return {
              ...track,
              addedAt: track.addedAt ?? baseTimestamp + index,
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
        if (track.url?.startsWith('blob:')) {
          URL.revokeObjectURL(track.url);
        }
      });
    };
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Filter to audio files only (MIME or known extensions)
    const allowedExt = /\.(flac|wav|mp3|m4a|aac|ogg|aif|aiff|alac|wv|mka)$/i;
    const audioFiles = Array.from(files).filter((f) => {
      const mimeOk = typeof f.type === 'string' && f.type.startsWith('audio/');
      const extOk = allowedExt.test(f.name);
      return mimeOk || extOk;
    });
    if (audioFiles.length === 0) {
      console.warn('No audio files detected in selection.');
      return;
    }

    console.log('Processing', audioFiles.length, 'audio files...');
    setImportProgress({ processed: 0, total: audioFiles.length });

    // Build a dedupe set from existing DB entries (by name-size signature)
    let existingSignatures = new Set<string>();
    let existingBySignature = new Map<string, any>();
    try {
      const existing = await getAllTracksFromDB();
      existingSignatures = new Set(existing.map((t: any) => `${t.file?.name || t.name}-${t.file?.size || t.size}`));
      existing.forEach((t: any) => existingBySignature.set(`${t.file?.name || t.name}-${t.file?.size || t.size}`, t));
    } catch (err) {
      console.warn('Unable to read existing tracks for dedupe:', err);
    }

    const newTracks: LocalTrack[] = [];
    const importTimestamp = Date.now();
    // Helper: timeout wrapper to avoid hangs
    const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> => {
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(fallback), ms);
        p.then((v) => { clearTimeout(timer); resolve(v); })
         .catch(() => { clearTimeout(timer); resolve(fallback); });
      });
    };

    const processOne = async (file: File, i: number) => {
      const signature = `${file.name}-${file.size}`;
      if (existingSignatures.has(signature)) {
        // Attempt repair/update if existing has Unknown metadata and we can infer better info
        const existingTrack = existingBySignature.get(signature);
        try {
          const filePath = (existingTrack?.file as File & { webkitRelativePath?: string })?.webkitRelativePath
            || (file as File & { webkitRelativePath?: string }).webkitRelativePath;
          const inferredFromPath = deriveFromPath(filePath);
          const inferredFromName = deriveFromFilename(file.name);
          const improvedArtist = (existingTrack?.artist === 'Unknown Artist') ? (inferredFromName.artist || inferredFromPath.artist) : undefined;
          const improvedAlbum = (existingTrack?.album === 'Unknown Album') ? (inferredFromPath.album || inferredFromName.album) : undefined;
          const improvedTitle = (!existingTrack?.name || /^\d{1,3}[\s._-]/.test(existingTrack?.name)) ? (inferredFromName.title) : undefined;
          if (improvedArtist || improvedAlbum || improvedTitle) {
            const updated = {
              ...existingTrack,
              artist: improvedArtist || existingTrack.artist,
              album: improvedAlbum || existingTrack.album,
              albumArtist: existingTrack.albumArtist || improvedArtist || existingTrack.artist,
              name: improvedTitle || existingTrack.name,
            };
            await saveTrackToDB(updated);
            // Update in-memory state if present
            setLocalTracks((prev) => prev.map(t => (t.id === updated.id ? { ...t, ...updated } : t)));
            console.log('Updated existing track metadata from path/filename:', updated.id);
          } else {
            console.log('Skipping duplicate file:', file.name);
          }
        } catch (e) {
          console.warn('Failed to update duplicate track metadata:', e);
        }
        setImportProgress((p) => p ? { ...p, processed: p.processed + 1 } : null);
        return null;
      }

      const format = (file.type?.split('/')![1] || file.name.split('.').pop() || 'UNKNOWN').toUpperCase();
      const url = URL.createObjectURL(file);

      // Try jsmediatags first (bundled), then fallback to music-metadata-browser
      let metadata: any = null;
      let mmTags: any = null;
      // jsmediatags attempt (give big files more time)
      try {
        metadata = await withTimeout(new Promise<any>((resolve) => {
          try {
            jsmediatags.read(file, {
              onSuccess: (tag: any) => resolve(tag),
              onError: () => resolve(null),
            });
          } catch {
            resolve(null);
          }
        }), 12000, null);
      } catch {}

      // music-metadata-browser fallback
      if (!metadata) {
        try {
          const { parseBlob } = await import('music-metadata-browser');
          const result = await withTimeout(parseBlob(file), 12000, null as any);
          if (result && result.common) {
            const c = result.common;
            mmTags = {
              tags: {
                title: c.title,
                artist: (Array.isArray(c.artists) && c.artists.length ? c.artists[0] : c.artist) ?? undefined,
                album: c.album,
                album_artist: c.albumartist,
                genre: (Array.isArray(c.genre) ? c.genre[0] : c.genre) ?? undefined,
                year: c.year ? String(c.year) : undefined,
                picture: c.picture && c.picture.length ? { data: c.picture[0].data, format: c.picture[0].format } : undefined,
                track: c.track ? (c.track.no ?? c.track.of ?? c.track) : undefined,
                disc: c.disk ? (c.disk.no ?? c.disk.of ?? c.disk) : undefined,
              }
            };
          }
        } catch (err) {
          // ignore failure; we'll rely on filename/path heuristics
        }
      }

      // Create audio element to get duration (use preload metadata)
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = url;

      // Extract technical metadata (bit depth, sample rate, bitrate)
      let bitDepth: number | undefined;
      let sampleRate: number | undefined;
      let bitrateKbps: number | undefined;
      let codecLabel: string | undefined;
      try {
        const { extractAudioMeta } = await import('../utils/audioMetadata');
        const tech = await withTimeout(extractAudioMeta(file), 8000, {} as any);
        bitDepth = tech.bitDepth;
        sampleRate = tech.sampleRate;
        bitrateKbps = tech.bitrateKbps;
        codecLabel = tech.codecLabel;
      } catch {}

      await new Promise((resolve) => {
        const finalize = () => {
          const tags = (mmTags?.tags || metadata?.tags || {}) as Record<string, any>;
          const filenameNumbers = extractNumbersFromFilename(file.name);
          const pathDisc = extractDiscFromPath((file as File & { webkitRelativePath?: string }).webkitRelativePath);
          const trackTagNumber = extractNumberFromTags(tags, tagNumberKeys.track);
          const discTagNumber = extractNumberFromTags(tags, tagNumberKeys.disc);
          const derivedTrackNumber = trackTagNumber ?? filenameNumbers.trackNumber;
          const derivedDiscNumber = discTagNumber ?? pathDisc ?? filenameNumbers.discNumber;

          let coverArt: string | undefined;
          if (tags.picture) {
            const { data, format: imgFormat } = tags.picture;
            let base64String = '';
            for (let j = 0; j < data.length; j++) {
              base64String += String.fromCharCode(data[j]);
            }
            coverArt = `data:${imgFormat};base64,${btoa(base64String)}`;
          }

          const filePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
          const inferredFromPath = deriveFromPath(filePath);
          const inferredFromName = deriveFromFilename(file.name);
          const title = (tags.title as string | undefined) || inferredFromName.title || stripExtension(file.name);
          const artistValue = (tags.artist as string | undefined)
            || inferredFromName.artist
            || inferredFromPath.artist
            || 'Unknown Artist';
          const albumValue = (tags.album as string | undefined)
            || inferredFromPath.album
            || inferredFromName.album
            || 'Unknown Album';

          const trackId = `local-${Date.now()}-${i}`;
          const durationSeconds = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
          const isLongTrack = durationSeconds > LONG_TRACK_SECONDS;

          const track: LocalTrack = {
            id: trackId,
            name: title,
            artist: artistValue,
            album: albumValue,
            albumArtist: (tags.album_artist as string | undefined) || artistValue,
            year: tags.year,
            trackNumber: derivedTrackNumber,
            discNumber: derivedDiscNumber,
            genre: tags.genre,
            addedAt: importTimestamp + i,
            file,
            url,
            duration: durationSeconds,
            format,
            size: file.size,
            coverArt,
            bitDepth,
            sampleRate,
            bitrateKbps,
            codecLabel: codecLabel || format,
            isLong: isLongTrack,
          };
          newTracks.push(track);
          existingSignatures.add(signature);
          setImportProgress((p) => p ? { ...p, processed: p.processed + 1 } : null);
          resolve(null);
        };
        const timeout = setTimeout(finalize, 4000);
        audio.addEventListener('loadedmetadata', () => { clearTimeout(timeout); finalize(); });
        audio.addEventListener('error', () => { clearTimeout(timeout); finalize(); });
      });

      return null;
    };

    // Limited concurrency processing
    const concurrency = Math.min(5, audioFiles.length);
    const queue: Promise<null>[] = [];
    let index = 0;
    const pump = (): Promise<void> => {
      if (index >= audioFiles.length) {
        return Promise.resolve();
      }
      const currentIndex = index;
      const p = processOne(audioFiles[currentIndex], currentIndex);
      index += 1;
      queue.push(p);
      return p.then(() => pump());
    };
    const starters = Array.from({ length: concurrency }, () => pump());
    await Promise.all(starters);

    console.log('Adding', newTracks.length, 'new tracks to state');
    setLocalTracks([...localTracks, ...newTracks]);
    setIsExpanded(true);
    setImportProgress(null);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Save new tracks to IndexedDB
    console.log('Saving tracks to database...');
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await Promise.all(newTracks.map(track => new Promise<void>((resolve, reject) => {
        const req = store.put(track);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })));
    } catch (error) {
      console.error('Failed bulk save, falling back to per-track:', error);
      for (const track of newTracks) {
        try {
          await saveTrackToDB(track);
        } catch (err) {
          console.error('Failed to save track:', track.id, err);
        }
      }
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    console.log('Deleting track:', trackId);
    const track = localTracks.find(t => t.id === trackId);
    if (track?.url && track.url.startsWith('blob:')) {
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

  // Sort tracks within each album by disc number first, then track number
  Object.keys(albumGroups).forEach(albumKey => {
    albumGroups[albumKey].sort((a, b) => {
      // Default disc number to 1 if not specified
      const discA = a.discNumber || 1;
      const discB = b.discNumber || 1;
      
      if (discA !== discB) {
        return discA - discB;
      }
      // Then sort by track number within the same disc
      const trackComparison = (a.trackNumber || 0) - (b.trackNumber || 0);
      if (trackComparison !== 0) {
        return trackComparison;
      }

      // Finally fall back to import order to prevent shuffle when metadata is missing
      return (a.addedAt || 0) - (b.addedAt || 0);
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
      totalDuration: tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0),
    };
  });

  // Reset pagination on key view state changes
  useEffect(() => {
    setPage(1);
  }, [viewMode, sortMode, selectedAlbum, localTracks.length]);

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
        className={`p-4 flex items-center justify-between cursor-pointer local-vault-header ${isExpanded ? 'expanded' : ''}`}
        onClick={toggleVault}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleVault();
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls="local-vault-panel"
      >
        <div className="flex items-center gap-3 local-vault-info">
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
            <h3 className="mono local-vault-title" style={{ color: '#e0e0e0' }}>
              Local Vault
            </h3>
            <p className="mono local-vault-meta" style={{ color: '#a0a0a0' }}>
              {localTracks.length} {localTracks.length === 1 ? 'track' : 'tracks'} • Private only
            </p>
          </div>
        </div>

        <div className="local-vault-indicator" aria-hidden="true" />

        {/* Upload Buttons */}
        <div className="flex items-center local-vault-actions">
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              folderInputRef.current?.click();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: 'rgba(211, 47, 47, 0.15)',
              border: '1px solid #d32f2f',
            }}
            title="Import Folder (preserves artist/album path)"
          >
            <FolderOpen size={16} color="#d32f2f" />
            <span className="mono" style={{ color: '#d32f2f', fontSize: '0.8rem' }}>
              Import Folder
            </span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              repairMetadata();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
            title="Repair metadata from filenames"
          >
            <span className="mono" style={{ color: '#e0e0e0', fontSize: '0.8rem' }}>
              Repair Metadata
            </span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.flac,.wav,.mp3,.m4a,.aac,.ogg,.aif,.aiff,.alac,.wv,.mka"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="audio/*,.flac,.wav,.mp3,.m4a,.aac,.ogg,.aif,.aiff,.alac,.wv,.mka"
          // @ts-ignore - non-standard attribute for directory selection
          webkitdirectory="true"
        />
      </div>

      {/* Track List */}
      <div className={`hydraulic-panel ${isExpanded ? 'open' : ''}`} id="local-vault-panel">
        <div className="hydraulic-content">
          <div className="p-4">
          {importProgress && (
            <div className="mb-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#252525', border: '1px solid #333333' }}>
              <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                Importing {importProgress.processed}/{importProgress.total} files...
              </p>
              <div className="w-full h-1 rounded-full mt-2" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <div className="h-1 rounded-full" style={{ width: `${(importProgress.processed / Math.max(1, importProgress.total)) * 100}%`, background: 'linear-gradient(to right, #d32f2f, #b71c1c)' }} />
              </div>
            </div>
          )}
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
              {/* View Mode + Sort Controls */}
              <div className="flex flex-wrap gap-2 mb-4 items-center">
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

                {viewMode === 'tracks' && (
                  <div className="ml-auto flex items-center gap-2">
                    <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>Sort:</span>
                    <select
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as 'added' | 'title' | 'artist')}
                      className="mono px-3 py-2 rounded-lg"
                      style={{ backgroundColor: '#252525', border: '1px solid #333333', color: '#e0e0e0', fontSize: '0.75rem' }}
                    >
                      <option value="added">Added</option>
                      <option value="title">A–Z</option>
                      <option value="artist">Artist</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Back button when viewing album tracks */}
              {selectedAlbum && viewMode === 'albums' && (
                <button
                  onClick={() => setSelectedAlbum(null)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4 transition-all duration-200 hover:scale-105"
                  style={{
                    backgroundColor: '#252525',
                    border: '1px solid #333333',
                  }}
                >
                  <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                    ← Back to Albums
                  </span>
                </button>
              )}

              {viewMode === 'tracks' ? (
                <div className="space-y-2">
                  {(() => {
                    const tracks = [...localTracks];
                    if (sortMode === 'title') {
                      tracks.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
                    } else if (sortMode === 'artist') {
                      tracks.sort((a, b) => (a.artist || '').localeCompare(b.artist || '', undefined, { sensitivity: 'base' }));
                    } else {
                      tracks.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
                    }
                    const total = tracks.length;
                    const start = (page - 1) * pageSize;
                    const end = Math.min(start + pageSize, total);
                    const pageItems = tracks.slice(start, end);
                    return pageItems;
                  })().map((track) => (
                    <div
                      key={track.id}
                      className="group flex items-center gap-4 p-3 rounded-lg transition-all duration-200"
                      onClick={() => {
                        if (playLockRef.current) return;
                        playLockRef.current = true;
                        try {
                          onPlayTrack(track);
                        } finally {
                          setTimeout(() => { playLockRef.current = false; }, 300);
                        }
                      }}
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
                            {formatDuration(track.duration ?? 0)}
                          </span>
                        </div>
                      </div>

                      {/* Play Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (playLockRef.current) return;
                          playLockRef.current = true;
                          try {
                            onPlayTrack(track);
                          } finally {
                            // Release lock after short delay to avoid rapid double-starts
                            setTimeout(() => { playLockRef.current = false; }, 300);
                          }
                        }}
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
                        onClick={(e) => { e.stopPropagation(); handleDeleteTrack(track.id); }}
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
                  {/* Pagination controls */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>Per page:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(parseInt(e.target.value, 10) || 25)}
                        className="mono px-2 py-1 rounded-lg"
                        style={{ backgroundColor: '#252525', border: '1px solid #333333', color: '#e0e0e0', fontSize: '0.75rem' }}
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1 rounded-lg"
                        style={{ backgroundColor: '#252525', border: '1px solid #333333', color: '#e0e0e0', fontSize: '0.75rem' }}
                      >
                        Prev
                      </button>
                      <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>{page}</span>
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3 py-1 rounded-lg"
                        style={{ backgroundColor: '#252525', border: '1px solid #333333', color: '#e0e0e0', fontSize: '0.75rem' }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              ) : selectedAlbum ? (
                /* Show album tracklist */
                <div className="space-y-2">
                  {(() => {
                    const album = albums.find(a => a.name === selectedAlbum.name && a.artist === selectedAlbum.artist);
                    if (!album) return null;
                    
                    const tracks = album.tracks;

                    // Build explicit disc groups using inferred/effective disc numbers
                    const discGroups: Record<number, { disc: number; items: { track: LocalTrack; index: number }[] }> = {};
                    let inferredDisc = 1;
                    let lastTrackNumber = 0;

                    tracks.forEach((track, index) => {
                      const trackNumber = track.trackNumber ?? index + 1;
                      let effectiveDisc = track.discNumber ?? undefined;

                      if (effectiveDisc === undefined) {
                        if (index === 0) {
                          inferredDisc = 1;
                        } else if (trackNumber < lastTrackNumber) {
                          inferredDisc += 1;
                        }
                        effectiveDisc = inferredDisc;
                      } else {
                        inferredDisc = effectiveDisc;
                      }

                      lastTrackNumber = trackNumber;
                      const discKey = effectiveDisc ?? 1;
                      if (!discGroups[discKey]) {
                        discGroups[discKey] = { disc: discKey, items: [] };
                      }
                      discGroups[discKey].items.push({ track, index });
                    });

                    const orderedGroups = Object.values(discGroups).sort((a, b) => a.disc - b.disc);

                    return orderedGroups.map(group => (
                      <div key={`disc-${group.disc}`}>
                        {/* Disc Header */}
                        <div 
                          className="flex items-center gap-2 px-3 py-2 mb-2 mt-4"
                          style={{
                            backgroundColor: 'rgba(211, 47, 47, 0.1)',
                            border: '1px solid rgba(211, 47, 47, 0.3)',
                            borderRadius: '8px',
                          }}
                        >
                          <span className="mono" style={{ color: '#d32f2f', fontSize: '0.75rem', fontWeight: 600 }}>
                            DISC {group.disc}
                          </span>
                        </div>

                        {group.items.map(({ track, index }) => (
                          <div
                            key={track.id}
                            className="group flex items-center gap-3 p-3 rounded-lg transition-all duration-200 hover:bg-[#252525]"
                            style={{
                              backgroundColor: currentPlayingId === track.id ? 'rgba(211, 47, 47, 0.1)' : '#1a1a1a',
                              border: `1px solid ${currentPlayingId === track.id ? '#d32f2f' : '#333333'}`,
                            }}
                          >
                            {/* Track Number */}
                            <div className="flex-shrink-0 w-8 text-center">
                              <span className="mono" style={{ color: '#666666', fontSize: '0.75rem' }}>
                                {track.trackNumber ?? index + 1}
                              </span>
                            </div>

                            {/* Track Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0" style={{ alignItems: 'center' }}>
                                <h4 className="mono truncate" style={{ color: '#e0e0e0', fontSize: '0.85rem', margin: 0, lineHeight: '1.2' }}>
                                  {track.name}
                                </h4>
                                {/* Codec chip */}
                                {track.codecLabel && (
                                  <span
                                    className="mono"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: '0 8px',
                                      height: '22px',
                                      borderRadius: '6px',
                                      border: '1px solid #333333',
                                      background: 'rgba(26,26,26,0.6)',
                                      fontSize: '0.72rem',
                                      color: '#e0e0e0'
                                    }}
                                  >
                                    {String(track.codecLabel).toUpperCase()}
                                  </span>
                                )}
                                {/* Fixed-size badge: <bit>-bit/<kHz>kHz */}
                                {(track.bitDepth || track.sampleRate) && (
                                  <span
                                    className="mono"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '4px',
                                      width: '136px',
                                      height: '22px',
                                      borderRadius: '6px',
                                      border: '1px solid #333333',
                                      background: 'rgba(26,26,26,0.6)',
                                      padding: '0 8px',
                                      fontSize: '0.72rem'
                                    }}
                                  >
                                    <span style={{
                                      color: track.bitDepth === 24 ? '#c6a700' : '#a0a0a0'
                                    }}>{track.bitDepth ? `${track.bitDepth}-bit` : ''}</span>
                                    <span style={{ color: '#555' }}>/</span>
                                    <span style={{ color: '#d32f2f' }}>{track.sampleRate ? `${track.sampleRate}kHz` : ''}</span>
                                  </span>
                                )}
                              </div>
                              <p className="mono truncate" style={{ color: '#a0a0a0', fontSize: '0.7rem', marginTop: '2px', lineHeight: '1.2' }}>
                                {track.artist} • {formatDuration(track.duration ?? 0)}
                              </p>
                            </div>

                            {/* Play Button */}
                            <button
                              onClick={() => {
                                if (playLockRef.current) return;
                                playLockRef.current = true;
                                try {
                                  onPlayTrack(track);
                                } finally {
                                  setTimeout(() => { playLockRef.current = false; }, 300);
                                }
                              }}
                              className="flex-shrink-0 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
                              style={{
                                backgroundColor: currentPlayingId === track.id ? '#d32f2f' : 'rgba(211, 47, 47, 0.15)',
                                border: '1px solid #d32f2f',
                              }}
                            >
                              {isPlaying && currentPlayingId === track.id ? (
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
                    ));
                  })()}
                </div>
              ) : (
                <>
                {/* Show album grid with pagination */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(() => {
                    const total = albums.length;
                    const start = (page - 1) * pageSize;
                    const end = Math.min(start + pageSize, total);
                    return albums.slice(start, end);
                  })().map((album, index) => (
                    <div
                      key={`${album.name}-${album.artist}-${index}`}
                      className="group rounded-lg overflow-hidden transition-all duration-200 hover:scale-105 cursor-pointer"
                      style={{
                        backgroundColor: '#252525',
                        border: '1px solid #333333',
                      }}
                      onClick={() => setSelectedAlbum({ name: album.name, artist: album.artist })}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlayAlbum?.(album.tracks);
                          }}
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
                {/* Pagination controls for albums */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>Per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(parseInt(e.target.value, 10) || 25)}
                      className="mono px-2 py-1 rounded-lg"
                      style={{ backgroundColor: '#252525', border: '1px solid #333333', color: '#e0e0e0', fontSize: '0.75rem' }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-lg"
                      style={{ backgroundColor: '#252525', border: '1px solid #333333', color: '#e0e0e0', fontSize: '0.75rem' }}
                    >
                      Prev
                    </button>
                    <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>{page}</span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      className="px-3 py-1 rounded-lg"
                      style={{ backgroundColor: '#252525', border: '1px solid #333333', color: '#e0e0e0', fontSize: '0.75rem' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
                </>
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
      </div>
    </div>
  </div>
  );
}

// Repair unknown artist/album/title using filename heuristics
async function repairMetadata(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const all = await new Promise<any[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    let updatedCount = 0;
    for (const t of all) {
      const inferred = deriveFromFilename(t.file?.name || t.name || '');
      const needsArtist = !t.artist || t.artist === 'Unknown Artist';
      const needsAlbum = !t.album || t.album === 'Unknown Album';
      const needsTitle = !t.name || /^\d{1,3}[\s._-]/.test(t.name);
      const next = {
        ...t,
        artist: needsArtist ? (inferred.artist || t.artist) : t.artist,
        album: needsAlbum ? (inferred.album || t.album) : t.album,
        name: needsTitle ? (inferred.title || t.name) : t.name,
        albumArtist: t.albumArtist || (needsArtist ? (inferred.artist || t.artist) : t.artist),
      };

      if (next.artist !== t.artist || next.album !== t.album || next.name !== t.name || next.albumArtist !== t.albumArtist) {
        await new Promise<void>((resolve, reject) => {
          const putReq = store.put(next);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        });
        updatedCount += 1;
      }
    }

    // Update UI state
    try {
      const refreshed = await getAllTracksFromDB();
      const tracksWithUrls = refreshed.map((track) => ({
        ...track,
        url: track.url || (track.file ? URL.createObjectURL(track.file) : ''),
      }));
      // @ts-ignore: update local state via window event to avoid ref leakage
      window.dispatchEvent(new CustomEvent('brick:local-tracks-refreshed', { detail: { count: updatedCount, tracks: tracksWithUrls } }));
    } catch {}
    console.log(`Repair complete: updated ${updatedCount} tracks`);
  } catch (e) {
    console.error('Repair metadata failed:', e);
  }
}
