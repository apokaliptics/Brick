import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Repeat, Shuffle, ChevronDown, ChevronUp } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { addRecentlyPlayedTrack } from '../utils/recentlyPlayed';
import type { Track } from '../types';

interface MusicPlayerProps {
  currentTrack: Track | null;
  playlist: Track[];
  onTrackChange?: (track: Track) => void;
  onPlayPause?: (isPlaying: boolean) => void;
  isVisible?: boolean;
  onControlsReady?: (controls: any) => void;
  sidebarCollapsed?: boolean;
  externalIsPlaying?: boolean;
}

export function MusicPlayer({ currentTrack, playlist, onTrackChange, onPlayPause, isVisible = true, onControlsReady, sidebarCollapsed = false, externalIsPlaying }: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const nextAudioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // Preload next track for gapless playback
  useEffect(() => {
    if (!playlist || playlist.length === 0 || !currentTrack) return;

    const currentIndex = playlist.findIndex(t => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % playlist.length;
    const nextTrack = playlist[nextIndex];

    if (nextAudioRef.current && nextTrack && nextTrack.audioUrl) {
      // Preload next track
      nextAudioRef.current.src = nextTrack.audioUrl;
      nextAudioRef.current.preload = 'auto';
      nextAudioRef.current.load();
    }
  }, [currentTrack, playlist]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    // Pause first to prevent interruption errors
    audio.pause();
    
    // Load new track
    if (!currentTrack.audioUrl) {
      console.warn('No audioUrl for current track');
      return;
    }

    audio.src = currentTrack.audioUrl;
    audio.load();

    // Track recently played
    addRecentlyPlayedTrack({
      trackId: currentTrack.id,
      trackTitle: currentTrack.title || currentTrack.name || 'Untitled',
      artistName: currentTrack.artist,
      coverArt: currentTrack.coverImage || currentTrack.coverArt || '',
      audioUrl: currentTrack.audioUrl,
      playedAt: Date.now(),
    }).catch(err => console.error('Failed to track recently played:', err));

    // Add error handler
    const handleError = (e: Event) => {
      console.error('Audio loading error:', e);
      console.error('Failed to load:', currentTrack.audioUrl);
      setIsPlaying(false);
      onPlayPause?.(false);
    };
    
    audio.addEventListener('error', handleError);

    // Auto play if was playing
    if (isPlaying) {
      // Wait for metadata to load before playing
      const handleCanPlay = () => {
        audio.play().catch(err => {
          console.error('Playback error:', err);
          setIsPlaying(false);
          onPlayPause?.(false);
        });
        audio.removeEventListener('canplay', handleCanPlay);
      };
      audio.addEventListener('canplay', handleCanPlay);
    }
    
    return () => {
      audio.removeEventListener('error', handleError);
    };
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      if (isRepeat) {
        audio.currentTime = 0;
        audio.play();
      } else {
        // Seamless gapless playback - auto-advance to next track with no gap
        handleNext();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    // Support gapless playback by monitoring current time near the end
    const handleNearEnd = () => {
      // When near the end (last 100ms), start loading next track audio
      if (audio.duration && audio.currentTime > audio.duration - 0.1) {
        const currentIndex = playlist.findIndex(t => t.id === currentTrack?.id);
        if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % playlist.length;
          const nextTrack = playlist[nextIndex];
          if (nextTrack && nextAudioRef.current && nextTrack.audioUrl) {
            nextAudioRef.current.src = nextTrack.audioUrl;
            nextAudioRef.current.load();
          }
        }
      }
    };

    audio.addEventListener('timeupdate', handleNearEnd);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleNearEnd);
    };
  }, [isRepeat, currentTrack, playlist]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const newIsPlaying = !isPlaying;

    if (newIsPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.error('Playback error:', err);
          setIsPlaying(false);
          onPlayPause?.(false);
          return;
        });
      }
    } else {
      audio.pause();
    }

    setIsPlaying(newIsPlaying);
    onPlayPause?.(newIsPlaying);
  };

  const handleNext = () => {
    if (!currentTrack || playlist.length === 0) return;
    
    console.log('Skipping to next track');
    const currentIndex = playlist.findIndex(t => t.id === currentTrack.id);
    let nextIndex;
    
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * playlist.length);
    } else {
      nextIndex = (currentIndex + 1) % playlist.length;
    }
    
    console.log(`Current index: ${currentIndex}, Next index: ${nextIndex}`);
    onTrackChange?.(playlist[nextIndex]);
  };

  const handlePrevious = () => {
    if (!currentTrack || playlist.length === 0) return;
    
    console.log('Skipping to previous track');
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      console.log('Restarting current track (>3s)');
      audio.currentTime = 0;
      return;
    }
    
    const currentIndex = playlist.findIndex(t => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    
    console.log(`Current index: ${currentIndex}, Previous index: ${prevIndex}`);
    onTrackChange?.(playlist[prevIndex]);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newVolume = parseFloat(e.target.value);
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isMuted) {
      audio.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Expose controls to parent
  useEffect(() => {
    if (onControlsReady) {
      onControlsReady({
        audioRef,
        isPlaying: externalIsPlaying !== undefined ? externalIsPlaying : isPlaying,
        togglePlayPause,
        handleNext,
        handlePrevious,
        currentTime,
        duration,
        formatTime,
      });
    }
  }, [isPlaying, currentTime, duration, onControlsReady, externalIsPlaying]);

  // Don't render UI if not visible, but keep audio element alive
  if (!currentTrack) {
    return null;
  }

  return (
    <>
      {/* Always render audio elements */}
      <audio ref={audioRef} />
      {/* Hidden audio element for preloading next track (gapless playback) */}
      <audio ref={nextAudioRef} />
      
      {/* Only show UI when visible and not fully collapsed */}
      {isVisible && !isCollapsed && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl transition-all duration-300"
          style={{
            backgroundColor: 'rgba(26, 26, 26, 0.95)',
            borderTop: '1px solid #333333',
          }}
        >
          {/* Collapse Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="fixed bottom-24 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
            style={{
              backgroundColor: 'rgba(26, 26, 26, 0.8)',
              border: '1px solid #333333',
              backdropFilter: 'blur(10px)',
            }}
          >
            <ChevronDown size={14} color="#a0a0a0" />
          </button>

          {/* Expanded View - Full Player */}
          <div className="max-w-screen-2xl mx-auto px-4 py-3">
            <div className="flex items-center gap-4">
              {/* Track Info */}
              <div className="flex items-center gap-3 max-w-xs min-w-0">
                <ImageWithFallback
                  src={currentTrack.coverImage || currentTrack.coverArt}
                  alt={currentTrack.title || currentTrack.name || 'Track'}
                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="truncate mono" style={{ color: '#e0e0e0', fontSize: '0.9rem' }}>
                    {currentTrack.title || currentTrack.name || 'Untitled'}
                  </h4>
                  <p className="truncate mono" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                    {currentTrack.artist}
                  </p>
                </div>
              </div>

              {/* Center Controls */}
              <div className="flex flex-col items-center gap-2 flex-1">
                {/* Control Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsShuffle(!isShuffle)}
                    className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                    style={{
                      color: isShuffle ? '#d32f2f' : '#a0a0a0',
                    }}
                  >
                    <Shuffle size={16} />
                  </button>

                  <button
                    onClick={handlePrevious}
                    className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                    style={{ color: '#e0e0e0' }}
                  >
                    <SkipBack size={20} fill="#e0e0e0" />
                  </button>

                  <button
                    onClick={togglePlayPause}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                    style={{
                      backgroundColor: '#d32f2f',
                    }}
                  >
                    {isPlaying ? (
                      <Pause size={20} fill="#ffffff" color="#ffffff" />
                    ) : (
                      <Play size={20} fill="#ffffff" color="#ffffff" />
                    )}
                  </button>

                  <button
                    onClick={handleNext}
                    className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                    style={{ color: '#e0e0e0' }}
                  >
                    <SkipForward size={20} fill="#e0e0e0" />
                  </button>

                  <button
                    onClick={() => setIsRepeat(!isRepeat)}
                    className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                    style={{
                      color: isRepeat ? '#d32f2f' : '#a0a0a0',
                    }}
                  >
                    <Repeat size={16} />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="flex items-center gap-2 w-full max-w-xl">
                  <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem', minWidth: '40px' }}>
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1"
                    style={{
                      height: '4px',
                      borderRadius: '2px',
                      background: `linear-gradient(to right, #d32f2f ${(currentTime / duration) * 100}%, #333333 ${(currentTime / duration) * 100}%)`,
                      appearance: 'none',
                      cursor: 'pointer',
                    }}
                  />
                  <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem', minWidth: '40px' }}>
                    {formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* Volume Control */}
              <div className="flex items-center gap-2 flex-1 justify-end">
                <button onClick={toggleMute} className="p-2 rounded-lg transition-all duration-200 hover:scale-110">
                  {isMuted ? (
                    <VolumeX size={18} color="#a0a0a0" />
                  ) : (
                    <Volume2 size={18} color="#a0a0a0" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-24"
                  style={{
                    height: '4px',
                    borderRadius: '2px',
                    background: `linear-gradient(to right, #d32f2f ${(isMuted ? 0 : volume) * 100}%, #333333 ${(isMuted ? 0 : volume) * 100}%)`,
                    appearance: 'none',
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>
          </div>

          <style>{`
            input[type="range"]::-webkit-slider-thumb {
              appearance: none;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: #d32f2f;
              cursor: pointer;
            }
            input[type="range"]::-moz-range-thumb {
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: #d32f2f;
              cursor: pointer;
              border: none;
            }
          `}</style>
        </div>
      )}

      {/* Show expand button when fully collapsed */}
      {isVisible && isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="fixed bottom-24 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
          style={{
            backgroundColor: 'rgba(26, 26, 26, 0.8)',
            border: '1px solid #333333',
            backdropFilter: 'blur(10px)',
          }}
        >
          <ChevronUp size={14} color="#a0a0a0" />
        </button>
      )}
    </>
  );
}