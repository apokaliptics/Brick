import { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Link2 } from 'lucide-react';
import { Track } from '../types';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface PlayerProps {
  track: Track;
  connectionName?: string;
  isPlaying: boolean;
  onPlayPause: () => void;
}

export function Player({ track, connectionName, isPlaying, onPlayPause }: PlayerProps) {
  const [progress, setProgress] = useState(45); // Mock progress

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
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

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Status Bar */}
        {connectionName && (
          <div
            className="mb-6 px-4 py-2 rounded-full mx-auto w-fit"
            style={{
              backgroundColor: 'rgba(84, 110, 122, 0.2)',
              border: '1px solid #546e7a',
            }}
          >
            <div className="flex items-center gap-2">
              <Link2 size={14} color="#546e7a" />
              <span className="mono" style={{ color: '#546e7a', fontSize: '0.75rem' }}>
                Ad-Free via Connection: {connectionName}
              </span>
            </div>
          </div>
        )}

        {/* Album Art */}
        <div
          className="mb-8 rounded-lg overflow-hidden mx-auto"
          style={{
            width: '280px',
            height: '280px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
          }}
        >
          <ImageWithFallback
            src={track.coverArt}
            alt={track.album}
            className="w-full h-full object-cover"
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
          <p style={{ color: '#a0a0a0' }}>{track.artist}</p>
          <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>{track.album}</p>
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
                width: `${progress}%`,
                background: 'linear-gradient(to right, #d32f2f, #b71c1c)',
                boxShadow: '0 0 10px rgba(211, 47, 47, 0.5)',
              }}
            />
          </div>
          <div className="flex justify-between mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
            <span>2:03</span>
            <span>{track.duration}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-8">
          <button className="transition-transform hover:scale-110">
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
          
          <button className="transition-transform hover:scale-110">
            <SkipForward size={28} color="#e0e0e0" />
          </button>
        </div>
      </div>
    </div>
  );
}