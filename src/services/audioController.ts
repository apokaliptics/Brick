import { GaplessAudioEngine } from '../utils/gaplessAudio';
import { musicService } from './musicProvider';
import { addRecentlyPlayedTrack } from '../utils/recentlyPlayed';
import type { Track } from '../types';
import { isPlaceholderAudioUrl } from '../utils/isPlaceholderAudio';

type StateSubscriber = (state: Partial<Record<string, any>>) => void;

class AudioController {
  private engine: GaplessAudioEngine | null = null;
  private subscribers: Set<StateSubscriber> = new Set();
  private currentTrack: Track | null = null;
  private playlist: Track[] = [];
  private isPlaying = false;
  private currentTime = 0;
  private duration = 0;
  private volume = 1;

  constructor() {
    try {
      this.engine = new GaplessAudioEngine();
      this.engine.setCallbacks({
        onStateChange: (s) => this.notifySubscribers(s),
        onTrackEnd: () => this.handleNext('auto'),
        onTrackChange: (trackId) => this.onEngineTrackChange(trackId),
      });
      this.volume = 1;
      this.engine.setVolume(1);
    } catch (err) {
      console.warn('AudioController failed to init GaplessAudioEngine', err);
      this.engine = null;
    }
  }

  private notifySubscribers(state: Partial<Record<string, any>>) {
    // Update local mirror of state
    if (state.isPlaying !== undefined) this.isPlaying = state.isPlaying;
    if (state.currentTime !== undefined) this.currentTime = state.currentTime;
    if (state.duration !== undefined) this.duration = state.duration;
    if (state.volume !== undefined) this.volume = state.volume;
    // Notify
    for (const s of this.subscribers) {
      try { s({ ...state, currentTrack: this.currentTrack, playlist: this.playlist }); } catch (e) { /* ignore*/ }
    }
  }

  private onEngineTrackChange(trackId: string) {
    const track = this.playlist.find(t => t.id === trackId) || null;
    if (track) this.currentTrack = track;
    this.notifySubscribers({ currentTrack: track });
  }

  subscribe(fn: StateSubscriber) {
    this.subscribers.add(fn);
    // Immediately send current state
    fn({ currentTrack: this.currentTrack, playlist: this.playlist, isPlaying: this.isPlaying, currentTime: this.currentTime, duration: this.duration, volume: this.volume });
    // Return a cleanup function that does not return the boolean result of delete
    return () => { this.subscribers.delete(fn); };
  }

  getAnalyserNode() {
    return this.engine?.getAnalyserNode?.() || null;
  }

  getEngine() {
    return this.engine;
  }

  async setPlaylist(playlist: Track[], startIndex = 0, autoPlay = false) {
    this.playlist = playlist || [];
    if (this.playlist.length === 0) return;
    const initialTrack = this.playlist[startIndex] || this.playlist[0];
    this.currentTrack = initialTrack;
    // Load and optionally play
    await this.loadCurrentTrack({ play: autoPlay });
    this.notifySubscribers({ playlist: this.playlist, currentTrack: this.currentTrack });
  }

