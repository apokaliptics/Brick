// @ts-nocheck
import type { Track } from '../types';
import { GaplessAudioEngine } from '../utils/gaplessAudio';
import { isPlaceholderAudioUrl } from '../utils/isPlaceholderAudio';
import { addRecentlyPlayedTrack } from '../utils/recentlyPlayed';
import { musicService } from './musicProvider';

type TrackWithSources = Track & {
  audioUrl?: string | null;
  downloadUrl?: string | null;
  previewUrl?: string | null;
  coverArt?: string | null;
  coverImage?: string | null;
  artists?: { name?: string | null }[];
  artist?: string | null;
};

type AudioState = {
  currentTrack: Track | null;
  playlist: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  eqBands?: { bass: number; mid: number; treble: number };
  error?: string;
};

type StateSubscriber = (state: Partial<AudioState>) => void;

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
        onStateChange: (s: Partial<AudioState>) => this.notifySubscribers(s),
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

  private notifySubscribers(state: Partial<AudioState>) {
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

  private pickTrackUrl(track: TrackWithSources): string | null {
    const candidate = track.audioUrl ?? track.downloadUrl ?? track.previewUrl ?? null;
    if (typeof candidate !== 'string' || candidate.trim() === '') return null;
    return candidate;
  }

  private getTrackArtist(track: TrackWithSources): string {
    const artistFromArray = Array.isArray(track.artists) && track.artists.length > 0 ? track.artists[0]?.name : undefined;
    if (typeof track.artist === 'string' && track.artist.trim() !== '') return track.artist;
    if (typeof artistFromArray === 'string' && artistFromArray.trim() !== '') return artistFromArray;
    return 'Unknown Artist';
  }

  private getTrackCover(track: TrackWithSources): string {
    const candidates = [track.coverArt, track.coverImage, track.album?.cover];
    const first = candidates.find((c) => typeof c === 'string' && c.trim() !== '') as string | undefined;
    return first ?? '';
  }

  private getTrackTitle(track: TrackWithSources): string {
    const title = typeof track.title === 'string' ? track.title.trim() : '';
    if (title !== '') return title;
    const nameValue = typeof (track as { name?: string | null }).name === 'string'
      ? ((track as { name?: string | null }).name ?? '').trim()
      : '';
    if (nameValue !== '') return nameValue;
    return 'Untitled';
  }

  async setPlaylist(playlist: Track[], startIndex = 0, autoPlay = false) {
    this.playlist = Array.isArray(playlist) ? playlist : [];
    if (this.playlist.length === 0) return;
    const initialTrack = this.playlist[startIndex] ?? this.playlist[0];
    this.currentTrack = initialTrack ?? null;
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
      handleNext: (_reason?: 'auto'|'manual') => this.handleNext(_reason),
      handlePrevious: () => this.handlePrevious(),
      getAnalyserNode: () => this.getAnalyserNode(),
      seek: (time: number) => this.seek(time),
      isPlaying: () => this.isPlaying,
      currentTime: () => this.currentTime,
      duration: () => this.duration,
      volume: () => this.volume,
      formatTime: (s: number) => {
        if (s === undefined || s === null) return '0:00';
        const minutes = Math.floor(s / 60);
        const seconds = Math.floor(s % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
      },
      setVolume: (v: number) => this.setVolume(v),
      setEqBands: (bands: { bass: number; mid: number; treble: number }) => this.setEqBands(bands),
      invalidateWallSession: (_reason?: string) => {/* noop for now */},
    };
  }

  private setVolume(v: number) {
    this.volume = v;
    if (this.engine !== null) this.engine.setVolume(v);
    this.notifySubscribers({ volume: v });
  }

  private setEqBands(bands: { bass: number; mid: number; treble: number }) {
    if (this.engine === null) return;
    this.engine.setEQ(bands.bass, bands.mid, bands.treble);
    this.notifySubscribers({ eqBands: bands });
  }

  private async loadCurrentTrack(opts: { play?: boolean } = {}) {
    if (this.currentTrack === null) return;
    const id = this.currentTrack.id;
    const urlFromTrack = this.pickTrackUrl(this.currentTrack as TrackWithSources);
    let url: string | null = urlFromTrack;
    if (url === null) {
      try {
        url = await musicService.getStreamUrl(id);
        if (typeof url === 'string' && url.trim() !== '') {
          // Cache the resolved URL back to the track object to avoid repeated service calls
          const ct = this.currentTrack as TrackWithSources;
          ct.audioUrl = url;
        }
      } catch (err) {
        console.warn('audioController failed to resolve stream url for', id, err);
      }
    }
    if (url === null || isPlaceholderAudioUrl(url)) {
      // No stream resolvable for this track — notify subscribers and throw so the caller can handle UI
      this.notifySubscribers({ error: 'No preview available for this track' });
      throw new Error('No preview available');
    }
    if (this.engine === null) {
      // If engine is missing, we can fall back to a hidden HTMLAudioElement per subscriber's choice
      this.notifySubscribers({ error: 'No audio engine available' });
      return;
    }

    try {
      await this.engine.loadTrack({ url: url, id });
      this.notifySubscribers({ currentTrack: this.currentTrack });
      if (opts.play === true) {
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
        trackTitle: this.getTrackTitle(track),
        artistName: this.getTrackArtist(track as TrackWithSources),
        coverArt: this.getTrackCover(track as TrackWithSources),
        audioUrl: this.pickTrackUrl(track as TrackWithSources) ?? '',
        playedAt: Date.now(),
      });
    } catch (e) {
      /* ignore tracking errors */
    }
  }

  play() {
    if (this.engine === null) return;
    this.engine.play();
    this.isPlaying = true;
    this.notifySubscribers({ isPlaying: true });
  }

  pause() {
    if (this.engine === null) return;
    this.engine.pause();
    this.isPlaying = false;
    this.notifySubscribers({ isPlaying: false });
  }

  togglePlayPause() {
    if (this.engine === null) return; // fallback could be separate
    if (this.isPlaying) this.pause(); else this.play();
  }

  handleNext(_reason?: 'auto' | 'manual') {
    if (this.playlist.length === 0) return;
    if (this.currentTrack === null) return;
    const idx = this.playlist.findIndex(t => t.id === this.currentTrack.id);
    const nextIdx = (idx + 1) % this.playlist.length;
    const nextTrack = this.playlist[nextIdx];
    if (nextTrack === undefined) return;
    this.currentTrack = nextTrack;
    void this.loadCurrentTrack({ play: true });
    this.notifySubscribers({ currentTrack: this.currentTrack, isPlaying: this.isPlaying });
    return;
  }

  seek(time: number) {
    if (this.engine === null) return;
    try {
      this.engine.seek(time);
      this.notifySubscribers({ currentTime: time });
    } catch (err) {
      console.warn('AudioController seek failed', err);
    }
  }

  handlePrevious() {
    if (this.playlist.length === 0) return;
    if (this.currentTrack === null) return;
    const idx = this.playlist.findIndex(t => t.id === this.currentTrack.id);
    const prevIdx = (idx - 1 + this.playlist.length) % this.playlist.length;
    const prevTrack = this.playlist[prevIdx];
    if (prevTrack === undefined) return;
    this.currentTrack = prevTrack;
    void this.loadCurrentTrack({ play: true });
    this.notifySubscribers({ currentTrack: this.currentTrack, isPlaying: this.isPlaying });
    return;
  }
}

export const audioController = new AudioController();
export default audioController;
