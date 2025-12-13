// @ts-nocheck
/**
 * GaplessAudioEngine - True gapless playback using Web Audio API
 * 
 * Implements dual-buffer architecture for seamless track transitions.
 * Inspired by audiophile players like foobar2000.
 */

interface Track {
  url: string;
  id: string;
  isCloud?: boolean;
}

// Guardrails to keep RAM bounded when decoding whole tracks into memory.
// Audiophile-friendly limits: allow very large FLAC/WAV while still preventing runaway memory.
const MAX_BUFFER_BYTES = 800 * 1024 * 1024; // 800 MB ceiling for gapless buffers
const MAX_DECODE_DURATION_SECONDS = 4 * 60 * 60; // 4 hours
export const GAPLESS_TOO_LARGE_ERROR = 'Track too large for gapless buffer; stream instead.';

interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

type StateChangeCallback = (state: Partial<AudioState>) => void;
type TrackEndCallback = () => void;
type TrackChangeCallback = (trackId: string) => void;
type PreloadStateCallback = (state: {
  trackId: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
  isCloud?: boolean;
}) => void;

export class GaplessAudioEngine {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private analyserNode: AnalyserNode | null = null;
  
  // Dual buffer system for gapless playback
  private currentSource: AudioBufferSourceNode | null = null;
  private nextSource: AudioBufferSourceNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private nextBuffer: AudioBuffer | null = null;
  
  // Track state
  private currentTrack: Track | null = null;
  private nextTrack: Track | null = null;
  private isPlaying: boolean = false;
  private volume: number = 1.0;
  private isMuted: boolean = false;
  
  // Playback timing
  private playbackStartTime: number = 0;
  private pausedAt: number = 0;
  private scheduledNextTrack: boolean = false;
  private preloadTimeoutId: number | null = null;
  private swapTimeoutId: number | null = null;
  
  // EQ filters
  private bassFilter: BiquadFilterNode;
  private midFilter: BiquadFilterNode;
  private trebleFilter: BiquadFilterNode;
  
  // Callbacks
  private onStateChange: StateChangeCallback | null = null;
  private onTrackEnd: TrackEndCallback | null = null;
  private onTrackChange: TrackChangeCallback | null = null;
  private onPreloadStateChange: PreloadStateCallback | null = null;
  
  // Animation frame for time updates
  private rafId: number | null = null;
  // Prevent onended from firing callbacks on manual stops
  private suppressOnEnded: boolean = false;

  // Preload control
  private nextFetchController: AbortController | null = null;
  private currentPreloadTrackId: string | null = null;