  getPublicApi() {
    return {
      playTrack: (t: Track) => this.playTrack(t),
      setPlaylist: (pl: Track[], i = 0, auto = false) => this.setPlaylist(pl, i, auto),
      play: () => this.play(),
      pause: () => this.pause(),
      togglePlayPause: () => this.togglePlayPause(),
      handleNext: (reason?: 'auto'|'manual') => this.handleNext(reason),
      handlePrevious: () => this.handlePrevious(),
      getAnalyserNode: () => this.getAnalyserNode(),
      seek: (time: number) => this.seek(time),
      isPlaying: () => this.isPlaying,
      currentTime: () => this.currentTime,
      duration: () => this.duration,
      volume: () => this.volume,
      formatTime: (s: number) => {
        if (!s && s !== 0) return '0:00';
        const minutes = Math.floor(s / 60);
        const seconds = Math.floor(s % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
      },
      setVolume: (v: number) => this.setVolume(v),
      setEqBands: (bands: any) => this.setEqBands(bands),
      invalidateWallSession: (reason?: string) => {/* noop for now */},
    };
  }

  private async setVolume(v: number) {
    this.volume = v;
    if (this.engine) this.engine.setVolume(v);
    this.notifySubscribers({ volume: v });
  }

  private setEqBands(bands: { bass: number; mid: number; treble: number }) {
    if (!this.engine) return;
    this.engine.setEQ(bands.bass, bands.mid, bands.treble);
    this.notifySubscribers({ eqBands: bands });
  }

  private async loadCurrentTrack(opts: { play?: boolean } = {}) {
    if (!this.currentTrack) return;
    const id = this.currentTrack.id;
    let url = (this.currentTrack as any).audioUrl || (this.currentTrack as any).downloadUrl;
    if (!url) {
      try {
        url = await musicService.getStreamUrl(id);
      } catch (err) {
        console.warn('audioController failed to resolve stream url for', id, err);
      }
    }
    if (!url || isPlaceholderAudioUrl(url)) {
      // No stream resolvable for this track — notify subscribers and throw so the caller can handle UI
      this.notifySubscribers({ error: 'No preview available for this track' });
      throw new Error('No preview available');
    }
    if (!this.engine) {
      // If engine is missing, we can fall back to a hidden HTMLAudioElement per subscriber's choice
      this.notifySubscribers({ error: 'No audio engine available' });
      return;
    }

    try {
      await this.engine.loadTrack({ url: url, id });
      this.duration = this.engine ? (this.duration) : this.duration;
      this.notifySubscribers({ currentTrack: this.currentTrack });
      if (opts.play) {
        this.play();
      }
    } catch (err) {
      console.error('Failed to load track', err);
      this.notifySubscribers({ error: String(err) });
    }
  }

  async playTrack(track: Track) {
    // If it's already the same track, toggle play
    if (this.currentTrack?.id === track.id) {
      this.togglePlayPause();
      return;
    }
    // Stop and set new track and play
    this.currentTrack = track;
    // Ensure in playlist
    const idx = this.playlist.findIndex(t => t.id === track.id);
    if (idx === -1) {
      this.playlist.unshift(track);
    }
    await this.loadCurrentTrack({ play: true });
    this.notifySubscribers({ currentTrack: this.currentTrack, isPlaying: this.isPlaying });
    // Track playback for recently played
    try {
      await addRecentlyPlayedTrack({
        trackId: track.id,
        trackTitle: track.title || track.name || 'Untitled',
        artistName: (track as any).artist || (track as any).artists?.[0]?.name || '',
        coverArt: (track as any).coverArt || (track as any).coverImage || '',
        audioUrl: (track as any).audioUrl || '',
        playedAt: Date.now(),
      });
    } catch (e) {
      /* ignore tracking errors */
    }
  }

  play() {
    if (!this.engine) return;
    this.engine.play();
    this.isPlaying = true;
    this.notifySubscribers({ isPlaying: true });
  }

  pause() {
    if (!this.engine) return;
    this.engine.pause();
    this.isPlaying = false;
    this.notifySubscribers({ isPlaying: false });
  }

  togglePlayPause() {
    if (!this.engine) return; // fallback could be separate
    if (this.isPlaying) this.pause(); else this.play();
  }

  handleNext(reason?: 'auto' | 'manual') {
    if (!this.playlist.length) return;
    if (!this.currentTrack) return;
    const idx = this.playlist.findIndex(t => t.id === this.currentTrack!.id);
    const nextIdx = (idx + 1) % this.playlist.length;
    const nextTrack = this.playlist[nextIdx];
    if (!nextTrack) return;
    this.currentTrack = nextTrack;
    this.loadCurrentTrack({ play: true });
    this.notifySubscribers({ currentTrack: this.currentTrack, isPlaying: this.isPlaying });
    return;
  }

  seek(time: number) {
    if (!this.engine) return;
    try {
      this.engine.seek(time);
      this.notifySubscribers({ currentTime: time });
    } catch (err) {
      console.warn('AudioController seek failed', err);
    }
  }

  handlePrevious() {
    if (!this.playlist.length) return;
    if (!this.currentTrack) return;
    const idx = this.playlist.findIndex(t => t.id === this.currentTrack!.id);
    const prevIdx = (idx - 1 + this.playlist.length) % this.playlist.length;
    const prevTrack = this.playlist[prevIdx];
    if (!prevTrack) return;
    this.currentTrack = prevTrack;
    this.loadCurrentTrack({ play: true });
    this.notifySubscribers({ currentTrack: this.currentTrack, isPlaying: this.isPlaying });
    return;
  }
}

export const audioController = new AudioController();
export default audioController;
