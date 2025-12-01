import { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Link2, X, ChevronLeft, ChevronRight, Crown, Users } from 'lucide-react';
import { Track } from '../types';
import { lastFmService, type LastFmArtistInfo } from '../utils/lastfm';

interface PlayerV3Props {
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
}

// Helper function to format duration
const formatDuration = (duration: string | number): string => {
  if (typeof duration === 'string') {
    if (duration.includes(':')) return duration;
    const secs = parseFloat(duration);
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  } else {
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
};

type PlayerView = 'lyrics' | 'playing' | 'bio';

export function PlayerV3({ 
  track, 
  connectionName, 
  isPlaying, 
  onPlayPause, 
  onClose, 
  isPatronageUnlock = false, 
  onArtistClick,
  onNext,
  onPrevious,
  currentTime = 0,
  duration = 0,
  formatTime = (s: number) => '0:00',
}: PlayerV3Props) {
  const [progress, setProgress] = useState(45);
  const [activeView, setActiveView] = useState<PlayerView>('playing');
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);



  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      // Swipe left
      if (activeView === 'lyrics') setActiveView('playing');
      else if (activeView === 'playing') setActiveView('bio');
    }
    if (touchStart - touchEnd < -75) {
      // Swipe right
      if (activeView === 'bio') setActiveView('playing');
      else if (activeView === 'playing') setActiveView('lyrics');
    }
  };

  const goLeft = () => {
    if (activeView === 'bio') setActiveView('playing');
    else if (activeView === 'playing') setActiveView('lyrics');
  };

  const goRight = () => {
    if (activeView === 'lyrics') setActiveView('playing');
    else if (activeView === 'playing') setActiveView('bio');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Blurred Background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${track.coverArt})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(80px) brightness(0.4)',
        }}
      />

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-0 left-6 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <X size={20} color="#e0e0e0" />
        </button>

        {/* Veracity Bar - Status showing why ad-free */}
        {(connectionName || isPatronageUnlock) && (
          <div
            className="mb-8 mt-4 px-4 py-3 rounded-full mx-auto w-fit"
            style={{
              backgroundColor: isPatronageUnlock 
                ? 'rgba(211, 47, 47, 0.2)' 
                : 'rgba(84, 110, 122, 0.2)',
              border: `1px solid ${isPatronageUnlock ? '#d32f2f' : '#546e7a'}`,
            }}
          >
            <div className="flex items-center gap-2">
              {isPatronageUnlock ? (
                <>
                  <Crown size={14} color="#d32f2f" />
                  <span className="mono" style={{ color: '#d32f2f', fontSize: '0.75rem' }}>
                    AD-FREE VIA PATRONAGE
                  </span>
                </>
              ) : (
                <>
                  <Users size={14} color="#546e7a" />
                  <span className="mono" style={{ color: '#546e7a', fontSize: '0.75rem' }}>
                    AD-FREE VIA BOND: {connectionName?.toUpperCase()}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Swipeable Container - Album + Content Views */}
        <div
          className="relative"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Arrow Indicators */}
          {activeView !== 'lyrics' && (
            <button
              onClick={goLeft}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <ChevronLeft size={24} color="#e0e0e0" />
            </button>
          )}
          
          {activeView !== 'bio' && (
            <button
              onClick={goRight}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <ChevronRight size={24} color="#e0e0e0" />
            </button>
          )}

          {/* Content Views - Same size as album art */}
          <div className="relative" style={{ width: '280px', height: '280px', margin: '0 auto' }}>
            {/* Lyrics View */}
            {activeView === 'lyrics' && (
              <div
                className="absolute inset-0 fade-in p-6 rounded-lg overflow-y-auto"
                style={{
                  backgroundColor: 'rgba(30, 30, 30, 0.9)',
                  backdropFilter: 'blur(40px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
                }}
              >
                <h4 className="mb-4 text-center" style={{ color: '#e0e0e0', fontSize: '0.875rem' }}>
                  LYRICS
                </h4>
                <pre
                  className="whitespace-pre-wrap text-center"
                  style={{
                    color: '#cccccc',
                    fontSize: '0.75rem',
                    lineHeight: '1.6',
                    fontFamily: "'SF Pro Text', 'Inter', sans-serif",
                  }}
                >
                  {lyrics}
                </pre>
              </div>
            )}

            {/* Now Playing View - Album Art */}
            {activeView === 'playing' && (
              <div className="absolute inset-0 fade-in relative">
                <img
                  key={track.id}
                  src={track.coverArt}
                  alt={track.album}
                  className="w-full h-full object-cover rounded-lg"
                  style={{
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
                  }}
                />
              </div>
            )}

            {/* Artist Bio View */}
            {activeView === 'bio' && (
              <div
                className="absolute inset-0 fade-in p-6 rounded-lg overflow-y-auto"
                style={{
                  backgroundColor: 'rgba(30, 30, 30, 0.9)',
                  backdropFilter: 'blur(40px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
                }}
              >
                <div className="text-center mb-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-3">
                    <img
                      src={artistInfo?.image || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200"}
                      alt={track.artist}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h4 className="mb-1" style={{ color: '#e0e0e0', fontSize: '0.875rem' }}>
                    {track.artist}
                  </h4>
                </div>
                <p
                  style={{
                    color: '#cccccc',
                    fontSize: '0.75rem',
                    lineHeight: '1.5',
                  }}
                >
                  {artistInfo?.bio || defaultArtistBio}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* View Indicator - Below the swipeable area */}
        <div className="flex justify-center gap-2 my-6">
          <div
            className="w-2 h-2 rounded-full transition-all duration-200"
            style={{
              backgroundColor: activeView === 'lyrics' ? '#d32f2f' : 'rgba(224, 224, 224, 0.3)',
            }}
          />
          <div
            className="w-2 h-2 rounded-full transition-all duration-200"
            style={{
              backgroundColor: activeView === 'playing' ? '#d32f2f' : 'rgba(224, 224, 224, 0.3)',
            }}
          />
          <div
            className="w-2 h-2 rounded-full transition-all duration-200"
            style={{
              backgroundColor: activeView === 'bio' ? '#d32f2f' : 'rgba(224, 224, 224, 0.3)',
            }}
          />
        </div>

        {/* Track Info */}
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <h2 style={{ color: '#e0e0e0' }}>{track.title}</h2>
            {track.quality === 'FLAC' && (
              <span
                className="mono px-2 py-0.5 rounded"
                style={{
                  backgroundColor: 'rgba(198, 167, 0, 0.2)',
                  color: '#c6a700',
                  fontSize: '0.65rem',
                  border: '1px solid #c6a700',
                }}
              >
                24-BIT
              </span>
            )}
          </div>
          
          {/* Clickable Artist Name */}
          <button
            onClick={() => {
              if (onArtistClick) {
                onArtistClick();
              }
            }}
            className="transition-all duration-200 hover:scale-105 cursor-pointer block w-full"
          >
            <p style={{ color: '#a0a0a0' }}>{track.artist}</p>
          </button>
          
          {/* Clickable Album Name */}
          <button
            onClick={() => {
              if (onArtistClick) {
                onArtistClick();
              }
            }}
            className="transition-all duration-200 hover:scale-105 cursor-pointer block w-full"
          >
            <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>{track.album}</p>
          </button>

          {/* Quality/Bit-rate Info */}
          <div className="flex items-center justify-center gap-2 mt-1">
            <span
              className="mono px-2 py-0.5 rounded"
              style={{
                backgroundColor: track.quality === 'FLAC' ? 'rgba(198, 167, 0, 0.2)' : 'rgba(84, 110, 122, 0.2)',
                color: track.quality === 'FLAC' ? '#c6a700' : '#546e7a',
                fontSize: '0.65rem',
                border: `1px solid ${track.quality === 'FLAC' ? '#c6a700' : '#546e7a'}`,
              }}
            >
              {track.quality || 'MP3'}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div
            className="w-full rounded-full h-1 mb-2 cursor-pointer"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
          >
            <div
              className="h-1 rounded-full transition-all"
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                background: 'linear-gradient(to right, #d32f2f, #b71c1c)',
                boxShadow: '0 0 10px rgba(211, 47, 47, 0.5)',
              }}
            />
          </div>
          <div className="flex justify-between mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatDuration(track.duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-8">
          <button 
            onClick={onPrevious}
            className="transition-transform hover:scale-110"
          >
            <SkipBack size={28} color="#e0e0e0" />
          </button>
          
          <button
            onClick={onPlayPause}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(to bottom, #d32f2f, #b71c1c)',
              boxShadow: '0 4px 16px rgba(211, 47, 47, 0.4)',
            }}
          >
            {isPlaying ? (
              <Pause size={28} color="#e0e0e0" fill="#e0e0e0" />
            ) : (
              <Play size={28} color="#e0e0e0" fill="#e0e0e0" />
            )}
          </button>
          
          <button 
            onClick={onNext}
            className="transition-transform hover:scale-110"
          >
            <SkipForward size={28} color="#e0e0e0" />
          </button>
        </div>
      </div>
    </div>
  );
}