// Type declaration for jsmediatags library loaded via CDN
// Remove reliance on window.jsmediatags (CDN) for app builds

import { Upload, Music, Trash2, Play, Pause, Album, ListMusic, FolderOpen, Cloud } from 'lucide-react';
import { parseRemoteMetadataFromUrl } from '../utils/cloudMetadata';
import { generateCodeVerifier, generateCodeChallenge, buildGoogleAuthUrl, exchangeGoogleCodeForToken, buildMicrosoftAuthUrl, exchangeMicrosoftCodeForToken, refreshGoogleAccessToken, refreshMicrosoftAccessToken } from '../utils/cloudAuth';
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
  sampleRate?: number; // Hz (when available)
  codec?: string;
  bitrate?: number;
  duration?: number;
  url?: string;
  audioUrl?: string;
  isLong?: boolean;
  type: 'local';
}

interface CloudTrack {
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
  fileId: string; // Google Drive or OneDrive file ID
  accessToken: string; // OAuth access token
  provider: 'google' | 'onedrive';
  format: string;
  size: number;
  coverArt?: string; // Base64 encoded image (lazy loaded)
  bitDepth?: number;
  sampleRate?: number;
  codec?: string;
  bitrate?: number;
  duration?: number;
  url?: string; // Lazy loaded
  audioUrl?: string; // direct download link or signed url
  isLong?: boolean;
  type: 'cloud';
}

type Track = LocalTrack | CloudTrack;

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

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
}

interface OneDriveItem {
  id: string;
  name: string;
  size?: number;
  folder?: { childCount?: number };
  file?: { mimeType?: string };
}