  private async fetchArrayBufferWithLimit(url: string, controller?: AbortController): Promise<ArrayBuffer> {
    const response = await fetch(url, { signal: controller?.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch audio (${response.status})`);
    }

    const contentLengthHeader = response.headers.get('content-length');
    const contentLength = contentLengthHeader === null ? NaN : Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_BUFFER_BYTES) {
      controller?.abort();
      throw new Error(GAPLESS_TOO_LARGE_ERROR);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      // Fallback for environments without streaming reader support
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_BUFFER_BYTES) {
        throw new Error(GAPLESS_TOO_LARGE_ERROR);
      }
      return arrayBuffer;
    }

    const chunks: Uint8Array[] = [];
    let received = 0;
    let finished = false;
    while (!finished) {
      const { done, value } = await reader.read();
      finished = Boolean(done);
      if (finished) break;
      if (value === undefined) continue;
      received += value.byteLength;
      if (received > MAX_BUFFER_BYTES) {
        controller?.abort();
        throw new Error(GAPLESS_TOO_LARGE_ERROR);
      }
      chunks.push(value);
    }

    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return merged.buffer;
  }

  constructor() {
    // Initialize Web Audio API context
    type AudioCtxCtor = new (...args: unknown[]) => AudioContext;
    const win = window as unknown as { AudioContext?: AudioCtxCtor; webkitAudioContext?: AudioCtxCtor };
    const AudioContextCls = win.AudioContext ?? win.webkitAudioContext;
    if (!AudioContextCls) {
      throw new Error('Web Audio API not supported');
    }
    this.audioContext = new AudioContextCls();
    
    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.volume;
    
    // Create EQ filters
    this.bassFilter = this.audioContext.createBiquadFilter();
    this.bassFilter.type = 'lowshelf';
    this.bassFilter.frequency.value = 200;
    
    this.midFilter = this.audioContext.createBiquadFilter();
    this.midFilter.type = 'peaking';
    this.midFilter.frequency.value = 1000;
    this.midFilter.Q.value = 1;
    
    this.trebleFilter = this.audioContext.createBiquadFilter();
    this.trebleFilter.type = 'highshelf';
    this.trebleFilter.frequency.value = 3200;
    // Create analyser node and wire it into the graph so external code can tap it
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.4;
    
    // Connect audio graph: gain -> bass -> mid -> treble -> destination
    this.gainNode.connect(this.bassFilter);
    this.bassFilter.connect(this.midFilter);
    this.midFilter.connect(this.trebleFilter);
    // Connect treble filter -> analyser -> destination to allow visualizers to use the analyser
    this.trebleFilter.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);
    
    // Start time update loop
    this.startTimeUpdates();
  }

  /**
   * Expose an AnalyserNode for external visualizers
   */
  getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  getCurrentTrackId(): string | null {
    return this.currentTrack?.id ?? null;
  }

  /**
   * Set callbacks for state changes
   */
  setCallbacks(callbacks: {
    onStateChange?: StateChangeCallback;
    onTrackEnd?: TrackEndCallback;
    onTrackChange?: TrackChangeCallback;
    onPreloadStateChange?: PreloadStateCallback;
  }) {
    this.onStateChange = callbacks.onStateChange || null;
    this.onTrackEnd = callbacks.onTrackEnd || null;
    this.onTrackChange = callbacks.onTrackChange || null;
    this.onPreloadStateChange = callbacks.onPreloadStateChange || null;
  }

  /**
   * Load and play a track
   */
  async loadTrack(track: Track): Promise<void> {
    this.currentTrack = track;
    
    // Clean up any scheduled transitions from previous track
    this.cancelNextPreload('switch-track');
    if (this.nextSource !== null) {
      this.nextSource.stop();
      this.nextSource = null;
    }
    
    // Clear old buffers to free memory
    this.nextBuffer = null;
    this.nextTrack = null;
    this.clearScheduledTransitions();
    
    // Fetch and decode audio with size/duration guardrails
    const arrayBuffer = await this.fetchArrayBufferWithLimit(track.url);
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    if (audioBuffer.duration > MAX_DECODE_DURATION_SECONDS) {
      throw new Error(GAPLESS_TOO_LARGE_ERROR);
    }
    
    this.currentBuffer = audioBuffer;
    
    // Notify track change
    if (this.onTrackChange) {
      this.onTrackChange(track.id);
    }
    
    this.notifyStateChange({
      duration: audioBuffer.duration,
      currentTime: 0,
    });
  }

  /**
   * Preload next track for gapless playback
   */
  async preloadNextTrack(track: Track): Promise<void> {
    this.cancelNextPreload('new-request');
    this.nextTrack = track;
    this.currentPreloadTrackId = track.id;

    const controller = new AbortController();
    this.nextFetchController = controller;

    this.notifyPreloadState({
      trackId: track.id,
      status: 'loading',
      isCloud: track.isCloud,
    });
    
    try {
      const arrayBuffer = await this.fetchArrayBufferWithLimit(track.url, controller);
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      if (audioBuffer.duration > MAX_DECODE_DURATION_SECONDS) {
        throw new Error(GAPLESS_TOO_LARGE_ERROR);
      }
      
      if (controller.signal.aborted) {
        return;
      }

      this.nextBuffer = audioBuffer;
      this.nextFetchController = null;
      this.currentPreloadTrackId = null;
      // Preload complete for: ${track.id}
      this.notifyPreloadState({
        trackId: track.id,
        status: 'ready',
        isCloud: track.isCloud,
      });
      this.scheduleNextTrackPlayback();
      
    } catch (error) {
      const err = error as { name?: string } | undefined;
      if (err?.name === 'AbortError') {
        this.notifyPreloadState({
          trackId: track.id,
          status: 'idle',
          message: 'Preload aborted',
          isCloud: track.isCloud,
        });
        return;
      }
      this.nextFetchController = null;
      this.currentPreloadTrackId = null;
      this.notifyPreloadState({
        trackId: track.id,
        status: 'error',
        message: (error instanceof Error) ? error.message : String(error),
        isCloud: track.isCloud,
      });
    }
  }

  /**
   * Play the current track
   */
  play(): void {
    if (!this.currentBuffer) {
      console.warn('No track loaded');
      return;
    }

    // Resume audio context if suspended (required by some browsers)
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }

    // Stop any existing source
    if (this.currentSource !== null) {
      this.currentSource.stop();
    }

    // Create new source
    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = this.currentBuffer;
    this.currentSource.connect(this.gainNode);

    const sourceForHandler = this.currentSource;
    // Handle track end. Ignore events from sources that were replaced during gapless swaps.
    sourceForHandler.onended = () => {
      if (this.suppressOnEnded) {
        // Manual stop triggered this; ignore and reset flag
        this.suppressOnEnded = false;
        return;
      }
      if (sourceForHandler !== this.currentSource) {
        // This event belongs to a previous source that already handed off to the next track
        return;
      }
      // Current track ended
      if (!this.scheduledNextTrack) {
        // No next track was scheduled - stop playback
        this.isPlaying = false;
        this.notifyStateChange({ isPlaying: false });
        if (this.onTrackEnd) {
          this.onTrackEnd();
        }
      }
    };

    // Start playback
    const offset = this.pausedAt;
    this.currentSource.start(0, offset);
    this.playbackStartTime = this.audioContext.currentTime - offset;
    this.isPlaying = true;
    
    this.notifyStateChange({ isPlaying: true });
    this.scheduleNextTrackPlayback();
  }

  /**
   * Perform seamless transition to next track
   * @param scheduledStartTime - The exact AudioContext time when the next track was scheduled to start
   */
  private performGaplessTransition(scheduledStartTime: number): void {
    if (!this.nextBuffer || !this.nextTrack || !this.nextSource) {
      return;
    }

    // Executing gapless transition
    
    // Swap tracks
    this.currentBuffer = this.nextBuffer;
    this.currentTrack = this.nextTrack;
    const newCurrentSource = this.nextSource;
    
    // Set up onended handler for the newly current source
    if (newCurrentSource !== null) {
      const sourceForHandler = newCurrentSource;
      newCurrentSource.onended = () => {
        if (this.suppressOnEnded) {
          this.suppressOnEnded = false;
          return;
        }

        if (sourceForHandler !== this.currentSource) {
          return;
        }

        // Track ended naturally

        if (!this.scheduledNextTrack) {
          this.isPlaying = false;
          this.notifyStateChange({ isPlaying: false });
          if (this.onTrackEnd) {
            this.onTrackEnd();
          }
        }
      };
    }
    
    this.currentSource = newCurrentSource;
    
    // Reset for next transition
    this.nextBuffer = null;
    this.nextTrack = null;
    this.nextSource = null;
    this.scheduledNextTrack = false;
    this.pausedAt = 0;
    
    // CRITICAL: Use the pre-calculated scheduled time, NOT audioContext.currentTime
    // This avoids drift from setTimeout imprecision
    this.playbackStartTime = scheduledStartTime;
    
    // Notify track change
    if (this.onTrackChange) {
      this.onTrackChange(this.currentTrack.id);
    }
    
    this.notifyStateChange({
      duration: this.currentBuffer.duration,
      currentTime: 0,
    });
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.isPlaying) return;

    this.pausedAt = this.getCurrentTime();
    this.isPlaying = false;

    if (this.currentSource !== null) {
      this.suppressOnEnded = true;
      this.currentSource.stop();
      this.currentSource = null;
    }

    // IMPORTANT: Cancel scheduled next track to prevent ghost audio
    // If we're in the transition window, stop the next source too
    if (this.nextSource !== null) {
      this.suppressOnEnded = true;
      this.nextSource.stop();
      // Don't clear nextSource/nextBuffer - we want to keep them for when we resume
    }
    
    // Reset transition state but keep the preloaded buffers
    this.scheduledNextTrack = false;
    this.clearScheduledTransitions();

    this.notifyStateChange({ isPlaying: false });
  }

  /**
   * Instantly switch to a preloaded next track (used for manual skips)
   * Returns true if a preloaded buffer was adopted, false otherwise.
   */
  usePreloadedTrack(trackId: string, shouldPlay: boolean): boolean {
    if (!this.nextTrack || !this.nextBuffer || this.nextTrack.id !== trackId) {
      return false;
    }

    if (this.currentSource !== null) {
      this.currentSource.stop();
      this.currentSource = null;
    }

    this.clearScheduledTransitions();

    this.currentTrack = this.nextTrack;
    this.currentBuffer = this.nextBuffer;
    this.nextTrack = null;
    this.nextBuffer = null;
    this.nextSource = null;
    this.pausedAt = 0;
    this.scheduledNextTrack = false;

    if (this.onTrackChange !== null && this.currentTrack !== null) {
      this.onTrackChange(this.currentTrack.id);
    }

    this.notifyStateChange({
      duration: this.currentBuffer?.duration || 0,
      currentTime: 0,
    });

    if (shouldPlay) {
      this.play();
    } else {
      this.isPlaying = false;
      this.notifyStateChange({ isPlaying: false, currentTime: 0 });
    }

    return true;
  }

  /**
   * Toggle play/pause
   */
  togglePlayPause(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Seek to a specific time
   */
  seek(time: number): void {
    if (!this.currentBuffer) return;

    const wasPlaying = this.isPlaying;
    
    if (this.isPlaying) {
      this.pause();
    }

    this.pausedAt = Math.max(0, Math.min(time, this.currentBuffer.duration));
    this.notifyStateChange({ currentTime: this.pausedAt });

    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    
    if (!this.isMuted) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
    }
    
    this.notifyStateChange({ volume: this.volume });
  }

  /**
   * Set mute state
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    const targetVolume = muted ? 0 : this.volume;
    this.gainNode.gain.setValueAtTime(targetVolume, this.audioContext.currentTime);
    this.notifyStateChange({ isMuted: muted });
  }

  /**
   * Set EQ band values (-12 to +12 dB)
   */
  setEQ(bass: number, mid: number, treble: number): void {
    this.bassFilter.gain.value = bass;
    this.midFilter.gain.value = mid;
    this.trebleFilter.gain.value = treble;
  }

  /**
   * Set advanced EQ parameters (frequencies and Q)
   */
  setAdvancedEQ(bassFreq: number, midFreq: number, midQ: number, trebleFreq: number): void {
    this.bassFilter.frequency.value = bassFreq;
    this.midFilter.frequency.value = midFreq;
    this.midFilter.Q.value = midQ;
    this.trebleFilter.frequency.value = trebleFreq;
  }

  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    if (this.currentBuffer === null) {
      return 0;
    }

    if (this.isPlaying) {
      const elapsed = this.audioContext.currentTime - this.playbackStartTime;
      if (!Number.isFinite(elapsed) || elapsed < 0) {
        return 0; // Clamp invalid or negative elapsed before scheduled start
      }
      return Math.min(elapsed, this.currentBuffer.duration);
    }

    return Number.isFinite(this.pausedAt) ? this.pausedAt : 0;
  }

  /**
   * Get track duration
   */
  getDuration(): number {
    const duration = this.currentBuffer?.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      return 0;
    }
    return duration;
  }

  /**
   * Get current state
   */
  getState(): AudioState {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      volume: this.volume,
      isMuted: this.isMuted,
    };
  }

  /**
   * Start periodic time updates
   */
  private startTimeUpdates(): void {
    const updateTime = () => {
      if (this.isPlaying) {
        this.notifyStateChange({
          currentTime: this.getCurrentTime(),
        });
      }
      this.rafId = requestAnimationFrame(updateTime);
    };
    updateTime();
  }

  /**
   * Notify state change
   */
  private notifyStateChange(state: Partial<AudioState>): void {
    if (this.onStateChange) {
      this.onStateChange(state);
    }
  }

  private notifyPreloadState(state: {
    trackId: string;
    status: 'idle' | 'loading' | 'ready' | 'error';
    message?: string;
    isCloud?: boolean;
  }): void {
    if (this.onPreloadStateChange) {
      this.onPreloadStateChange(state);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }

    this.cancelNextPreload('destroy');
    this.clearScheduledTransitions();

    if (this.currentSource !== null) {
      this.suppressOnEnded = true;
      this.currentSource.stop();
    }

    if (this.nextSource !== null) {
      this.suppressOnEnded = true;
      this.nextSource.stop();
    }

    void this.audioContext.close();
  }

  private scheduleNextTrackPlayback(): void {
    if (!this.currentBuffer || !this.nextBuffer || !this.nextTrack || !this.currentSource) {
      return;
    }

    if (!this.isPlaying) {
      return;
    }

    this.clearScheduledTransitions();

    const duration = this.currentBuffer.duration;
    const gaplessThreshold = 2.0;
    const elapsed = this.audioContext.currentTime - this.playbackStartTime;
    const timeUntilTransition = duration - elapsed;
    const timeUntilPreload = Math.max(0, (timeUntilTransition - gaplessThreshold) * 1000);

    this.preloadTimeoutId = window.setTimeout(() => {
      if (!this.isPlaying || this.scheduledNextTrack || !this.nextBuffer || !this.nextTrack) {
        return;
      }

      this.scheduledNextTrack = true;
      // Scheduling gapless transition for next track

      this.nextSource = this.audioContext.createBufferSource();
      this.nextSource.buffer = this.nextBuffer;
      this.nextSource.connect(this.gainNode);

      const currentSourceEndTime = this.playbackStartTime + duration;
      this.nextSource.start(currentSourceEndTime);

      // Next track scheduled to start at: ${currentSourceEndTime}

      const timeUntilSwap = (currentSourceEndTime - this.audioContext.currentTime) * 1000 - 50;
      this.swapTimeoutId = window.setTimeout(() => {
        if (this.isPlaying) {
          this.performGaplessTransition(currentSourceEndTime);
        }
      }, Math.max(0, timeUntilSwap));
    }, timeUntilPreload);
  }

  private clearScheduledTransitions(): void {
    if (this.preloadTimeoutId !== null) {
      clearTimeout(this.preloadTimeoutId);
      this.preloadTimeoutId = null;
    }

    if (this.swapTimeoutId !== null) {
      clearTimeout(this.swapTimeoutId);
      this.swapTimeoutId = null;
    }

    this.scheduledNextTrack = false;
  }

  private cancelNextPreload(reason?: string): void {
    if (this.nextFetchController !== null) {
      try {
        this.nextFetchController.abort();
      } catch (e) {
        // Ignore abort errors
      }
    }
    if (this.currentPreloadTrackId !== null) {
      this.notifyPreloadState({
        trackId: this.currentPreloadTrackId,
        status: 'idle',
        message: reason,
        isCloud: this.nextTrack?.isCloud,
      });
    }
    this.nextFetchController = null;
    this.currentPreloadTrackId = null;
  }
}
