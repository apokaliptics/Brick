import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, Repeat, Sliders, Volume2, ChevronDown } from 'lucide-react';
import type { Track } from '../types';
import { formatBitrate } from '../utils/audioMetaHelpers';
import { useTrackAudioMeta } from '../hooks/useTrackAudioMeta';
import { lastFmService, type LastFmArtistInfo, type LastFmAlbumInfo } from '../utils/lastfm';

type PlayerView = 'bio' | 'cover' | 'lyrics';

interface PlayerAppleProps {
  track: Track;
  connectionName?: string;
  isPlaying: boolean;
  onPlayPause: () => void;
  onClose: () => void;
  isPatronageUnlock?: boolean;
  onArtistClick?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  currentTime?: number;
  duration?: number;
  formatTime?: (seconds: number) => string;
  onVolumeChange?: (v: number) => void;
  onEqChange?: (bands: EqBands) => void;
  volumeLevel?: number;
  eqBands?: EqBands;
}

const parseLRC = (lrcString: string) => {
  const lines = lrcString.split('\n');
  const result: { time: number; text: string }[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const timeRegex = new RegExp("\\[(\\d{2}):(\\d{2})(?:\\.(\\d{2,3}))?\\]", "g");
    const matches = [...trimmed.matchAll(timeRegex)];
    if (matches.length === 0) continue;
    const text = trimmed.replace(timeRegex, '').trim();
    matches.forEach((match) => {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millis = match[3] ? parseInt(match[3], 10) : 0;
      const divisor = match[3]?.length === 3 ? 1000 : 100;
      const time = minutes * 60 + seconds + millis / divisor;
      result.push({ time, text });
    });
  }
  return result.sort((a, b) => a.time - b.time);
};

type EqBands = { low: number; mid: number; high: number };