interface LocalMusicUploaderProps {
  onPlayTrack: (track: Track) => void;
  onPlayAlbum?: (tracks: Track[]) => void;
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

const clearAllTracksInDB = async (): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export function LocalMusicUploader({ onPlayTrack, onPlayAlbum, currentPlayingId, isPlaying }: LocalMusicUploaderProps) {
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const ONEDRIVE_CLIENT_ID = import.meta.env.VITE_ONEDRIVE_CLIENT_ID || '';
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [cloudTracks, setCloudTracks] = useState<CloudTrack[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number } | null>(null);
  const [viewMode, setViewMode] = useState<'tracks' | 'albums'>('tracks');
  const [sortMode, setSortMode] = useState<'added' | 'title' | 'artist'>('added');
  const [selectedAlbum, setSelectedAlbum] = useState<{ name: string; artist: string } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  // settings dropdown removed (moved to global Settings modal)
  // Pagination state to keep UI concise with large libraries
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const playLockRef = useRef(false);
  // settingsRef removed
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

        // Load local tracks
        const storedTracks = await getAllTracksFromDB();
        console.log('Retrieved local tracks from IndexedDB:', storedTracks.length);

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
              audioUrl: url,
              type: 'local' as const,
            };
          } catch (error) {
            console.error('Failed to process track:', track.id, error);
            return null;
          }
        }).filter(Boolean) as LocalTrack[];

        console.log('Successfully loaded local tracks:', tracksWithFiles.length);
        setLocalTracks(tracksWithFiles);

        // Load cloud tracks
        const db = await openBrickDB();
        const cloudTransaction = db.transaction(['cloudTracks'], 'readonly');
        const cloudStore = cloudTransaction.objectStore('cloudTracks');
        const cloudRequest = cloudStore.getAll();

        cloudRequest.onsuccess = () => {
          const loadedCloudTracks = cloudRequest.result.map(track => ({
            ...track,
            type: 'cloud' as const,
          }));
          console.log('Successfully loaded cloud tracks:', loadedCloudTracks.length);
          setCloudTracks(loadedCloudTracks);
        };

      } catch (error) {
        console.error('Error loading tracks from IndexedDB:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTracks();

    // Cleanup: revoke blob URLs when component unmounts
    return () => {
      localTracks.forEach(track => {
        const blob = track.audioUrl ?? track.url;
        if (blob?.startsWith('blob:')) {
          URL.revokeObjectURL(blob);
        }
      });
    };
  }, []);

  // Refresh local track UI when metadata repair or other DB refresh occurs
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (detail?.tracks) {
          setLocalTracks(detail.tracks);
        } else {
          (async () => {
            try {
              const stored = await getAllTracksFromDB();
              const baseTimestamp = Date.now();
              const tracksWithFiles: LocalTrack[] = stored.map((track, idx) => ({ ...track, url: track.url || (track.file ? URL.createObjectURL(track.file) : ''), audioUrl: track.audioUrl || (track.file ? URL.createObjectURL(track.file) : ''), addedAt: track.addedAt ?? baseTimestamp + idx }));
              setLocalTracks(tracksWithFiles);
            } catch {}
          })();
        }
      } catch (err) { /* noop */ }
    };
    window.addEventListener('brick:local-tracks-refreshed', handler as EventListener);
    return () => window.removeEventListener('brick:local-tracks-refreshed', handler as EventListener);
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
            codec: format,
            isLong: isLongTrack,
            type: 'local' as const,
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
    // Try to find in localTracks
    const local = localTracks.find(t => t.id === trackId);
    if (local) {
      const blob = local.audioUrl ?? local.url;
      if (blob && blob.startsWith('blob:')) {
        try { URL.revokeObjectURL(blob); } catch {}
      }
      setLocalTracks(localTracks.filter(t => t.id !== trackId));
      try {
        await deleteTrackFromDB(trackId);
        console.log('Successfully deleted local track:', trackId);
      } catch (error) {
        console.error('Error deleting local track from IndexedDB:', error);
      }
      return;
    }

    // Try to find in cloudTracks
    const cloud = cloudTracks.find(t => t.id === trackId);
    if (cloud) {
      setCloudTracks(cloudTracks.filter(t => t.id !== trackId));
      try {
        const db = await openBrickDB();
        const tx = db.transaction(['cloudTracks'], 'readwrite');
        const store = tx.objectStore('cloudTracks');
        store.delete(trackId);
        console.log('Successfully deleted cloud track:', trackId);
      } catch (error) {
        console.error('Error deleting cloud track from IndexedDB:', error);
      }
      return;
    }
  };

  const handlePlayClick = async (track: Track) => {
    if (playLockRef.current) return;
    playLockRef.current = true;
    try {
      if (track.type === 'cloud') {
        const cloudTrack = track as CloudTrack;
        // Ensure audioUrl is resolved (and tokens refreshed) for cloud tracks
        if (cloudTrack.fileId) {
          await resolveAudioUrlForCloudTrack(cloudTrack);
        }
        // Only fetch metadata if missing
        if ((!cloudTrack.artist || cloudTrack.artist === 'Unknown Artist') && cloudTrack.audioUrl) {
          const parsed = await parseRemoteMetadata(cloudTrack);
          if (parsed && parsed.tags) {
            const tags: any = parsed.tags;
            const artist = tags.artist || tags.TPE1 || cloudTrack.artist;
            const title = tags.title || tags.TIT2 || cloudTrack.name;
            const album = tags.album || tags.TALB || cloudTrack.album;
            let coverArt: string | undefined;
            if (tags.picture) {
              const { data, format: imgFormat } = tags.picture;
              let base64String = '';
              for (let j = 0; j < data.length; j++) {
                base64String += String.fromCharCode(data[j]);
              }
              coverArt = `data:${imgFormat};base64,${btoa(base64String)}`;
            }
            // Update cloudTrack and DB
            cloudTrack.artist = artist || cloudTrack.artist;
            cloudTrack.name = title || cloudTrack.name;
            cloudTrack.album = album || cloudTrack.album;
            if (coverArt) cloudTrack.coverArt = coverArt;
            try {
              const db = await openBrickDB();
              const tx = db.transaction(['cloudTracks'], 'readwrite');
              const store = tx.objectStore('cloudTracks');
              store.put(cloudTrack);
              setCloudTracks(prev => prev.map(t => t.id === cloudTrack.id ? cloudTrack : t));
            } catch (err) {
              console.warn('Failed to update cloud track metadata in DB:', err);
            }
          }
        }
        // audioUrl resolution already handled earlier
      }
      onPlayTrack(track);
    } finally {
      setTimeout(() => { playLockRef.current = false; }, 300);
    }
  };

  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [cloudUrlInput, setCloudUrlInput] = useState('');

  const handleConnectCloud = async () => {
    // Show cloud connect modal options
    setCloudModalOpen(true);
  };
  // Tokens and file listing state
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [oneDriveFiles, setOneDriveFiles] = useState<OneDriveItem[]>([]);
  const [selectedDriveFiles, setSelectedDriveFiles] = useState<Record<string, boolean>>({});
  const [selectedOneDriveFiles, setSelectedOneDriveFiles] = useState<Record<string, boolean>>({});

  const connectGoogleDrive = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = `${location.origin}/oauth_callback.html`;
    if (!clientId) {
      alert('VITE_GOOGLE_CLIENT_ID not set. Please configure a Google OAuth client ID in your environment variables.');
      return;
    }
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    sessionStorage.setItem('gdrive_code_verifier', codeVerifier);
    const authUrl = await buildGoogleAuthUrl({ clientId, redirectUri, codeChallenge });
    const w = window.open(authUrl, 'google_oauth', 'width=600,height=600');
    const listener = async (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const data = e.data as any;
      if (data && data.provider === 'google' && data.code) {
        try {
          const tokenResp = await exchangeGoogleCodeForToken({ code: data.code, codeVerifier, redirectUri, clientId });
          // Compute expiry
          const expiresAt = Date.now() + ((tokenResp.expires_in ?? 3600) * 1000);
          const tokenToStore = { ...tokenResp, expires_at: expiresAt };
          // Save token
          const db = await openBrickDB();
          const tx = db.transaction(['cloudTokens'], 'readwrite');
          const store = tx.objectStore('cloudTokens');
          store.put({ provider: 'google', token: tokenToStore });
          alert('Google Drive connected');
        } catch (err) {
          console.error('Failed to exchange Google token', err);
        }
        window.removeEventListener('message', listener);
        clearInterval(checkClosed);
        w?.close();
      }
    };
    window.addEventListener('message', listener);
    const checkClosed = setInterval(() => {
      try {
        if (!w || w.closed) {
          window.removeEventListener('message', listener);
          clearInterval(checkClosed);
        }
      } catch (err) {
        // ignore
      }
    }, 500);
  };

  const connectOneDrive = async () => {
    const clientId = import.meta.env.VITE_ONEDRIVE_CLIENT_ID;
    const redirectUri = `${location.origin}/oauth_callback.html`;
    if (!clientId) {
      alert('VITE_ONEDRIVE_CLIENT_ID not set. Please configure OneDrive OAuth client ID in your environment variables.');
      return;
    }
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    sessionStorage.setItem('onedrive_code_verifier', codeVerifier);
    const authUrl = await buildMicrosoftAuthUrl({ clientId, redirectUri, codeChallenge });
    const w = window.open(authUrl, 'onedrive_oauth', 'width=600,height=600');
    const listener = async (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const data = e.data as any;
      if (data && data.provider === 'onedrive' && data.code) {
        try {
          const tokenResp = await exchangeMicrosoftCodeForToken({ code: data.code, codeVerifier, redirectUri, clientId });
          const expiresAt = Date.now() + ((tokenResp.expires_in ?? 3600) * 1000);
          const tokenToStore = { ...tokenResp, expires_at: expiresAt };
          // Save token
          const db = await openBrickDB();
          const tx = db.transaction(['cloudTokens'], 'readwrite');
          const store = tx.objectStore('cloudTokens');
          store.put({ provider: 'onedrive', token: tokenToStore });
          alert('OneDrive connected');
        } catch (err) {
          console.error('Failed to exchange OneDrive token', err);
        }
        window.removeEventListener('message', listener);
        clearInterval(checkClosed2);
        w?.close();
      }
    };
    window.addEventListener('message', listener);
    const checkClosed2 = setInterval(() => {
      try {
        if (!w || w.closed) {
          window.removeEventListener('message', listener);
          clearInterval(checkClosed2);
        }
      } catch (err) {
        // ignore
      }
    }, 500);
  };

  // simple getter removed; replaced with auto-refreshing getter below

  const refreshCloudToken = async (provider: 'google' | 'onedrive') => {
    try {
      const db = await openBrickDB();
      const tx = db.transaction(['cloudTokens'], 'readwrite');
      const store = tx.objectStore('cloudTokens');
      const req = store.get(provider);
      const tokenObj: any = await new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result?.token);
        req.onerror = () => resolve(null);
      });
      if (!tokenObj || !tokenObj.refresh_token) return null;

      let refreshed: any = null;
      if (provider === 'google') {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) throw new Error('Missing Google client id');
        refreshed = await refreshGoogleAccessToken({ refreshToken: tokenObj.refresh_token, clientId });
      } else {
        const clientId = import.meta.env.VITE_ONEDRIVE_CLIENT_ID;
        if (!clientId) throw new Error('Missing OneDrive client id');
        refreshed = await refreshMicrosoftAccessToken({ refreshToken: tokenObj.refresh_token, clientId });
      }
      if (refreshed) {
        const expiresAt = Date.now() + ((refreshed.expires_in ?? 3600) * 1000);
        const merged = { ...tokenObj, ...refreshed, expires_at: expiresAt };
        store.put({ provider, token: merged });
        return merged;
      }
      return null;
    } catch (err) {
      console.warn('Failed refreshing cloud token', err);
      return null;
    }
  };

  // getCloudToken auto-refreshes when token is near expiry
  const getCloudToken = async (provider: 'google' | 'onedrive') => {
    const db = await openBrickDB();
    const tx = db.transaction(['cloudTokens'], 'readonly');
    const store = tx.objectStore('cloudTokens');
    const tokenObj: any = await new Promise((resolve) => {
      const req = store.get(provider);
      req.onsuccess = () => resolve(req.result?.token);
      req.onerror = () => resolve(null);
    });
    if (!tokenObj) return null;
    const now = Date.now();
    // If token is near expiry (within 60 seconds), attempt refresh
    if (tokenObj.expires_at && (now > tokenObj.expires_at - 60000)) {
      const refreshed = await refreshCloudToken(provider);
      return refreshed ?? tokenObj;
    }
    return tokenObj;
  };

  const listDriveFiles = async () => {
    const token = await getCloudToken('google');
    if (!token?.access_token) {
      alert('No Google Drive token found. Please connect first.');
      return;
    }
    try {
      // List both audio files and folders
      let resp = await fetch(`https://www.googleapis.com/drive/v3/files?q=(mimeType contains 'audio' or mimeType = 'application/vnd.google-apps.folder') and trashed=false&fields=files(id,name,mimeType,size,thumbnailLink)`, { headers: { Authorization: `Bearer ${token.access_token}` } });
      if (resp.status === 401) {
        const refreshed = await refreshCloudToken('google');
        if (refreshed?.access_token) {
          resp = await fetch(`https://www.googleapis.com/drive/v3/files?q=(mimeType contains 'audio' or mimeType = 'application/vnd.google-apps.folder') and trashed=false&fields=files(id,name,mimeType,size,thumbnailLink)`, { headers: { Authorization: `Bearer ${refreshed.access_token}` } });
        }
      }
      const json = await resp.json();
      setDriveFiles(json.files || []);
    } catch (err) {
      console.error('Failed to list Drive files', err);
    }
  };

  const disconnectGoogleDrive = async () => {
    try {
      const db = await openBrickDB();
      const tx = db.transaction(['cloudTokens'], 'readwrite');
      const store = tx.objectStore('cloudTokens');
      store.delete('google');
      alert('Disconnected Google Drive');
    } catch (err) {
      console.warn('Failed to disconnect Google Drive', err);
    }
  };

  const listOneDriveFiles = async () => {
    const token = await getCloudToken('onedrive');
    if (!token?.access_token) {
      alert('No OneDrive token found. Please connect first.');
      return;
    }
    try {
      // List children of root, then filter for audio files and folders
      let resp = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/children?$select=id,name,size,folder,file`, { headers: { Authorization: `Bearer ${token.access_token}` } });
      if (resp.status === 401) {
        const refreshed = await refreshCloudToken('onedrive');
        if (refreshed?.access_token) {
          resp = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/children?$select=id,name,size,folder,file`, { headers: { Authorization: `Bearer ${refreshed.access_token}` } });
        }
      }
      const json = await resp.json();
      // Filter for audio files and folders
      const filtered = (json.value || []).filter((item: any) => {
        if (item.folder) return true; // include folders
        if (item.file && item.file.mimeType && item.file.mimeType.startsWith('audio/')) return true;
        return false;
      });
      setOneDriveFiles(filtered);
    } catch (err) {
      console.error('Failed to list OneDrive files', err);
    }
  };

  const disconnectOneDrive = async () => {
    try {
      const db = await openBrickDB();
      const tx = db.transaction(['cloudTokens'], 'readwrite');
      const store = tx.objectStore('cloudTokens');
      store.delete('onedrive');
      alert('Disconnected OneDrive');
    } catch (err) {
      console.warn('Failed to disconnect OneDrive', err);
    }
  };

  const importSelectedDriveFiles = async () => {
    const selectedIds = Object.keys(selectedDriveFiles).filter(k => selectedDriveFiles[k]);
    if (!selectedIds.length) return;
    const token = await getCloudToken('google');
    const toImport: CloudTrack[] = selectedIds.map(id => {
      const f = driveFiles.find((d) => d.id === id);
      return ({
        id: `gdrive-${id}`,
        name: f?.name || id,
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        addedAt: Date.now(),
        fileId: id,
        accessToken: token?.access_token || '',
        provider: 'google',
        format: f?.mimeType?.split('/')?.pop()?.toUpperCase() || 'MP3',
        size: f?.size ? Number(f.size) : 0,
        audioUrl: `http://localhost:4000/api/cloud/audio?provider=google&fileId=${id}&accessToken=${encodeURIComponent(token?.access_token || '')}`,
        type: 'cloud',
      });
    });
    try {
      const db = await openBrickDB();
      const tx = db.transaction(['cloudTracks'], 'readwrite');
      const store = tx.objectStore('cloudTracks');
      for (const t of toImport) store.put(t);
      setCloudTracks(prev => [...prev, ...toImport]);
      setDriveFiles([]);
      setSelectedDriveFiles({});
    } catch (err) {
      console.error('Failed to import Drive files', err);
    }
  };

  const importSelectedOneDriveFiles = async () => {
    const selectedIds = Object.keys(selectedOneDriveFiles).filter(k => selectedOneDriveFiles[k]);
    if (!selectedIds.length) return;
    const token = await getCloudToken('onedrive');
    const toImport: CloudTrack[] = selectedIds.map(id => {
      const f = oneDriveFiles.find((d) => d.id === id);
      return ({
        id: `onedrive-${id}`,
        name: f?.name || id,
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        addedAt: Date.now(),
        fileId: id,
        accessToken: token?.access_token || '',
        provider: 'onedrive',
        format: f?.file?.mimeType?.split('/')?.pop()?.toUpperCase() || 'MP3',
        size: f?.size || 0,
        audioUrl: `http://localhost:4000/api/cloud/audio?provider=onedrive&fileId=${id}&accessToken=${encodeURIComponent(token?.access_token || '')}`,
        type: 'cloud',
      });
    });
    try {
      const db = await openBrickDB();
      const tx = db.transaction(['cloudTracks'], 'readwrite');
      const store = tx.objectStore('cloudTracks');
      for (const t of toImport) store.put(t);
      setCloudTracks(prev => [...prev, ...toImport]);
      setOneDriveFiles([]);
      setSelectedOneDriveFiles({});
    } catch (err) {
      console.error('Failed to import OneDrive files', err);
    }
  };

  const addCloudTrackFromUrl = async (url: string) => {
    if (!url) return;
    try {
      let name = url.split('/').pop() || url;
      // try to strip query string
      name = name.split('?')[0];
      const { title, artist, album } = deriveFromFilename(name);
      const extension = name.split('.').pop() || '';
      const format = extension.toUpperCase();

      // Detect cloud provider URLs
      let provider: 'google' | 'onedrive' = 'google';
      let fileId = url;
      let isCloudProvider = false;

      if (url.includes('drive.google.com')) {
        provider = 'google';
        let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match) {
          fileId = match[1];
          isCloudProvider = true;
        }
      } else if (url.includes('onedrive.live.com') || url.includes('sharepoint.com') || url.includes('1drv.ms')) {
        provider = 'onedrive';
        const urlObj = new URL(url);
        const id = urlObj.searchParams.get('id') || urlObj.searchParams.get('resid');
        if (id) {
          fileId = id;
          isCloudProvider = true;
        }
      }

      // For cloud providers, check if connected
      if (isCloudProvider) {
        const token = await getCloudToken(provider);
        if (!token?.access_token) {
          alert(`Please connect your ${provider === 'google' ? 'Google Drive' : 'OneDrive'} account first before importing URLs.`);
          return;
        }
      }

      const newTrack: CloudTrack = {
        id: `cloud-${Date.now()}`,
        name: title || name,
        artist: artist || 'Unknown Artist',
        album: album || 'Unknown Album',
        addedAt: Date.now(),
        fileId,
        audioUrl: isCloudProvider ? '' : url, // For cloud providers, resolve later
        accessToken: '',
        provider,
        format,
        size: 0, // Size unknown for URLs
        type: 'cloud',
      };

      const db = await openBrickDB();
      const tx = db.transaction(['cloudTracks'], 'readwrite');
      const store = tx.objectStore('cloudTracks');
      store.put(newTrack);
      setCloudTracks(prev => [...prev, newTrack]);
      setCloudModalOpen(false);
      setCloudUrlInput('');
    } catch (error) {
      console.error('Error adding cloud track from URL:', error);
    }
  };

  const resolveAudioUrlForCloudTrack = async (track: CloudTrack) => {
    try {
      // If fileId is a full public URL, use it directly
      if (typeof track.fileId === 'string' && (track.fileId.startsWith('http://') || track.fileId.startsWith('https://'))) {
        track.audioUrl = track.fileId;
        const db = await openBrickDB();
        const tx = db.transaction(['cloudTracks'], 'readwrite');
        const store = tx.objectStore('cloudTracks');
        store.put(track);
        setCloudTracks(prev => prev.map(t => t.id === track.id ? track : t));
        return track.audioUrl;
      }
      const token = await getCloudToken(track.provider);
      if (!token?.access_token) throw new Error('No token');
      // Use local proxy to avoid CORS
      const proxyUrl = `http://localhost:4000/api/cloud/audio?provider=${track.provider}&fileId=${track.fileId}&accessToken=${encodeURIComponent(token.access_token)}`;
      // Update DB with audioUrl
      track.audioUrl = proxyUrl;
      track.accessToken = token.access_token;
      const db = await openBrickDB();
      const tx = db.transaction(['cloudTracks'], 'readwrite');
      const store = tx.objectStore('cloudTracks');
      store.put(track);
      setCloudTracks(prev => prev.map(t => t.id === track.id ? track : t));
      return proxyUrl;
    } catch (err) {
      console.warn('Failed to resolve audio url for cloud track:', err);
      return null;
    }
  };

  const parseRemoteMetadata = async (track: CloudTrack) => {
    if (!track.audioUrl) return null;
    return await parseRemoteMetadataFromUrl(track.audioUrl, track.name);
  };

  const handleDeleteAllTracks = () => {
    setDeleteConfirmation('');
    setIsDeleteModalOpen(true);
  };

  const executeDeleteAllTracks = async () => {
    const phrase = deleteConfirmation.trim().toUpperCase();
    if (phrase !== 'DELETE') return;

    try {
      setIsDeletingAll(true);

      // Revoke existing blob URLs to free memory
      localTracks.forEach((track) => {
        const blob = (track as LocalTrack).audioUrl ?? (track as LocalTrack).url;
        if (blob && blob.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(blob);
          } catch {}
        }
      });

      setLocalTracks([]);
      await clearAllTracksInDB();
      console.log('All local tracks deleted from vault');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Failed to delete all local tracks:', error);
    } finally {
      setIsDeletingAll(false);
      setDeleteConfirmation('');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatBitrate = (bitrate?: number) => {
    if (!bitrate) return undefined;
    const kbps = bitrate > 1000 ? Math.round(bitrate / 1000) : Math.round(bitrate);
    return `${kbps} kbps`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTechBadge = (track: LocalTrack) => {
    const codec = track.codec || track.format;
    const bitrate = formatBitrate(track.bitrate);
    if (codec && bitrate) return `${String(codec).toUpperCase()} / ${bitrate}`;
    if (codec) return String(codec).toUpperCase();
    return bitrate ?? 'AUDIO';
  };

  // Group tracks by album
  const albumGroups = [...localTracks, ...cloudTracks].reduce((acc, track) => {
    const albumKey = `${track.album}:::${track.albumArtist || track.artist}`;
    if (!acc[albumKey]) {
      acc[albumKey] = [];
    }
    acc[albumKey].push(track);
    return acc;
  }, {} as Record<string, Track[]>);

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
  }, [viewMode, sortMode, selectedAlbum, localTracks.length, cloudTracks.length]);

  // (settings dropdown removed) 

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
            <h3 className="local-vault-title" style={{ color: '#e0e0e0', fontFamily: '"Chakra Petch", "Syne", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontWeight: 700, fontSize: '1.125rem' }}>
              <strong>Local Vault</strong>
            </h3>
            <p className="local-vault-meta mono" style={{ color: '#a0a0a0' }}>
              {localTracks.length + cloudTracks.length} {localTracks.length + cloudTracks.length === 1 ? 'track' : 'tracks'} • {localTracks.length} local, {cloudTracks.length} cloud
            </p>
          </div>
        </div>

        <div className="local-vault-indicator" aria-hidden="true" />

        {/* Upload Buttons */}
        <div className="flex items-center gap-2 local-vault-actions flex-nowrap" style={{ alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', maxWidth: '220px', margin: '0 auto' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="flex-shrink-0 rounded-lg transition-all duration-200 hover:scale-110"
              style={{
                width: '34px',
                height: '34px',
                minWidth: '34px',
                padding: 0,
                background: 'linear-gradient(120deg, rgba(211, 47, 47, 0.2), rgba(211, 47, 47, 0.32))',
                border: '1px solid #ff5f6d',
                boxShadow: '0 0 0 1px rgba(255, 95, 109, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Import Tracks"
            >
              <Upload size={14} color="#ff5f6d" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
              className="flex-shrink-0 rounded-lg transition-all duration-200 hover:scale-110"
              style={{
                width: '34px',
                height: '34px',
                minWidth: '34px',
                padding: 0,
                backgroundColor: 'rgba(211, 47, 47, 0.15)',
                border: '1px solid #d32f2f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Import Folder (preserves artist/album path)"
            >
              <FolderOpen size={14} color="#d32f2f" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleConnectCloud();
              }}
              disabled={!GOOGLE_CLIENT_ID && !ONEDRIVE_CLIENT_ID}
              className={`flex-shrink-0 rounded-lg transition-all duration-200 hover:scale-110 ${(!GOOGLE_CLIENT_ID && !ONEDRIVE_CLIENT_ID) ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                width: '34px',
                height: '34px',
                minWidth: '34px',
                padding: 0,
                backgroundColor: 'rgba(0, 188, 212, 0.15)',
                border: '1px solid #00bcd4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={!GOOGLE_CLIENT_ID && !ONEDRIVE_CLIENT_ID ? 'Configure VITE_GOOGLE_CLIENT_ID or VITE_ONEDRIVE_CLIENT_ID in .env.local' : 'Connect Cloud Storage'}
            >
              <Cloud size={14} color="#00bcd4" />
            </button>
              {/* Repair Metadata moved to global Settings — dropdown removed */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteAllTracks();
            }}
            className="flex-shrink-0 rounded-lg transition-all duration-200 hover:scale-110"
            style={{
              marginLeft: 0,
              width: '34px',
              height: '34px',
              minWidth: '34px',
              padding: 0,
              backgroundColor: 'transparent',
              border: '1px solid #ff1744',
              color: '#ff1744',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Delete all local tracks (requires typed confirmation)"
          >
            <Trash2 size={14} color="#ff1744" />
          </button>
        </div>

        {/* Cloud Import Modal */}
        {cloudModalOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setCloudModalOpen(false)} />
            <div className="relative z-50 w-full max-w-2xl p-4 rounded bg-[#252525] border" style={{ borderColor: '#333' }}>
              <h4 className="mono mb-2" style={{ color: '#fff' }}>Cloud Connector</h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <p className="mono text-sm text-gray-400 mb-2">Paste a public URL to an audio file (eg. direct link to .flac/.mp3)</p>
                  <input value={cloudUrlInput} onChange={(e) => setCloudUrlInput(e.target.value)} placeholder="https://..." className="w-full p-2 mb-2 rounded bg-[#1b1b1b] border" style={{ borderColor: '#333', color: '#fff' }} />
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setCloudModalOpen(false)} className="px-3 py-1 rounded bg-transparent border text-gray-400" style={{ borderColor: '#333' }}>Cancel</button>
                    <button onClick={() => addCloudTrackFromUrl(cloudUrlInput)} className="px-3 py-1 rounded bg-cyan-600 text-white">Add Track</button>
                  </div>
                </div>
                <div>
                  <p className="mono text-sm text-gray-400 mb-2">Cloud Services</p>
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={connectGoogleDrive} disabled={!GOOGLE_CLIENT_ID} className={`px-3 py-1 rounded bg-[#1a73e8] text-white ${!GOOGLE_CLIENT_ID ? 'opacity-50 cursor-not-allowed' : ''}`} title={!GOOGLE_CLIENT_ID ? 'VITE_GOOGLE_CLIENT_ID not set. Add to .env.local' : 'Connect Google Drive'}>Connect Google Drive</button>
                    <button onClick={listDriveFiles} className="px-3 py-1 rounded bg-[#0f1720] text-white border" style={{ borderColor: '#333' }}>List Files</button>
                    <button onClick={importSelectedDriveFiles} className="px-3 py-1 rounded bg-[#00bcd4] text-white">Import Selected</button>
                    <button onClick={disconnectGoogleDrive} className="px-3 py-1 rounded bg-transparent border text-gray-400" style={{ borderColor: '#333' }}>Disconnect</button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={connectOneDrive} disabled={!ONEDRIVE_CLIENT_ID} className={`px-3 py-1 rounded bg-[#4f8ef7] text-white ${!ONEDRIVE_CLIENT_ID ? 'opacity-50 cursor-not-allowed' : ''}`} title={!ONEDRIVE_CLIENT_ID ? 'VITE_ONEDRIVE_CLIENT_ID not set. Add to .env.local' : 'Connect OneDrive'}>Connect OneDrive</button>
                    <button onClick={listOneDriveFiles} className="px-3 py-1 rounded bg-[#0f1720] text-white border" style={{ borderColor: '#333' }}>List Files</button>
                    <button onClick={importSelectedOneDriveFiles} className="px-3 py-1 rounded bg-[#0063B1] text-white">Import Selected</button>
                    <button onClick={disconnectOneDrive} className="px-3 py-1 rounded bg-transparent border text-gray-400" style={{ borderColor: '#333' }}>Disconnect</button>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 max-h-64 overflow-auto">
                {driveFiles.length > 0 && (
                  <div>
                    <h5 className="mono" style={{ color: '#d0d0d0', marginBottom: '6px' }}>Google Drive Files</h5>
                    {driveFiles.map((f: any) => (
                      <label key={f.id} className="flex items-center gap-2 mono mb-2">
                        <input type="checkbox" checked={!!selectedDriveFiles[f.id]} onChange={(e) => setSelectedDriveFiles(prev => ({ ...prev, [f.id]: e.target.checked }))} />
                        <span className="truncate" style={{ color: f.mimeType === 'application/vnd.google-apps.folder' ? '#a0a0a0' : '#e0e0e0' }}>
                          {f.mimeType === 'application/vnd.google-apps.folder' ? '📁 ' : '🎵 '}{f.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {oneDriveFiles.length > 0 && (
                  <div>
                    <h5 className="mono" style={{ color: '#d0d0d0', marginBottom: '6px' }}>OneDrive Files</h5>
                    {oneDriveFiles.map((f: any) => (
                      <label key={f.id} className="flex items-center gap-2 mono mb-2">
                        <input type="checkbox" checked={!!selectedOneDriveFiles[f.id]} onChange={(e) => setSelectedOneDriveFiles(prev => ({ ...prev, [f.id]: e.target.checked }))} />
                        <span className="truncate" style={{ color: f.folder ? '#a0a0a0' : '#e0e0e0' }}>
                          {f.folder ? '📁 ' : '🎵 '}{f.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
          ) : localTracks.length === 0 && cloudTracks.length === 0 ? (
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
              <p className="mono mb-2" style={{ color: '#b0b0b0', fontSize: '0.85rem' }}>
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
                      style={{ backgroundColor: '#252525', border: '1px solid #333333', color: '#f0f0f0', fontSize: '0.75rem' }}
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
                    const tracks: Track[] = [...localTracks, ...cloudTracks];
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
                      onClick={async () => {
                        await handlePlayClick(track);
                      }}
                      style={{
                          gap: '0.35rem 1rem',
                          gridTemplateColumns: 'minmax(0,2fr) minmax(0,1.1fr) minmax(0,1fr) minmax(64px,84px)',
                          fontFamily: 'Syne',
                          alignItems: 'center',
                          alignContent: 'center',
                        }}
                      >
                        <h4
                          className="mono truncate flex items-center gap-2"
                          style={{ color: '#f5f5f5', fontSize: '0.95rem', fontWeight: 400, letterSpacing: '0.01em', fontFamily: 'Syne' }}
                          title={track.name}
                        >
                          {track.coverArt ? (
                            <img
                              src={track.coverArt}
                              alt="Album cover"
                              className="w-8 h-8 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div
                              className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: '#333333' }}
                            >
                              <Music size={12} color="#666666" />
                            </div>
                          )}
                          {track.type === 'cloud' && <Cloud size={12} color="#00bcd4" />}
                          {track.name || 'Untitled'}
                        </h4>
                        <span
                          className="mono truncate"
                          style={{ color: '#d0d0d0', fontSize: '0.82rem', fontWeight: 400, fontFamily: 'Syne' }}
                          title={track.artist}
                        >
                          {track.artist || 'Unknown Artist'}
                        </span>
                        <span
                          className="mono truncate hidden sm:block"
                          style={{ color: '#a3a3a3', fontSize: '0.8rem', fontWeight: 400, fontFamily: 'Syne' }}
                          title={track.album}
                        >
                          {track.album || 'Unknown Album'}
                        </span>
                        <div className="flex items-center justify-end" style={{ alignSelf: 'center' }}>
                          <span
                            className="mono px-2 py-1 rounded"
                            style={{
                              border: '1px solid #d32f2f',
                              color: '#d32f2f',
                              backgroundColor: 'rgba(211, 47, 47, 0.08)',
                              fontSize: '0.7rem',
                              letterSpacing: '0.02em',
                            }}
                          >
                            {track.type === 'local' ? getTechBadge(track) : 'CLOUD'}
                          </span>
                        </div>
                        <div className="col-span-4 flex items-center gap-3" style={{ marginTop: 0 }}>
                          <span className="mono" style={{ color: '#7c7c7c', fontSize: '0.72rem' }}>
                            {formatDuration(track.duration ?? 0)}
                          </span>
                          {track.size ? (
                            <span className="mono" style={{ color: '#666666', fontSize: '0.72rem' }}>
                              • {formatFileSize(track.size)}
                            </span>
                          ) : null}
                        </div>

                      {/* Play Button */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handlePlayClick(track);
                        }}
                        aria-label={`Play ${track.name || 'track'} by ${track.artist || 'unknown artist'}`}
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
                      <span className="mono" style={{ color: '#b0b0b0', fontSize: '0.7rem' }}>Per page:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(parseInt(e.target.value, 10) || 25)}
                        className="mono px-2 py-1 rounded-lg"
                        style={{ backgroundColor: '#252525', border: '1px solid #333333', color: '#f0f0f0', fontSize: '0.75rem' }}
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
                        style={{ backgroundColor: '#252525', border: '1px solid #333333', color: '#f0f0f0', fontSize: '0.75rem' }}
                      >
                        Prev
                      </button>
                      <span className="mono" style={{ color: '#b0b0b0', fontSize: '0.75rem' }}>{page}</span>
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3 py-1 rounded-lg"
                        style={{ backgroundColor: '#252525', border: '1px solid #333333', color: '#f0f0f0', fontSize: '0.75rem' }}
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
                    const discGroups: Record<number, { disc: number; items: { track: Track; index: number }[] }> = {};
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
                            className="group grid items-center gap-3 p-3 rounded-lg transition-all duration-200"
                            style={{
                              gridTemplateColumns: '32px 1fr 140px 96px',
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
                            <div className="min-w-0" style={{ gridColumn: '2' }}>
                              <div className="flex items-center gap-2 mb-0" style={{ alignItems: 'center' }}>
                                <h4 className="mono truncate flex items-center gap-2" style={{ color: '#e0e0e0', fontSize: '0.85rem', margin: 0, lineHeight: '1.2' }}>
                                  {track.type === 'cloud' && <Cloud size={12} color="#00bcd4" />}
                                  {track.name}
                                </h4>
                                {/* Codec chip */}
                                {track.codec && (
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
                                    {String(track.codec).toUpperCase()}
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
                                    <span style={{ color: '#d32f2f' }}>{track.sampleRate ? `${track.sampleRate} Hz` : ''}</span>
                                  </span>
                                )}
                              </div>
                              <p className="mono truncate" style={{ color: '#a0a0a0', fontSize: '0.7rem', marginTop: '2px', lineHeight: '1.2' }}>
                                {track.artist} • {formatDuration(track.duration ?? 0)}
                              </p>
                            </div>

                            {/* Play Button */}
                            <button
                              aria-label={`Play ${track.name || 'track'} by ${track.artist || 'unknown artist'}`}
                              onClick={async () => {
                                await handlePlayClick(track);
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
                          aria-label={`Play album ${album.name}`}
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
                        <h4 className="mono truncate" style={{ color: '#e0e0e0', fontSize: '0.85rem', fontFamily: 'Syne', fontWeight: 400 }}>
                          {album.name}
                        </h4>
                        <p className="mono truncate" style={{ color: '#a0a0a0', fontSize: '0.75rem', fontFamily: 'Syne', fontWeight: 400 }}>
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
                    <span className="mono" style={{ color: '#b0b0b0', fontSize: '0.7rem' }}>Per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(parseInt(e.target.value, 10) || 25)}
                      className="mono px-2 py-1 rounded-lg"
                      style={{ backgroundColor: '#252525', border: '1px solid #333333', color: '#f0f0f0', fontSize: '0.75rem' }}
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
                      style={{ backgroundColor: '#252525', border: '1px solid #333333', color: '#f0f0f0', fontSize: '0.75rem' }}
                    >
                      Prev
                    </button>
                    <span className="mono" style={{ color: '#b0b0b0', fontSize: '0.75rem' }}>{page}</span>
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
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }}
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg shadow-lg"
            style={{
              backgroundColor: '#0f0f11',
              border: '1px solid rgba(255, 23, 68, 0.14)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              fontFamily: 'Syne, SFMono-Regular, ui-monospace',
              padding: '16px'
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="purge-vault-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 pb-2">
              <h3 id="purge-vault-title" className="mono" style={{ color: '#ff6b78', fontSize: '0.98rem', fontWeight: 700 }}>
                ⚠️ PURGE VAULT?
              </h3>
              <button
                aria-label="Close purge dialog"
                onClick={() => setIsDeleteModalOpen(false)}
                className="rounded p-1"
                style={{ color: '#d0d0d0', background: 'transparent', border: 'none' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18" stroke="#d0d0d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 6L18 18" stroke="#d0d0d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="px-3 pt-2 pb-3">
              <p className="mono" style={{ color: '#d6d6d6', fontSize: '0.9rem', lineHeight: 1.4 }}>
                This action is irreversible. All local database entries will be wiped. Files on disk will remain untouched.
              </p>
              <div className="mt-3">
                <label className="mono" style={{ color: '#bdbdbd', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>
                  Type <span style={{ color: '#ff1744', fontWeight: 700 }}>DELETE</span> to confirm
                </label>
                <input
                  autoFocus
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg mono"
                  style={{
                    backgroundColor: '#151516',
                    border: '1px solid #2b2b2f',
                    color: '#f3f3f3',
                    fontSize: '0.9rem',
                  }}
                  placeholder="Type DELETE to enable the purge"
                />
              </div>
              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteConfirmation('');
                  }}
                  className="px-3 py-1.5 rounded mono"
                  style={{ backgroundColor: '#19191a', border: '1px solid #2f2f35', color: '#dcdcdc' }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeDeleteAllTracks}
                  disabled={deleteConfirmation.trim().toUpperCase() !== 'DELETE' || isDeletingAll}
                  className="px-3 py-1.5 rounded mono transition-all duration-150"
                  style={{
                    backgroundColor: deleteConfirmation.trim().toUpperCase() === 'DELETE' && !isDeletingAll ? '#ff1744' : 'transparent',
                    border: '1px solid #ff1744',
                    color: deleteConfirmation.trim().toUpperCase() === 'DELETE' && !isDeletingAll ? '#ffffff' : '#ff1744',
                    opacity: deleteConfirmation.trim().toUpperCase() === 'DELETE' && !isDeletingAll ? 1 : 0.7,
                    cursor: deleteConfirmation.trim().toUpperCase() === 'DELETE' && !isDeletingAll ? 'pointer' : 'not-allowed',
                    minWidth: '96px'
                  }}
                >
                  {isDeletingAll ? 'Purging…' : 'Purge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
};