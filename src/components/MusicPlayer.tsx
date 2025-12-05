import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Repeat, Shuffle, ChevronDown, ChevronUp } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { formatBitrate } from '../utils/audioMetaHelpers';
import { addRecentlyPlayedTrack } from '../utils/recentlyPlayed';
import { GaplessAudioEngine } from '../utils/gaplessAudio';
import type { Track } from '../types';
import { useTrackAudioMeta } from '../hooks/useTrackAudioMeta';
import { useTheWallTracker } from '../hooks/useTheWallTracker';

const FALLBACK_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

interface MusicPlayerProps {
  currentTrack: Track | null;
  playlist: Track[];
  onTrackChange?: (track: Track) => void;
  onPlayPause?: (isPlaying: boolean) => void;
  isVisible?: boolean;
  onControlsReady?: (controls: any) => void;
  sidebarCollapsed?: boolean;
  externalIsPlaying?: boolean;
  onExpandPlayer?: () => void;
  onCreatePlaylist?: () => void;
}

export function MusicPlayer({ currentTrack, playlist, onTrackChange, onPlayPause, isVisible = true, onControlsReady, sidebarCollapsed = false, externalIsPlaying, onExpandPlayer, onCreatePlaylist }: MusicPlayerProps) {
  const audioMeta = useTrackAudioMeta(currentTrack ?? null);
  const gaplessEngineRef = useRef<GaplessAudioEngine | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const [usingHtmlAudio, setUsingHtmlAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isRepeatOne, setIsRepeatOne] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showEQ, setShowEQ] = useState(false);
  const [showAdvancedEQ, setShowAdvancedEQ] = useState(false);
  const [eqBands, setEqBands] = useState({
    bass: 0,
    mid: 0,
    treble: 0
  });
  const [advancedEQ, setAdvancedEQ] = useState({
    bassFreq: 200,
    midFreq: 1000,
    midQ: 1,
    trebleFreq: 3200,
  });
  // Shared style for EQ gain value pills
  const eqValueStyle: CSSProperties = {
    display: 'inline-block',
    color: '#a0a0a0',
    fontSize: '0.55rem',
    padding: '1px 2px',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid #2d2d2d',
    borderRadius: '4px',
    lineHeight: '1',
    whiteSpace: 'nowrap',
  };
  const playlistRef = useRef<Track[]>(playlist);
  const onTrackChangeRef = useRef<typeof onTrackChange>(onTrackChange);
  const onPlayPauseRef = useRef<typeof onPlayPause>(onPlayPause);
  const repeatStateRef = useRef({ repeatAll: false, repeatOne: false });
  const shuffleRef = useRef(false);
  const engineDrivenTrackRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const desiredPlayStateRef = useRef(externalIsPlaying ?? true);
  const isLoadingTrackRef = useRef(false);
  const lastSkipAtRef = useRef(0);
  const pendingSkipRef = useRef<null | 'next' | 'prev'>(null);
  const handleNextRef = useRef<(reason?: 'auto' | 'manual') => void>(() => {});
  const currentTrackRef = useRef<Track | null>(currentTrack);
  const volumeRef = useRef(volume);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const wallTracker = useTheWallTracker({
    currentTrack,
    currentTime,
    isPlaying,
  });

  const wallCompletionRef = useRef(wallTracker.registerNaturalCompletion);
  const wallInvalidateRef = useRef(wallTracker.invalidateSession);

  useEffect(() => {
    wallCompletionRef.current = wallTracker.registerNaturalCompletion;
  }, [wallTracker.registerNaturalCompletion]);

  useEffect(() => {
    wallInvalidateRef.current = wallTracker.invalidateSession;
  }, [wallTracker.invalidateSession]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    onTrackChangeRef.current = onTrackChange;
  }, [onTrackChange]);

  useEffect(() => {
    onPlayPauseRef.current = onPlayPause;
  }, [onPlayPause]);

  useEffect(() => {
    repeatStateRef.current = { repeatAll: isRepeat, repeatOne: isRepeatOne };
  }, [isRepeat, isRepeatOne]);

  useEffect(() => {
    shuffleRef.current = isShuffle;
  }, [isShuffle]);

  useEffect(() => {
    if (externalIsPlaying !== undefined) {
      desiredPlayStateRef.current = externalIsPlaying;
    }
  }, [externalIsPlaying]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  const getPlayableUrl = useCallback((track: Track): string => {
    if (track?.audioUrl && typeof track.audioUrl === 'string' && track.audioUrl.trim().length > 0) {
      return track.audioUrl;
    }
    return FALLBACK_AUDIO_URL;
  }, []);

  const shouldStreamWithHtml = useCallback((track: Track): boolean => {
    const durationSeconds = typeof track.duration === 'number' ? track.duration : 0;
    const inferredBitrate = track.bitrateKbps ?? (track.quality === 'FLAC' ? 900 : 320);
    const estimatedSizeMb = durationSeconds > 0 ? (inferredBitrate * 1000 / 8 * durationSeconds) / (1024 * 1024) : 0;
    return durationSeconds >= 900 || estimatedSizeMb >= 80;
  }, []);

  const startHtmlAudio = useCallback(async (url: string, track: Track, autoPlay: boolean) => {
    const htmlAudio = htmlAudioRef.current ?? (htmlAudioRef.current = new Audio());
    setUsingHtmlAudio(true);
    htmlAudio.src = url;
    htmlAudio.currentTime = 0;
    htmlAudio.muted = false;
    htmlAudio.volume = volumeRef.current;
    htmlAudio.onended = () => handleNextRef.current?.('auto');
    htmlAudio.ontimeupdate = () => {
      setCurrentTime(htmlAudio.currentTime);
      setDuration(htmlAudio.duration || duration);
    };
    htmlAudio.onloadedmetadata = () => {
      setDuration(htmlAudio.duration || duration);
    };

    logTrackPlayback(track);

    if (autoPlay) {
      try {
        await htmlAudio.play();
        setIsPlaying(true);
        onPlayPauseRef.current?.(true);
      } catch (playErr) {
        console.error('HTML audio play failed:', playErr);
        desiredPlayStateRef.current = false;
        setIsPlaying(false);
        onPlayPauseRef.current?.(false);
      }
    } else {
      htmlAudio.pause();
      setIsPlaying(false);
      onPlayPauseRef.current?.(false);
    }
  }, [duration]);

  const preloadNextForTrack = useCallback((trackId: string) => {
    if (!gaplessEngineRef.current) return;
    if (shuffleRef.current || repeatStateRef.current.repeatOne) return;

    const tracks = playlistRef.current;
    if (!tracks.length) return;

    const currentIndex = tracks.findIndex(t => t.id === trackId);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex + 1;
    if (nextIndex >= tracks.length) {
      if (!repeatStateRef.current.repeatAll) {
        return;
      }
      nextIndex = 0;
    }

    if (nextIndex === currentIndex) return;

    const nextTrack = tracks[nextIndex];
    if (!nextTrack) return;

    const url = getPlayableUrl(nextTrack);
    if (!url) return;

    gaplessEngineRef.current.preloadNextTrack({
      url,
      id: nextTrack.id,
    });
  }, []);

  const logTrackPlayback = (track: Track) => {
    const safeUrl = getPlayableUrl(track);
    addRecentlyPlayedTrack({
      trackId: track.id,
      trackTitle: track.title || track.name || 'Untitled',
      artistName: track.artist,
      coverArt: track.coverImage || track.coverArt || '',
      audioUrl: safeUrl,
      playedAt: Date.now(),
      album: track.album,
      quality: track.quality,
      codecLabel: track.codecLabel,
      bitDepth: track.bitDepth,
      sampleRate: track.sampleRate,
      bitrateKbps: track.bitrateKbps,
      durationSeconds: typeof track.duration === 'number' ? track.duration : undefined,
    }).catch(err => console.error('Failed to track recently played:', err));
  };

  // Initialize gapless audio engine
  useEffect(() => {
    if (!gaplessEngineRef.current) {
      gaplessEngineRef.current = new GaplessAudioEngine();
      
      // Set up callbacks
      gaplessEngineRef.current.setCallbacks({
        onStateChange: (state) => {
          if (state.isPlaying !== undefined) {
            setIsPlaying(state.isPlaying);
            onPlayPauseRef.current?.(state.isPlaying);
          }
          if (state.currentTime !== undefined) {
            setCurrentTime(state.currentTime);
          }
          if (state.duration !== undefined) {
            setDuration(state.duration);
          }
          if (state.volume !== undefined) {
            setVolume(state.volume);
          }
          if (state.isMuted !== undefined) {
            setIsMuted(state.isMuted);
          }
        },
        onTrackEnd: () => {
          wallCompletionRef.current?.(currentTrackRef.current);
          if (repeatStateRef.current.repeatOne) {
            console.log('Looping current track');
            gaplessEngineRef.current?.seek(0);
            gaplessEngineRef.current?.play();
          } else {
            handleNextRef.current?.('auto');
          }
        },
        onTrackChange: (trackId) => {
          console.log('Gapless transition to track:', trackId);
          engineDrivenTrackRef.current = trackId;
          preloadNextForTrack(trackId);
          const updatedTrack = playlistRef.current.find(t => t.id === trackId);
          if (updatedTrack && onTrackChangeRef.current) {
            onTrackChangeRef.current(updatedTrack);
          }
        }
      });
      
      // Set initial volume
      gaplessEngineRef.current.setVolume(1);
    }

    return () => {
      gaplessEngineRef.current?.destroy();
      gaplessEngineRef.current = null;
    };
  }, [preloadNextForTrack]);

  // Update EQ when bands change
  useEffect(() => {
    if (gaplessEngineRef.current) {
      gaplessEngineRef.current.setEQ(eqBands.bass, eqBands.mid, eqBands.treble);
    }
  }, [eqBands]);

  // Preload is now handled inline when track starts playing

  // Load track when it changes
  useEffect(() => {
    const engine = gaplessEngineRef.current;
    if (!currentTrack) return;

    // Reset HTML fallback state on new track
    setUsingHtmlAudio(false);
    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current.src = '';
    }

    if (!engine) return;

    if (engineDrivenTrackRef.current === currentTrack.id) {
      engineDrivenTrackRef.current = null;
      logTrackPlayback(currentTrack);
      return;
    }

    const playUrl = getPlayableUrl(currentTrack);
    const shouldAutoPlay = desiredPlayStateRef.current;

    // Large/long tracks stream directly via HTMLAudio to avoid huge decode stalls
    if (shouldStreamWithHtml(currentTrack)) {
      engine.pause();
      startHtmlAudio(playUrl, currentTrack, shouldAutoPlay);
      return;
    }

    if (engine.usePreloadedTrack(currentTrack.id, shouldAutoPlay)) {
      console.log('Used preloaded buffer for track:', currentTrack.id);
      isLoadingTrackRef.current = false;
      logTrackPlayback(currentTrack);
      preloadNextForTrack(currentTrack.id);
      // Execute any pending skip queued during load
      const pending = pendingSkipRef.current;
      pendingSkipRef.current = null;
      if (pending === 'next') {
        handleNextRef.current?.('auto');
      } else if (pending === 'prev') {
        const tracks = playlistRef.current;
        const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
        const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
        onTrackChangeRef.current?.(tracks[prevIndex]);
      }
      return;
    }

    const requestId = ++loadRequestIdRef.current;
    isLoadingTrackRef.current = true;
    console.log('Loading new track:', currentTrack.title || currentTrack.name, 'requestId:', requestId, 'url:', playUrl);

    // Stop whatever is currently playing so skips don't leave overlapping audio
    engine.pause();

    const tryLoad = async (url: string, allowFallback: boolean) => {
      try {
        logTrackPlayback(currentTrack);
        await engine.loadTrack({ url, id: currentTrack.id });
        if (loadRequestIdRef.current !== requestId) {
          return;
        }
        isLoadingTrackRef.current = false;
        console.log('Track loaded successfully, starting playback');
        engine.seek(0);
        if (desiredPlayStateRef.current) {
          engine.play();
        } else {
          engine.pause();
        }
        preloadNextForTrack(currentTrack.id);
      } catch (err) {
        if (loadRequestIdRef.current !== requestId) {
          return;
        }
        console.error('Failed to load track URL, allowFallback=', allowFallback, 'err=', err);
        if (allowFallback && url !== FALLBACK_AUDIO_URL) {
          console.warn('Retrying with fallback audio URL');
          await tryLoad(FALLBACK_AUDIO_URL, false);
          return;
        }
        // Gapless failed; fall back to HTMLAudioElement so playback still works
        isLoadingTrackRef.current = false;
        const htmlAudio = htmlAudioRef.current ?? (htmlAudioRef.current = new Audio());
        setUsingHtmlAudio(true);
        htmlAudio.src = url;
        htmlAudio.currentTime = 0;
        htmlAudio.muted = false;
        htmlAudio.volume = volume;
        htmlAudio.onended = () => handleNextRef.current?.('auto');
        htmlAudio.ontimeupdate = () => {
          setCurrentTime(htmlAudio.currentTime);
          setDuration(htmlAudio.duration || duration);
        };
        htmlAudio.onloadedmetadata = () => {
          setDuration(htmlAudio.duration || duration);
        };
        if (desiredPlayStateRef.current) {
          htmlAudio.play().then(() => {
            setIsPlaying(true);
            onPlayPauseRef.current?.(true);
          }).catch((playErr) => {
            console.error('HTML audio play failed after gapless fallback:', playErr);
            desiredPlayStateRef.current = false;
            setIsPlaying(false);
            onPlayPauseRef.current?.(false);
          });
        } else {
          setIsPlaying(false);
          onPlayPauseRef.current?.(false);
        }
      }
    };

    tryLoad(playUrl, true);
  }, [currentTrack, getPlayableUrl, preloadNextForTrack]);

  const togglePlayPause = useCallback(() => {
    const engine = gaplessEngineRef.current;
    const htmlAudio = htmlAudioRef.current;

    const nextDesired = !desiredPlayStateRef.current;
    desiredPlayStateRef.current = nextDesired;

    if (usingHtmlAudio && htmlAudio) {
      if (nextDesired) {
        htmlAudio.play().catch(err => console.error('HTML audio play failed:', err));
      } else {
        htmlAudio.pause();
      }
      setIsPlaying(nextDesired);
      onPlayPauseRef.current?.(nextDesired);
      return;
    }

    if (!engine) return;

    if (isLoadingTrackRef.current) {
      return;
    }

    if (nextDesired) {
      engine.play();
    } else {
      engine.pause();
    }
  }, [usingHtmlAudio]);

  const setExternalVolume = useCallback((value: number) => {
    const engine = gaplessEngineRef.current;
    if (!engine) return;
    const clamped = Math.max(0, Math.min(1, value));
    engine.setVolume(clamped);
    engine.setMuted(clamped === 0);
    if (htmlAudioRef.current) {
      htmlAudioRef.current.volume = clamped;
      htmlAudioRef.current.muted = clamped === 0;
    }
  }, []);

  const setExternalEq = useCallback((bands: { bass: number; mid: number; treble: number }) => {
    setEqBands(bands);
  }, [setEqBands]);

  const handleNext = useCallback((reason: 'auto' | 'manual' = 'manual') => {
    const now = Date.now();
    if (reason === 'manual') {
      wallInvalidateRef.current?.('manual-next');
      if (now - lastSkipAtRef.current < 300) {
        return;
      }
      lastSkipAtRef.current = now;
    }

    if (isLoadingTrackRef.current) {
      pendingSkipRef.current = 'next';
      return;
    }

    const engine = gaplessEngineRef.current;
    const tracks = playlistRef.current;
    const currentTrack = currentTrackRef.current;
    if (!currentTrack || !tracks.length) return;

    console.log('Skipping to next track');
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
    let nextIndex: number = currentIndex;

    if (isShuffle) {
      if (tracks.length === 1) {
        console.log('Only one track available, restarting current track');
        engine?.seek(0);
        if (desiredPlayStateRef.current) {
          engine?.play();
        }
        return;
      }
      do {
        nextIndex = Math.floor(Math.random() * tracks.length);
      } while (nextIndex === currentIndex);
    } else {
      nextIndex = currentIndex === -1 ? 0 : currentIndex + 1;

      if (nextIndex >= tracks.length) {
        if (isRepeat) {
          nextIndex = 0;
        } else {
          console.log('End of playlist reached, stopping playback');
          engine?.pause();
          desiredPlayStateRef.current = false;
          setIsPlaying(false);
          onPlayPauseRef.current?.(false);
          return;
        }
      }
    }

    const nextTrack = tracks[nextIndex];
    if (!nextTrack) {
      console.warn('No track found for next index', nextIndex);
      return;
    }

    if (nextTrack.id === currentTrack.id) {
      console.log('Next track resolved to current track, restarting');
      engine?.seek(0);
      if (desiredPlayStateRef.current) {
        engine?.play();
      }
      return;
    }

    engine?.pause();
    console.log(`Current index: ${currentIndex}, Next index: ${nextIndex}`);
    onTrackChangeRef.current?.(nextTrack);
  }, [isShuffle, isRepeat]);

  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  const handlePrevious = useCallback(() => {
    wallInvalidateRef.current?.('manual-prev');
    const now = Date.now();
    if (isLoadingTrackRef.current) {
      pendingSkipRef.current = 'prev';
      return;
    }
    if (now - lastSkipAtRef.current < 300) {
      return;
    }
    lastSkipAtRef.current = now;
    const engine = gaplessEngineRef.current;
    const tracks = playlistRef.current;
    const currentTrack = currentTrackRef.current;
    if (!currentTrack || !tracks.length || !engine) return;
    
    console.log('Skipping to previous track');
    if (currentTime > 3) {
      console.log('Restarting current track (>3s)');
      engine.seek(0);
      return;
    }
    
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
    if (currentIndex === -1) {
      console.warn('Current track not found in playlist');
      return;
    }

    let prevIndex: number;
    if (isShuffle && tracks.length > 1) {
      do {
        prevIndex = Math.floor(Math.random() * tracks.length);
      } while (prevIndex === currentIndex);
    } else {
      prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    }
    
    console.log(`Current index: ${currentIndex}, Previous index: ${prevIndex}`);
    engine.pause();
    onTrackChangeRef.current?.(tracks[prevIndex]);
  }, [isShuffle]);

  const commitSeek = useCallback((targetTime: number) => {
    const hasDuration = Number.isFinite(duration) && duration > 0;
    const clampedTime = hasDuration
      ? Math.max(0, Math.min(targetTime, duration))
      : Math.max(0, targetTime);

    wallInvalidateRef.current?.('seek');

    if (usingHtmlAudio && htmlAudioRef.current) {
      htmlAudioRef.current.currentTime = clampedTime;
      setCurrentTime(clampedTime);
      return;
    }

    if (!gaplessEngineRef.current) return;
    gaplessEngineRef.current.seek(clampedTime);
  }, [duration, usingHtmlAudio]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setScrubTime(newTime);

    // Keyboard-driven changes (no pointer down) should seek immediately
    if (!isScrubbing) {
      commitSeek(newTime);
    }
  };

  const handleSeekStart = () => {
    setIsScrubbing(true);
  };

  const handleSeekEnd = () => {
    if (scrubTime !== null) {
      commitSeek(scrubTime);
    }
    setIsScrubbing(false);
    setScrubTime(null);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (usingHtmlAudio && htmlAudioRef.current) {
      htmlAudioRef.current.volume = newVolume;
      htmlAudioRef.current.muted = newVolume === 0;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
      return;
    }

    if (!gaplessEngineRef.current) return;
    gaplessEngineRef.current.setVolume(newVolume);
    gaplessEngineRef.current.setMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    if (usingHtmlAudio && htmlAudioRef.current) {
      htmlAudioRef.current.muted = newMuted;
      setIsMuted(newMuted);
      return;
    }

    if (!gaplessEngineRef.current) return;
    gaplessEngineRef.current.setMuted(newMuted);
  };

  const handleCoverClick = useCallback(() => {
    onExpandPlayer?.();
  }, [onExpandPlayer]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const seekDisplayTime = (isScrubbing && scrubTime !== null) ? scrubTime : currentTime;

  // Expose controls to parent
  useEffect(() => {
    if (onControlsReady) {
      onControlsReady({
        gaplessEngine: gaplessEngineRef.current,
        isPlaying,
        togglePlayPause,
        handleNext,
        handlePrevious,
        currentTime,
        duration,
        formatTime,
        volume,
        setVolume: setExternalVolume,
        eqBands,
        setEqBands: setExternalEq,
        invalidateWallSession: wallTracker.invalidateSession,
        wallSessionCount: wallTracker.consecutiveTracks,
        usingHtmlAudio,
      });
    }
  }, [
    isPlaying,
    currentTime,
    duration,
    volume,
    eqBands,
    onControlsReady,
    togglePlayPause,
    handleNext,
    handlePrevious,
    setExternalVolume,
    setExternalEq,
    wallTracker.consecutiveTracks,
    wallTracker.invalidateSession,
    usingHtmlAudio,
  ]);

  // Fallback polling to keep time/duration fresh even if callbacks hiccup
  useEffect(() => {
    const interval = setInterval(() => {
      const engine = gaplessEngineRef.current;
      if (usingHtmlAudio && htmlAudioRef.current) {
        setCurrentTime(htmlAudioRef.current.currentTime);
        if (Number.isFinite(htmlAudioRef.current.duration) && htmlAudioRef.current.duration > 0) {
          setDuration(htmlAudioRef.current.duration);
        }
        return;
      }

      if (!engine) return;
      const nextTime = engine.getCurrentTime();
      const nextDuration = engine.getDuration();
      setCurrentTime((prev) => (Number.isFinite(nextTime) ? nextTime : prev));
      if (Number.isFinite(nextDuration) && nextDuration > 0) {
        setDuration(nextDuration);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [usingHtmlAudio]);

  // Render empty-state UI when no track

  return (
    <>
      {/* Always show fixed player; shows empty state if no track */}
      {isVisible && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl transition-all duration-300"
          style={{
            backgroundColor: 'rgba(26, 26, 26, 0.95)',
            borderTop: '1px solid #333333',
          }}
        >
          {/* Player */}
          <div className="max-w-screen-2xl mr-auto px-4 py-2">
            {currentTrack ? (
            <div className="mr-auto" style={{ maxWidth: '1500px', width: '100%' }}>
              <div className="player-bottom-row">
              {/* Track Info - Left Column (Fixed Width) */}
              <div className="player-bottom-left flex items-center gap-3 w-full">
                <button
                  type="button"
                  aria-label="Open full player"
                  onClick={handleCoverClick}
                  className="flex-shrink-0 rounded-lg overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d32f2f]"
                  style={{ lineHeight: 0 }}
                >
                  <ImageWithFallback
                    src={currentTrack.coverImage || currentTrack.coverArt}
                    alt={currentTrack.title || currentTrack.name || 'Track'}
                    className="w-14 h-14 object-cover"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 mb-1">
                    <button
                      type="button"
                      onClick={handleCoverClick}
                      className="text-left truncate mono hover:text-[#d32f2f] transition-colors"
                      style={{ color: '#e0e0e0', fontSize: '0.9rem', margin: 0, lineHeight: '1.2', fontWeight: 700 }}
                      title={currentTrack.title || currentTrack.name || 'Untitled'}
                    >
                      {currentTrack.title || currentTrack.name || 'Untitled'}
                    </button>
                  </div>
                  <p className="truncate mono" style={{ color: '#a0a0a0', fontSize: '0.75rem', marginTop: '0px', lineHeight: '1.2' }}>
                    {currentTrack.artist}
                  </p>
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    {audioMeta?.codecLabel && (
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
                          color: '#e0e0e0',
                          flexShrink: 0,
                          minWidth: '88px'
                        }}
                      >
                        {audioMeta.codecLabel}
                      </span>
                    )}
                    {(audioMeta?.bitDepth || audioMeta?.sampleRate) && (
                      <span
                        className="mono"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          minWidth: '132px',
                          height: '22px',
                          borderRadius: '6px',
                          border: '1px solid #333333',
                          background: 'rgba(26,26,26,0.6)',
                          padding: '0 8px',
                          fontSize: '0.72rem',
                          flexShrink: 0
                        }}
                      >
                        <span style={{ color: audioMeta?.bitDepth === 24 ? '#c6a700' : '#a0a0a0' }}>{audioMeta?.bitDepth ? `${audioMeta.bitDepth}-bit` : ''}</span>
                        <span style={{ color: '#555' }}>/</span>
                        <span style={{ color: '#d32f2f' }}>{audioMeta?.sampleRate ? `${audioMeta.sampleRate}kHz` : ''}</span>
                      </span>
                    )}
                    {audioMeta?.bitrateKbps && (
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
                          color: '#e0e0e0',
                          flexShrink: 0
                        }}
                      >
                        {formatBitrate(audioMeta.bitrateKbps)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Center Controls - Middle Column (Always Centered) */}
              <div className="player-bottom-center flex flex-col items-center gap-2 w-full">
                {/* Control Buttons */}
                <div className="flex items-center gap-3">
                  {/* Create Playlist inside player */}
                  <button
                    type="button"
                    aria-label="Create playlist"
                    onClick={() => onCreatePlaylist && onCreatePlaylist()}
                    className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                    style={{ color: '#e0e0e0' }}
                    title="Create Playlist"
                  >
                    {/* Plus icon inline SVG to avoid extra imports if not present */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label={isShuffle ? 'Disable shuffle' : 'Enable shuffle'}
                    onClick={() => setIsShuffle(!isShuffle)}
                    className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                    style={{
                      color: isShuffle ? '#d32f2f' : '#a0a0a0',
                    }}
                  >
                    <Shuffle size={16} />
                  </button>

                  <button
                    type="button"
                    aria-label="Previous track"
                    onClick={handlePrevious}
                    className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                    style={{ color: '#e0e0e0' }}
                  >
                    <SkipBack size={20} fill="#e0e0e0" />
                  </button>

                  <button
                    type="button"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
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
                    type="button"
                    aria-label="Next track"
                    onClick={() => handleNext('manual')}
                    className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                    style={{ color: '#e0e0e0' }}
                  >
                    <SkipForward size={20} fill="#e0e0e0" />
                  </button>

                  <button
                    onClick={() => {
                      // Cycle through: off -> repeat playlist -> repeat one -> off
                      if (!isRepeat && !isRepeatOne) {
                        setIsRepeat(true);
                        setIsRepeatOne(false);
                      } else if (isRepeat && !isRepeatOne) {
                        setIsRepeat(false);
                        setIsRepeatOne(true);
                      } else {
                        setIsRepeat(false);
                        setIsRepeatOne(false);
                      }
                    }}
                    className="p-2 rounded-lg transition-all duration-200 hover:scale-110 relative"
                    style={{
                      color: (isRepeat || isRepeatOne) ? '#d32f2f' : '#a0a0a0',
                    }}
                    title={isRepeatOne ? 'Repeat One' : isRepeat ? 'Repeat Playlist' : 'Repeat Off'}
                  >
                    <Repeat size={16} />
                    {isRepeatOne && (
                      <span 
                        className="absolute"
                        style={{
                          fontSize: '0.5rem',
                          fontWeight: 'bold',
                          color: '#d32f2f',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        1
                      </span>
                    )}
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="flex items-center gap-2 w-full" style={{ maxWidth: '500px' }}>
                  <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem', minWidth: '40px' }}>
                    {formatTime(seekDisplayTime)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={seekDisplayTime}
                    onChange={handleSeekChange}
                    onPointerDown={handleSeekStart}
                    onPointerUp={handleSeekEnd}
                    onPointerCancel={handleSeekEnd}
                    className="flex-1"
                    style={{
                      height: '4px',
                      borderRadius: '2px',
                      background: `linear-gradient(to right, #d32f2f ${duration > 0 ? (seekDisplayTime / duration) * 100 : 0}%, #333333 ${duration > 0 ? (seekDisplayTime / duration) * 100 : 0}%)`,
                      appearance: 'none',
                      cursor: 'pointer',
                    }}
                  />
                  <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem', minWidth: '40px' }} aria-live="polite">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* Volume Control & EQ - Right Column */}
              <div className="player-bottom-right flex items-center gap-3 justify-end relative w-full md:ml-auto">
                {/* EQ Button with Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    aria-label={showEQ ? 'Hide equalizer' : 'Show equalizer'}
                    onClick={() => setShowEQ(!showEQ)}
                    className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                    style={{ color: showEQ ? '#d32f2f' : '#a0a0a0' }}
                    title="Equalizer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="4" y1="21" x2="4" y2="14"></line>
                      <line x1="4" y1="10" x2="4" y2="3"></line>
                      <line x1="12" y1="21" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12" y2="3"></line>
                      <line x1="20" y1="21" x2="20" y2="16"></line>
                      <line x1="20" y1="12" x2="20" y2="3"></line>
                      <line x1="2" y1="14" x2="6" y2="14"></line>
                      <line x1="10" y1="8" x2="14" y2="8"></line>
                      <line x1="18" y1="16" x2="22" y2="16"></line>
                    </svg>
                  </button>

                  {/* EQ Dropdown */}
                  {showEQ && (
                    <div
                      className="absolute bottom-full right-0 mb-2 p-4 rounded-lg backdrop-blur-xl"
                      style={{
                        backgroundColor: 'rgba(26, 26, 26, 0.98)',
                        border: '1px solid #333333',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                        width: '240px',
                      }}
                      role="group"
                      aria-label="Equalizer controls"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="mono" style={{ color: '#e0e0e0', fontSize: '0.8rem', fontWeight: 600 }}>EQUALIZER</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              aria-label={showAdvancedEQ ? 'Hide advanced EQ' : 'Show advanced EQ'}
                              onClick={() => setShowAdvancedEQ(!showAdvancedEQ)}
                              className="mono text-xs px-2 py-1 rounded transition-colors"
                              style={{ 
                                color: showAdvancedEQ ? '#d32f2f' : '#a0a0a0', 
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                border: showAdvancedEQ ? '1px solid #d32f2f' : 'none',
                              }}
                            >
                              Adv
                            </button>
                            <button
                              type="button"
                              aria-label="Reset equalizer"
                              onClick={() => {
                                setEqBands({ bass: 0, mid: 0, treble: 0 });
                                setAdvancedEQ({ bassFreq: 200, midFreq: 1000, midQ: 1, trebleFreq: 3200 });
                              }}
                              className="mono text-xs px-2 py-1 rounded transition-colors"
                              style={{ color: '#a0a0a0', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                            >
                              Reset
                            </button>
                          </div>
                        </div>

                        {/* Bass */}
                        <div className="flex items-center gap-3">
                          <span className="mono whitespace-nowrap" style={{ color: '#a0a0a0', fontSize: '0.7rem', minWidth: '50px' }}>Bass</span>
                          <input
                            type="range"
                            min="-12"
                            max="12"
                            step="1"
                            value={eqBands.bass}
                            onChange={(e) => setEqBands({ ...eqBands, bass: parseFloat(e.target.value) })}
                            className="flex-1"
                            style={{
                              height: '4px',
                              borderRadius: '2px',
                              background: `linear-gradient(to right, #d32f2f ${((eqBands.bass + 12) / 24) * 100}%, #333333 ${((eqBands.bass + 12) / 24) * 100}%)`,
                              appearance: 'none',
                              cursor: 'pointer',
                            }}
                            aria-label="Bass gain"
                            aria-valuemin={-12}
                            aria-valuemax={12}
                            aria-valuenow={eqBands.bass}
                            aria-orientation="horizontal"
                          />
                          <span
                            className="mono"
                            style={eqValueStyle}
                          >
                            {eqBands.bass > 0 ? '+' : ''}{eqBands.bass} dB
                          </span>
                        </div>

                        {/* Mid */}
                        <div className="flex items-center gap-3">
                          <span className="mono whitespace-nowrap" style={{ color: '#a0a0a0', fontSize: '0.7rem', minWidth: '50px' }}>Mid</span>
                          <input
                            type="range"
                            min="-12"
                            max="12"
                            step="1"
                            value={eqBands.mid}
                            onChange={(e) => setEqBands({ ...eqBands, mid: parseFloat(e.target.value) })}
                            className="flex-1"
                            style={{
                              height: '4px',
                              borderRadius: '2px',
                              background: `linear-gradient(to right, #d32f2f ${((eqBands.mid + 12) / 24) * 100}%, #333333 ${((eqBands.mid + 12) / 24) * 100}%)`,
                              appearance: 'none',
                              cursor: 'pointer',
                            }}
                            aria-label="Mid gain"
                            aria-valuemin={-12}
                            aria-valuemax={12}
                            aria-valuenow={eqBands.mid}
                            aria-orientation="horizontal"
                          />
                          <span
                            className="mono"
                            style={eqValueStyle}
                          >
                            {eqBands.mid > 0 ? '+' : ''}{eqBands.mid} dB
                          </span>
                        </div>

                        {/* Treble */}
                        <div className="flex items-center gap-3">
                          <span className="mono whitespace-nowrap" style={{ color: '#a0a0a0', fontSize: '0.7rem', minWidth: '50px' }}>Treble</span>
                          <input
                            type="range"
                            min="-12"
                            max="12"
                            step="1"
                            value={eqBands.treble}
                            onChange={(e) => setEqBands({ ...eqBands, treble: parseFloat(e.target.value) })}
                            className="flex-1"
                            style={{
                              height: '4px',
                              borderRadius: '2px',
                              background: `linear-gradient(to right, #d32f2f ${((eqBands.treble + 12) / 24) * 100}%, #333333 ${((eqBands.treble + 12) / 24) * 100}%)`,
                              appearance: 'none',
                              cursor: 'pointer',
                            }}
                            aria-label="Treble gain"
                            aria-valuemin={-12}
                            aria-valuemax={12}
                            aria-valuenow={eqBands.treble}
                            aria-orientation="horizontal"
                          />
                          <span
                            className="mono"
                            style={eqValueStyle}
                          >
                            {eqBands.treble > 0 ? '+' : ''}{eqBands.treble} dB
                          </span>
                        </div>

                        {/* Advanced EQ Controls */}
                        {showAdvancedEQ && (
                          <>
                            <div 
                              className="my-2"
                              style={{
                                height: '1px',
                                backgroundColor: '#333333',
                              }}
                            />
                            
                            <span className="mono" style={{ color: '#666666', fontSize: '0.7rem' }}>
                              Frequency Controls
                            </span>

                            {/* Bass Frequency */}
                            <div className="flex items-center gap-3">
                              <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.65rem', minWidth: '50px' }}>Bass Hz</span>
                              <input
                                type="range"
                                min="20"
                                max="500"
                                step="10"
                                value={advancedEQ.bassFreq}
                                onChange={(e) => {
                                  const newFreq = parseFloat(e.target.value);
                                  setAdvancedEQ({ ...advancedEQ, bassFreq: newFreq });
                                  gaplessEngineRef.current?.setAdvancedEQ(newFreq, advancedEQ.midFreq, advancedEQ.midQ, advancedEQ.trebleFreq);
                                }}
                                className="flex-1"
                                style={{
                                  height: '3px',
                                  borderRadius: '2px',
                                  background: `linear-gradient(to right, #d32f2f ${((advancedEQ.bassFreq - 20) / 480) * 100}%, #333333 ${((advancedEQ.bassFreq - 20) / 480) * 100}%)`,
                                  appearance: 'none',
                                  cursor: 'pointer',
                                }}
                                aria-label="Bass frequency"
                                aria-valuemin={20}
                                aria-valuemax={500}
                                aria-valuenow={advancedEQ.bassFreq}
                                aria-orientation="horizontal"
                              />
                              <span className="mono" style={{ color: '#666666', fontSize: '0.55rem', minWidth: '45px', textAlign: 'right' }}>
                                {advancedEQ.bassFreq}
                              </span>
                            </div>

                            {/* Mid Frequency */}
                            <div className="flex items-center gap-3">
                              <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.65rem', minWidth: '50px' }}>Mid Hz</span>
                              <input
                                type="range"
                                min="200"
                                max="5000"
                                step="100"
                                value={advancedEQ.midFreq}
                                onChange={(e) => {
                                  const newFreq = parseFloat(e.target.value);
                                  setAdvancedEQ({ ...advancedEQ, midFreq: newFreq });
                                  gaplessEngineRef.current?.setAdvancedEQ(advancedEQ.bassFreq, newFreq, advancedEQ.midQ, advancedEQ.trebleFreq);
                                }}
                                className="flex-1"
                                style={{
                                  height: '3px',
                                  borderRadius: '2px',
                                  background: `linear-gradient(to right, #d32f2f ${((advancedEQ.midFreq - 200) / 4800) * 100}%, #333333 ${((advancedEQ.midFreq - 200) / 4800) * 100}%)`,
                                  appearance: 'none',
                                  cursor: 'pointer',
                                }}
                                aria-label="Mid frequency"
                                aria-valuemin={200}
                                aria-valuemax={5000}
                                aria-valuenow={advancedEQ.midFreq}
                                aria-orientation="horizontal"
                              />
                              <span className="mono" style={{ color: '#666666', fontSize: '0.55rem', minWidth: '45px', textAlign: 'right' }}>
                                {advancedEQ.midFreq}
                              </span>
                            </div>

                            {/* Mid Q */}
                            <div className="flex items-center gap-3">
                              <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.65rem', minWidth: '50px' }}>Mid Q</span>
                              <input
                                type="range"
                                min="0.1"
                                max="10"
                                step="0.1"
                                value={advancedEQ.midQ}
                                onChange={(e) => {
                                  const newQ = parseFloat(e.target.value);
                                  setAdvancedEQ({ ...advancedEQ, midQ: newQ });
                                  gaplessEngineRef.current?.setAdvancedEQ(advancedEQ.bassFreq, advancedEQ.midFreq, newQ, advancedEQ.trebleFreq);
                                }}
                                className="flex-1"
                                style={{
                                  height: '3px',
                                  borderRadius: '2px',
                                  background: `linear-gradient(to right, #d32f2f ${((advancedEQ.midQ - 0.1) / 9.9) * 100}%, #333333 ${((advancedEQ.midQ - 0.1) / 9.9) * 100}%)`,
                                  appearance: 'none',
                                  cursor: 'pointer',
                                }}
                                aria-label="Mid Q"
                                aria-valuemin={0.1}
                                aria-valuemax={10}
                                aria-valuenow={advancedEQ.midQ}
                                aria-orientation="horizontal"
                              />
                              <span className="mono" style={{ color: '#666666', fontSize: '0.55rem', minWidth: '45px', textAlign: 'right' }}>
                                {advancedEQ.midQ.toFixed(1)}
                              </span>
                            </div>

                            {/* Treble Frequency */}
                            <div className="flex items-center gap-3">
                              <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.65rem', minWidth: '50px' }}>Treble Hz</span>
                              <input
                                type="range"
                                min="2000"
                                max="16000"
                                step="100"
                                value={advancedEQ.trebleFreq}
                                onChange={(e) => {
                                  const newFreq = parseFloat(e.target.value);
                                  setAdvancedEQ({ ...advancedEQ, trebleFreq: newFreq });
                                  gaplessEngineRef.current?.setAdvancedEQ(advancedEQ.bassFreq, advancedEQ.midFreq, advancedEQ.midQ, newFreq);
                                }}
                                className="flex-1"
                                style={{
                                  height: '3px',
                                  borderRadius: '2px',
                                  background: `linear-gradient(to right, #d32f2f ${((advancedEQ.trebleFreq - 2000) / 14000) * 100}%, #333333 ${((advancedEQ.trebleFreq - 2000) / 14000) * 100}%)`,
                                  appearance: 'none',
                                  cursor: 'pointer',
                                }}
                                aria-label="Treble frequency"
                                aria-valuemin={2000}
                                aria-valuemax={16000}
                                aria-valuenow={advancedEQ.trebleFreq}
                                aria-orientation="horizontal"
                              />
                              <span className="mono" style={{ color: '#666666', fontSize: '0.55rem', minWidth: '45px', textAlign: 'right' }}>
                                {advancedEQ.trebleFreq}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Volume Controls */}
                <button type="button" aria-label={isMuted ? 'Unmute' : 'Mute'} onClick={toggleMute} className="p-2 rounded-lg transition-all duration-200 hover:scale-110">
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
                  className="w-20 md:w-24"
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
            ) : (
              <div className="flex items-center justify-center" style={{ minHeight: '48px' }}>
                <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.9rem' }}>No track playing</span>
              </div>
            )}
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

      {/* No collapse/expand controls */}
    </>
  );
}