const fetchWikipediaAlbumSummary = async (artist: string, albumTitle: string) => {
  if (!albumTitle) return null;
  const sanitizer = typeof lastFmService.sanitizeTitle === 'function'
    ? lastFmService.sanitizeTitle.bind(lastFmService)
    : (value: string) => value;
  const cleaned = sanitizer(albumTitle);
  const normalizedArtist = artist?.trim();
  const candidates = [
    albumTitle,
    cleaned,
    cleaned ? `${cleaned} (album)` : '',
    cleaned && normalizedArtist ? `${cleaned} (${normalizedArtist} album)` : '',
  ].filter((value): value is string => Boolean(value && value.trim()));

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate)}`);
      if (!response.ok) {
        continue;
      }
      const data = await response.json();
      if (data?.extract) {
        return {
          title: typeof data.title === 'string' ? data.title : candidate,
          summary: data.extract as string,
          image: data.thumbnail?.source as string | undefined,
        };
      }
    } catch (error) {
      console.error('Wikipedia album summary fetch failed:', error);
    }
  }
  return null;
};

export function PlayerApple({
  track,
  isPlaying,
  onPlayPause,
  onClose,
  onArtistClick,
  onNext,
  onPrevious,
  currentTime = 0,
  duration = 0,
  formatTime = (s: number) => '0:00',
  onVolumeChange,
  onEqChange,
  volumeLevel = 1,
  eqBands: externalEqBands,
}: PlayerAppleProps): JSX.Element {
  const [activeView, setActiveView] = useState<PlayerView>('cover');
  const [localIsPlaying, setLocalIsPlaying] = useState(isPlaying);
  const audioMeta = useTrackAudioMeta(track);
  const [artistInfo, setArtistInfo] = useState<LastFmArtistInfo | null>(null);
  const [albumInfo, setAlbumInfo] = useState<LastFmAlbumInfo | null>(null);
  const [isLoadingBio, setIsLoadingBio] = useState(false);
  const [isLoadingAlbum, setIsLoadingAlbum] = useState(false);

  const [lyrics, setLyrics] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const [volumePercent, setVolumePercent] = useState<number>(Math.round(Math.max(0, Math.min(1, volumeLevel)) * 100));
  const [eq, setEq] = useState<EqBands>({
    low: externalEqBands?.low ?? 0,
    mid: externalEqBands?.mid ?? 0,
    high: externalEqBands?.high ?? 0,
  });
  const [showEQ, setShowEQ] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  useEffect(() => setLocalIsPlaying(isPlaying), [isPlaying]);

  useEffect(() => {
    setVolumePercent(Math.round(Math.max(0, Math.min(1, volumeLevel)) * 100));
  }, [volumeLevel]);

  useEffect(() => {
    if (!externalEqBands) return;
    setEq({
      low: externalEqBands.low ?? 0,
      mid: externalEqBands.mid ?? 0,
      high: externalEqBands.high ?? 0,
    });
  }, [externalEqBands]);

  useEffect(() => {
    const fetchArtistData = async () => {
      if (!track.artist) return;
      setIsLoadingBio(true);
      try {
        const info = await lastFmService.getArtistInfo(track.artist);
        setArtistInfo(info);
      } catch (e) {
        console.error('Failed to fetch artist info:', e);
      } finally {
        setIsLoadingBio(false);
      }
    };

    const fetchAlbumData = async () => {
      const albumTitle = (track as any).album;
      if (!track.artist || !albumTitle) {
        setAlbumInfo(null);
        return;
      }
      setIsLoadingAlbum(true);
      try {
        let info: LastFmAlbumInfo | null = null;
        try {
          // Use loose resolver for remasters/variants
          info = await lastFmService.getAlbumInfoLoose(track.artist, albumTitle, track.title);
        } catch (error) {
          console.error('Failed to fetch album info:', error);
        }

        if (info?.summary) {
          setAlbumInfo(info);
          return;
        }

        const wikiFallback = await fetchWikipediaAlbumSummary(track.artist, albumTitle);
        if (wikiFallback) {
          setAlbumInfo({
            title: info?.title || wikiFallback.title || albumTitle,
            artist: info?.artist || track.artist,
            summary: wikiFallback.summary,
            image: info?.image || wikiFallback.image,
            tracks: info?.tracks,
          });
          return;
        }

        setAlbumInfo(info);
      } finally {
        setIsLoadingAlbum(false);
      }
    };

    const fetchLyrics = async () => {
      if (!track.artist || !track.title) return;
      setIsLoadingLyrics(true);
      setLyrics(null);
      setIsSynced(false);
      try {
        const trackDuration = (track as any).duration || (duration > 0 ? duration : 0);
        let url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(track.artist)}&track_name=${encodeURIComponent(track.title)}`;
        if (trackDuration > 0) url += `&duration=${Math.round(trackDuration)}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.syncedLyrics) {
            setLyrics(data.syncedLyrics);
            setIsSynced(true);
          } else if (data.plainLyrics) {
            setLyrics(data.plainLyrics);
            setIsSynced(false);
          } else {
            setLyrics(null);
          }
        }
      } catch (e) {
        console.error('Failed to fetch lyrics from LRCLIB:', e);
        setLyrics(null);
      } finally {
        setIsLoadingLyrics(false);
      }
    };

    fetchArtistData();
    fetchAlbumData();
    fetchLyrics();
  }, [track.artist, track.title, track, duration]);

  const parsedLyrics = useMemo(() => {
    if (!lyrics || !isSynced) return [];
    return parseLRC(lyrics);
  }, [lyrics, isSynced]);

  const activeIndex = useMemo(() => {
    if (!isSynced || parsedLyrics.length === 0) return -1;
    return parsedLyrics.findIndex((line, idx) => {
      const nextLine = parsedLyrics[idx + 1];
      return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
    });
  }, [currentTime, parsedLyrics, isSynced]);

  useEffect(() => {
    if (activeView === 'lyrics' && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex, activeView]);

  const defaultLyrics = `In the depths of concrete walls
Where the echoes softly call
Building dreams from brick and stone
Finding strength we've always known

