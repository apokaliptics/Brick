import { Upload, Music, Trash2, Play, Pause } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface LocalTrack {
  id: string;
  name: string;
  file: File;
  url: string;
  duration: number;
  format: string;
  size: number;
}

interface LocalMusicUploaderProps {
  onPlayTrack: (track: LocalTrack) => void;
  currentPlayingId?: string;
  isPlaying?: boolean;
}

export function LocalMusicUploader({ onPlayTrack, currentPlayingId, isPlaying }: LocalMusicUploaderProps) {
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load tracks from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('brick_local_tracks');
    if (stored) {
      try {
        const parsedTracks = JSON.parse(stored);
        // Recreate blob URLs from stored file data
        const restoredTracks = parsedTracks.map((track: any) => ({
          ...track,
          file: null, // Can't restore File objects
          url: track.url, // Keep the URL reference
        }));
        setLocalTracks(restoredTracks);
      } catch (error) {
        console.error('Error loading local tracks:', error);
      }
    }
  }, []);

  // Save tracks to localStorage whenever they change
  useEffect(() => {
    if (localTracks.length > 0) {
      try {
        const tracksToStore = localTracks.map(track => ({
          id: track.id,
          name: track.name,
          url: track.url,
          duration: track.duration,
          format: track.format,
          size: track.size,
        }));
        localStorage.setItem('brick_local_tracks', JSON.stringify(tracksToStore));
      } catch (error) {
        console.error('Error saving local tracks:', error);
      }
    }
  }, [localTracks]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newTracks: LocalTrack[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = URL.createObjectURL(file);
      const format = file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN';

      // Create audio element to get duration
      const audio = new Audio(url);
      await new Promise((resolve) => {
        audio.addEventListener('loadedmetadata', () => {
          newTracks.push({
            id: `local-${Date.now()}-${i}`,
            name: file.name.replace(/\.(flac|wav|mp3)$/i, ''),
            file,
            url,
            duration: audio.duration,
            format,
            size: file.size,
          });
          resolve(null);
        });
      });
    }

    setLocalTracks([...localTracks, ...newTracks]);
    setIsExpanded(true);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteTrack = (trackId: string) => {
    const track = localTracks.find(t => t.id === trackId);
    if (track) {
      URL.revokeObjectURL(track.url);
    }
    setLocalTracks(localTracks.filter(t => t.id !== trackId));
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
          {localTracks.length === 0 ? (
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

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="mono truncate" style={{ color: '#e0e0e0', fontSize: '0.85rem' }}>
                      {track.name}
                    </h4>
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
                      <span className="mono" style={{ color: '#666666', fontSize: '0.7rem' }}>
                        {formatFileSize(track.size)}
                      </span>
                    </div>
                  </div>

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