import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Play, HardDrive, Music, X, GripVertical, Upload, Image as ImageIcon, Search } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { openBrickDB } from '../../utils/db';
import type { Track } from '../../types';

interface PlaylistCreationScreenProps {
  onClose: () => void;
  onPublish: (name: string, tracks: Track[]) => void;
  inline?: boolean;
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
  bitDepth?: number;
  sampleRate?: number;
  bitrateKbps?: number;
  codecLabel?: string;
}

export function PlaylistCreationScreen({ onClose, onPublish, inline = false }: PlaylistCreationScreenProps) {
  const [playlistName, setPlaylistName] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [structuralIntegrity, setStructuralIntegrity] = useState(0);
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [viewMode, setViewMode] = useState<'platform' | 'local'>('platform');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [customCoverImage, setCustomCoverImage] = useState<string | null>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  // Load local tracks from IndexedDB on mount
  useEffect(() => {
    loadLocalTracksFromDB();
  }, []);

  const loadLocalTracksFromDB = async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction(['localTracks'], 'readonly');
      const store = transaction.objectStore('localTracks');
      const allTracks = await new Promise<any[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // The tracks are stored as complete objects with File objects
      // We need to recreate blob URLs for the UI
      const tracksWithUrls: LocalTrack[] = allTracks.map(track => {
        try {
          // Create new blob URL from the File object
          const url = URL.createObjectURL(track.file);

          return {
            ...track,
            url, // Add the blob URL for the UI
          };
        } catch (error) {
          console.error('Failed to create URL for track:', track.id, error);
          return null;
        }
      }).filter(Boolean) as LocalTrack[];

      setLocalTracks(tracksWithUrls);
      setIsLoadingLocal(false);
    } catch (error) {
      console.error('Failed to load local tracks:', error);
      setIsLoadingLocal(false);
    }
  };

  const openDB = (): Promise<IDBDatabase> => openBrickDB();

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
      audioUrl: localTrack.audioUrl ?? localTrack.url,
      isPatronage: false,
      genre: localTrack.genre, // Pass through genre from local track
      bitDepth: localTrack.bitDepth,
      sampleRate: localTrack.sampleRate,
      bitrateKbps: localTrack.bitrateKbps,
      codecLabel: localTrack.codecLabel,
      file: localTrack.file,
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

  const reorderTracks = (draggedId: string, targetId: string) => {
    const draggedIndex = tracks.findIndex(t => t.id === draggedId);
    const targetIndex = tracks.findIndex(t => t.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;
    
    const newTracks = [...tracks];
    const draggedTrack = newTracks[draggedIndex];
    newTracks.splice(draggedIndex, 1);
    newTracks.splice(targetIndex, 0, draggedTrack);
    
    setTracks(newTracks);
  };

  const handleDragStart = (trackId: string) => {
    setDraggedTrackId(trackId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (targetTrackId: string) => {
    if (draggedTrackId && draggedTrackId !== targetTrackId) {
      reorderTracks(draggedTrackId, targetTrackId);
    }
    setDraggedTrackId(null);
  };

  const handleDragEnd = () => {
    setDraggedTrackId(null);
  };

  const handleCoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result as string;
        setCustomCoverImage(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const openCoverImagePicker = () => {
    coverImageInputRef.current?.click();
  };

  const canPublish = playlistName.length > 0 && tracks.length > 0 && structuralIntegrity >= 50;

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;
  const matchesQuery = (value?: string | null) => {
    if (!hasSearch || !value) return false;
    return value.toLowerCase().includes(normalizedSearch);
  };

  const filteredPlatformTracks = hasSearch
    ? availableTracks.filter((track) =>
        matchesQuery(track.title) ||
        matchesQuery(track.name) ||
        matchesQuery(track.artist) ||
        matchesQuery(track.album) ||
        matchesQuery(track.genre),
      )
    : availableTracks;

  const filteredLocalTracks = hasSearch
    ? localTracks.filter((track) =>
        matchesQuery(track.name) ||
        matchesQuery(track.artist) ||
        matchesQuery(track.album) ||
        matchesQuery(track.genre) ||
        matchesQuery(track.format),
      )
    : localTracks;

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

  // Escape key handler for overlay mode
  useEffect(() => {
    if (inline) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inline, onClose]);

  // Focus the name input when overlay opens
  useEffect(() => {
    if (inline) return;
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [inline]);

  // Main content JSX (reused for inline and overlay)
  const content = (
    <motion.div
      id="playlist-creation-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="playlist-creation-title"
      className="relative z-10 w-full max-w-4xl mx-auto overflow-hidden rounded-2xl shadow-2xl p-0 flex flex-col"
      style={{ backgroundColor: 'rgba(20,20,20,0.85)', backdropFilter: 'blur(6px)', border: '1px solid rgba(211,47,47,0.8)', maxHeight: '80vh' }}
      initial={{ opacity: 0, y: -8, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.995 }}
      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.4, 1] }}
    >
        <div className="flex items-center justify-between mb-3 px-4 py-3">
          <div>
            <h3 id="playlist-creation-title" className="text-2xl font-semibold" style={{ color: '#e0e0e0' }}>Drawing New Blueprints</h3>
            <p className="text-xs mono mt-1" style={{ color: '#a0a0a0' }}>Use the search to find tracks and drag them into the batch to build your Brick.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-lg bg-transparent" role="tablist" aria-label="View mode">
              <button
                type="button"
                onClick={() => setViewMode('platform')}
                aria-pressed={viewMode === 'platform'}
                className={`px-3 py-2 rounded-lg transition ${viewMode === 'platform' ? 'bg-white/6 border border-white/10' : 'bg-transparent border border-transparent'}`}
                style={{ borderColor: viewMode === 'platform' ? '#3a3a3a' : 'transparent' }}
                title="Platform tracks"
              >
                <div className="flex items-center gap-2">
                  <Music size={14} color={viewMode === 'platform' ? '#d32f2f' : '#a0a0a0'} />
                  <span className="mono text-xs" style={{ color: viewMode === 'platform' ? '#e0e0e0' : '#a0a0a0' }}>Platform</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('local')}
                aria-pressed={viewMode === 'local'}
                className={`px-3 py-2 rounded-lg transition ${viewMode === 'local' ? 'bg-white/6 border border-white/10' : 'bg-transparent border border-transparent'}`}
                style={{ borderColor: viewMode === 'local' ? '#3a3a3a' : 'transparent' }}
                title="Local tracks"
              >
                <div className="flex items-center gap-2">
                  <HardDrive size={14} color={viewMode === 'local' ? '#d32f2f' : '#a0a0a0'} />
                  <span className="mono text-xs" style={{ color: viewMode === 'local' ? '#e0e0e0' : '#a0a0a0' }}>Local</span>
                </div>
              </button>
            </div>
            <input
              aria-label="Search tracks"
              className="rounded-lg px-3 py-2 mono" 
              placeholder="Search by title, artist, or album..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ backgroundColor: '#212121', color: '#e0e0e0', border: '1px solid #2e2e2e', minWidth: '220px' }}
            />
            <button onClick={onClose} aria-label="Close" className="p-2 rounded hover:bg-white/5 transition" title="Close">
              <X size={20} color="#a0a0a0" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-4">
            <label className="mono mb-2 block" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>BRICK NAME</label>
            <input ref={nameInputRef} type="text" value={playlistName} onChange={(e)=>setPlaylistName(e.target.value)} placeholder="Enter playlist name..." className="w-full px-3 py-2 rounded-lg outline-none mono" style={{ backgroundColor: '#232323', border: '1px solid #333333', color: '#e0e0e0' }} />

            <div className="mt-4">
              <h4 className="mb-2">The Batch <span className="mono text-xs" style={{ color: '#a0a0a0' }}>({tracks.length})</span></h4>
              {tracks.length === 0 ? (
                <div className="p-4 rounded-lg text-center min-h-[220px] flex items-center justify-center" style={{ backgroundColor: '#222228', border: '1px dashed #2d2d2d' }}>
                  <p style={{ color: '#a0a0a0' }}>No tracks added yet</p>
                </div>
              ) : (
                <div className="rounded-lg overflow-hidden min-h-[220px]" style={{ backgroundColor: '#222228', border: '1px solid #2d2d2d' }}>{/* simplified batch UI in embedded mode */}
                  {tracks.map((t, idx)=> {
                    const displayDur = typeof t.duration === 'string' && t.duration.includes(':') ? t.duration : formatDuration(Number(t.duration) || 0);
                    return (
                      <div key={t.id} className={`flex items-center gap-3 p-3 ${idx < tracks.length-1 ? 'border-b' : ''} min-h-[64px] cursor-grab ${draggedTrackId === t.id ? 'opacity-50' : ''}`} style={{ color: '#e0e0e0', borderColor: '#2d2d2d' }} draggable onDragStart={() => handleDragStart(t.id)} onDragOver={handleDragOver} onDrop={() => handleDrop(t.id)} onDragEnd={handleDragEnd} aria-grabbed={draggedTrackId === t.id}>
                        <div className="w-8 text-center mono" style={{ color: '#a0a0a0' }}>{idx + 1}</div>
                        <input type="number" min={1} max={tracks.length} value={idx + 1} onChange={(e)=>{ const newIndex = Math.max(1, Math.min(tracks.length, Number(e.target.value || idx + 1))); if(newIndex -1 !== idx) reorderTracks(t.id, tracks[newIndex -1]?.id || t.id); }} className="w-12 text-center rounded bg-transparent border border-transparent text-xs mono" />
                          <GripVertical size={16} color="#a0a0a0" className="cursor-grab" />
                          <ImageWithFallback src={t.coverArt || t.audioUrl || ''} alt={t.album} className="w-12 h-12 rounded object-cover" />
                        <div className={`flex-1 min-w-0 text-left ${draggedTrackId === t.id ? 'opacity-50' : ''}`} aria-grabbed={draggedTrackId === t.id}>
                          <div className="truncate font-semibold">{t.title || t.name}</div>
                          <div className="mono text-xs text-[#9a9a9a]">{t.artist} • {typeof t.duration === 'string' && t.duration.includes(':') ? t.duration : formatDuration(Number(t.duration) || 0)}</div>
                        </div>
                      <button onClick={() => removeTrack(t.id)} className="p-1 hover:bg-white/5 rounded transition" aria-label={`Remove ${t.title || t.name}`}>
                        <X size={16} color="#a0a0a0" />
                      </button>
                      </div>
                    );
                  })}</div>
              )}
            </div>
          </div>

          <div className="md:col-span-8">
            <div className="mb-2">
              <h4 className="mb-2">Results</h4>
            </div>
            <div className="space-y-2 min-h-[220px]">
              {(viewMode === 'platform' ? filteredPlatformTracks : filteredLocalTracks).slice(0, pageSize).map(track => (
                <button
                  key={track.id}
                  onClick={()=>addTrack(track)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg transition hover:bg-white/5 min-h-[64px]"
                  style={{ backgroundColor: '#212121', border: '1px solid #2a2a2a' }}
                >
                  <ImageWithFallback src={track.coverArt} alt={track.album} className="w-12 h-12 rounded object-cover" />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="truncate font-semibold" style={{ color: '#e0e0e0' }}>{track.title || (track as any).name}</p>
                      <p className="mono truncate text-xs" style={{ color: '#a0a0a0' }}>{track.artist}</p>
                    </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        </div>
        <div className="px-4 py-3">
          <div className="mt-0">
            <button onClick={() => { if (canPublish) onPublish(playlistName, tracks); }} className="w-full py-3 rounded-full" style={{ background: canPublish ? 'linear-gradient(to bottom, #d32f2f, #b71c1c)' : 'linear-gradient(to bottom, #333333, #2a2a2a)', color: canPublish ? '#e0e0e0' : '#9a9a9a' }} disabled={!canPublish}>Fire Brick (Publish)</button>
          </div>
        </div>
      </motion.div>
  );

  if (inline) {
    return content;
  }

  // Overlay modal version, keep the same width and layout as inline
  return (
    <div className="absolute inset-0 z-[105] flex items-center justify-center p-4">
      {/* Subtle animated backdrop */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="absolute inset-0 bg-black/10" onClick={onClose} />
      <div onClick={(e) => e.stopPropagation()} className="relative z-20 w-full flex justify-center">
        <div className="w-full max-w-4xl">
          {content}
        </div>
      </div>
    </div>
  );
}