Industrial soundscapes fill the air
Melodies beyond compare`;

  const defaultArtistBio = 'No artist bio available.';

  const goToView = (view: PlayerView) => setActiveView(view);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      {/* Fixed-size modal box to prevent overflow */}
      <div style={{ width: '92%', maxWidth: '980px', height: '85vh', background: '#111', borderRadius: '16px', border: '1px solid #333', color: '#e0e0e0', fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar sections */}
        <div style={{ position: 'relative', padding: '16px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '24px', flex: '0 0 auto' }}>
          {/* Volume on left */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
            <Volume2 size={16} color="#bbb" />
            <input
              type="range"
              min={0}
              max={100}
              value={volumePercent}
              onChange={(e) => { const v = Number(e.target.value); setVolumePercent(v); onVolumeChange?.(v / 100); }}
              style={{ width: '180px', maxWidth: '45vw', accentColor: '#d32f2f' }}
            />
            <span style={{ fontSize: '0.85rem', color: '#bbb', whiteSpace: 'nowrap' }}>{Math.round(volumePercent)}%</span>
          </div>

          {/* Transport centered */}
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
            <button onClick={onPrevious} style={{ background: 'none', border: '1px solid #444', borderRadius: '50%', width: '48px', height: '48px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SkipBack size={22} color="#e0e0e0" />
            </button>
            <button
              onClick={() => { setLocalIsPlaying(!localIsPlaying); onPlayPause(); }}
              style={{ background: '#d32f2f', border: 'none', borderRadius: '50%', width: '72px', height: '72px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(211,47,47,0.4)' }}
            >
              {localIsPlaying ? (
                <Pause size={30} color="#ffffff" />
              ) : (
                <Play size={30} color="#ffffff" />
              )}
            </button>
            <button onClick={onNext} style={{ background: 'none', border: '1px solid #444', borderRadius: '50%', width: '48px', height: '48px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SkipForward size={22} color="#e0e0e0" />
            </button>
          </div>

          {/* EQ + loop on right */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => setShowEQ(!showEQ)}
              title={showEQ ? 'Hide equalizer' : 'Show equalizer'}
              style={{ background: 'none', border: showEQ ? '1px solid #d32f2f' : '1px solid #444', color: showEQ ? '#d32f2f' : '#a0a0a0', borderRadius: '12px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Sliders size={16} />
            </button>
            <button
              onClick={() => setIsLooping(!isLooping)}
              title={isLooping ? 'Disable Loop' : 'Enable Loop'}
              style={{ background: 'none', border: isLooping ? '1px solid #d32f2f' : '1px solid #444', color: isLooping ? '#d32f2f' : '#a0a0a0', borderRadius: '12px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <Repeat size={16} />
            </button>
          </div>

          <div style={{ position: 'absolute', right: 12, top: 12, display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Minimize">
              <ChevronDown size={20} color="#e0e0e0" />
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Close">
              <X size={20} color="#e0e0e0" />
            </button>
          </div>
        </div>

        {/* EQ Dropdown (minimizable) */}
        {showEQ && (
          <div style={{ position: 'relative', flex: '0 0 auto' }}>
            <div style={{ margin: '0 24px 8px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '12px', boxShadow: '0 12px 24px rgba(0,0,0,0.35)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="mono" style={{ color: '#e0e0e0', fontSize: '0.8rem', fontWeight: 600 }}>EQUALIZER</span>
                <button
                  onClick={() => {
                    const reset = { low: 0, mid: 0, high: 0 } as EqBands;
                    setEq(reset);
                    onEqChange?.(reset);
                  }}
                  style={{ background: 'none', border: '1px solid #444', color: '#a0a0a0', borderRadius: '10px', padding: '4px 8px', cursor: 'pointer' }}
                >
                  Reset
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '10px', alignItems: 'center' }}>
                <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>Bass</span>
                <input type="range" min={-12} max={12} value={eq.low}
                  onChange={(e) => { const val = Number(e.target.value); const next = { ...eq, low: val }; setEq(next); onEqChange?.(next); }}
                  style={{ width: '100%', accentColor: '#d32f2f' }}
                />
                <span className="mono" style={{ color: '#e0e0e0', fontSize: '0.7rem' }}>{eq.low} dB</span>

                <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>Mid</span>
                <input type="range" min={-12} max={12} value={eq.mid}
                  onChange={(e) => { const val = Number(e.target.value); const next = { ...eq, mid: val }; setEq(next); onEqChange?.(next); }}
                  style={{ width: '100%', accentColor: '#d32f2f' }}
                />
                <span className="mono" style={{ color: '#e0e0e0', fontSize: '0.7rem' }}>{eq.mid} dB</span>

                <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>Treble</span>
                <input type="range" min={-12} max={12} value={eq.high}
                  onChange={(e) => { const val = Number(e.target.value); const next = { ...eq, high: val }; setEq(next); onEqChange?.(next); }}
                  style={{ width: '100%', accentColor: '#d32f2f' }}
                />
                <span className="mono" style={{ color: '#e0e0e0', fontSize: '0.7rem' }}>{eq.high} dB</span>
              </div>
            </div>
          </div>
        )}


        {/* Content area scrolls inside fixed box */}
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '24px', padding: '16px', overflow: 'hidden', flex: '1 1 auto' }}>
          {/* Left: Cover */}
          <div style={{ width: '240px', height: '240px', borderRadius: '16px', overflow: 'hidden', background: '#222', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <img src={track.coverArt || (track as any).coverImage || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400'} alt={(track as any).album || 'Cover'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          {/* Right: Info + Views */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>
            {/* Track header */}
            <div style={{ flex: '0 0 auto' }}>
              <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 500, letterSpacing: '-0.02em', fontFamily: "'Syne', 'Inter', sans-serif" }}>{(track as any).title || (track as any).name || 'Untitled'}</h2>
              <button onClick={onArtistClick} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 500, letterSpacing: '-0.02em', fontFamily: "'Syne', 'Inter', sans-serif" }}>{(track as any).artist}</button>
              <p style={{ marginTop: '4px', color: '#888', fontFamily: "'Syne', 'Inter', sans-serif", fontWeight: 500, letterSpacing: '-0.02em' }}>{(track as any).album || ''}</p>
              {/* Audio meta chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                {audioMeta?.codecLabel && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px', height: '26px', borderRadius: '8px', border: '1px solid #333', background: 'rgba(26,26,26,0.6)', fontSize: '0.9rem', color: '#e0e0e0', fontFamily: 'JetBrains Mono, Space Mono, monospace' }}>{String(audioMeta.codecLabel).toUpperCase()}</span>
                )}
                {(audioMeta?.bitDepth || audioMeta?.sampleRate) && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '26px', borderRadius: '8px', border: '1px solid #333', background: 'rgba(26,26,26,0.6)', padding: '0 10px', fontSize: '0.9rem', fontFamily: 'JetBrains Mono, Space Mono, monospace', color: '#e0e0e0' }}>
                    <span style={{ color: audioMeta?.bitDepth === 24 ? '#c6a700' : '#a0a0a0' }}>{audioMeta?.bitDepth ? String(audioMeta.bitDepth) + '-bit' : ''}</span>
                    <span style={{ color: '#555' }}>{'/'}</span>
                    <span style={{ color: '#d32f2f' }}>{audioMeta?.sampleRate ? String(audioMeta.sampleRate) + 'kHz' : ''}</span>
                  </span>
                )}
                {audioMeta?.bitrateKbps && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px', height: '26px', borderRadius: '8px', border: '1px solid #333', background: 'rgba(26,26,26,0.6)', fontSize: '0.9rem', fontFamily: 'JetBrains Mono, Space Mono, monospace', color: '#e0e0e0' }}>{formatBitrate(audioMeta.bitrateKbps)}</span>
                )}
              </div>
            </div>

            {/* Progress */}
            <div style={{ flex: '0 0 auto' }}>
              <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '2px', marginBottom: '6px' }}>
                <div style={{ height: '4px', backgroundColor: '#d32f2f', borderRadius: '2px', width: String(duration > 0 ? (currentTime / duration) * 100 : 0) + '%', transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#a0a0a0' }}>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Views */}
            {/* Views container with its own scroll when needed */}
            <div style={{ width: '100%', minHeight: '320px', overflowY: 'auto', padding: '1rem', animation: 'fadeIn 0.3s ease-out', flex: '1 1 auto' }}>
              {/* Bio */}
              {activeView === 'bio' && (
                <div>
                  {/* Artist image */}
                  <div style={{ width: '160px', height: '160px', borderRadius: '50%', overflow: 'hidden', marginBottom: '1rem', boxShadow: '0 16px 32px rgba(0,0,0,0.3)' }}>
                    <img src={artistInfo?.image || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400'} alt={(track as any).artist} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <h3 style={{ fontWeight: 500, color: '#e0e0e0', marginBottom: '0.75rem', letterSpacing: '-0.02em', fontFamily: "'Syne', 'Inter', sans-serif" }}>{(track as any).artist}</h3>
                  <div style={{ color: '#a0a0a0', fontSize: '1rem', lineHeight: 1.75, textAlign: 'left' }}>
                    {isLoadingBio ? (
                      <div>
                        <div style={{ height: '1rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem', marginBottom: '0.5rem' }} />
                        <div style={{ height: '1rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem', marginBottom: '0.5rem' }} />
                        <div style={{ height: '1rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem' }} />
                      </div>
                    ) : (
                      <p style={{ textAlign: 'left' }}>{artistInfo?.bio || defaultArtistBio}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Cover */}
              {activeView === 'cover' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ width: '100%', maxWidth: '720px', textAlign: 'left' }}>
                    <h3 style={{ fontWeight: 500, margin: '0.25rem 0', letterSpacing: '-0.02em', fontFamily: "'Syne', 'Inter', sans-serif" }}>{albumInfo?.title || String((track as any).album || 'Album').replace(/[\(\[].*?[\)\]]/g, '').trim()}</h3>
                    {isLoadingAlbum ? (
                      <div>
                        <div style={{ height: '1rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem', marginBottom: '0.5rem' }} />
                        <div style={{ height: '1rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem', marginBottom: '0.5rem' }} />
                      </div>
                    ) : (
                      albumInfo?.summary ? (
                        <p style={{ color: '#a0a0a0' }}>{albumInfo.summary}</p>
                      ) : (
                        <p style={{ color: '#a0a0a0' }}>No album details available.</p>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Lyrics */}
              {activeView === 'lyrics' && (
                <div style={{ color: '#a0a0a0', fontSize: '1.125rem', lineHeight: 1.75, textAlign: 'left', minHeight: '300px', paddingBottom: '3rem' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 500, color: '#e0e0e0', marginBottom: '0.25rem', letterSpacing: '-0.02em', fontFamily: "'Syne', 'Inter', sans-serif" }}>{(track as any).title || (track as any).name || 'Untitled'}</h2>
                    <button onClick={onArtistClick} style={{ fontSize: '1rem', color: '#a0a0a0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, letterSpacing: '-0.02em', fontFamily: "'Syne', 'Inter', sans-serif" }}>{(track as any).artist}</button>
                  </div>

                  {isLoadingLyrics ? (
                    <div>
                      <div style={{ height: '1.5rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem', marginBottom: '1rem' }} />
                      <div style={{ height: '1.5rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem', marginBottom: '1rem' }} />
                      <div style={{ height: '1.5rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem', marginBottom: '1rem' }} />
                      <div style={{ height: '1.5rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '0.25rem' }} />
                    </div>
                  ) : (
                    <>
                      {isSynced && parsedLyrics.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {parsedLyrics.map((line, index) => {
                            const isActive = index === activeIndex;
                            return (
                              <div
                                key={index}
                                ref={isActive ? activeLineRef : null}
                                style={{
                                  color: isActive ? '#ffffff' : '#555555',
                                  transition: 'all 0.3s',
                                  opacity: isActive ? 1 : 0.6,
                                  fontWeight: isActive ? 500 : 300,
                                }}
                              >
                                {line.text || '♪'}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left', fontWeight: 300 }}>
                          {lyrics || defaultLyrics}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* View indicators */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', paddingBottom: '0.5rem', flex: '0 0 auto' }}>
              {(['bio', 'cover', 'lyrics'] as PlayerView[]).map((view) => (
                <button
                  key={view}
                  onClick={() => goToView(view)}
                  style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: activeView === view ? '#ffffff' : 'rgba(255,255,255,0.4)', border: 'none', cursor: 'pointer', transition: 'all 0.3s', transform: activeView === view ? 'scale(1.25)' : 'scale(1)' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
