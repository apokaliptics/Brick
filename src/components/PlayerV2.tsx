import { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Link2, X } from 'lucide-react';
import { Track } from '../types';

interface PlayerV2Props {
  track: Track;
  connectionName?: string;
  isPlaying: boolean;
  onPlayPause: () => void;
  onClose: () => void;
}

type PlayerTab = 'playing' | 'lyrics' | 'bio';

export function PlayerV2({ track, connectionName, isPlaying, onPlayPause, onClose }: PlayerV2Props) {
  const [progress, setProgress] = useState(45);
  const [activeTab, setActiveTab] = useState<PlayerTab>('playing');

  // Mock data
  const lyrics = `In the depths of concrete walls
Where the echoes softly call
Building dreams from brick and stone
Finding strength we've always known

Industrial soundscapes fill the air
Melodies beyond compare
In this fortress that we've made
Our foundation will not fade

[Chorus]
Concrete dreams take flight tonight
Through the shadows into light
Every beat a brick we lay
Building futures day by day`;

  const artistBio = `Nora Vex is an electronic music producer known for blending industrial sounds with ethereal melodies. Based in Berlin, she creates atmospheric soundscapes that explore the intersection of urban architecture and human emotion.

Her debut album "Industrial Soundscapes" reached critical acclaim in 2024, with tracks featured in numerous architectural exhibitions and design showcases worldwide.

Influenced by brutalist architecture and ambient techno, Nora's work represents a new wave of "structural sound design" - music that feels as permanent and substantial as the buildings that inspire it.`;

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
          className="mb-6 rounded-lg overflow-hidden mx-auto"
          style={{
            width: '280px',
            height: '280px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
          }}
        >
          <img
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

        {/* Tabs */}
        <div className="mb-6">
          <div
            className="flex gap-1 p-1 rounded-full mx-auto w-fit"
            style={{
              backgroundColor: 'rgba(30, 30, 30, 0.8)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {(['playing', 'lyrics', 'bio'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-5 py-2 rounded-full transition-all duration-200"
                style={{
                  backgroundColor: activeTab === tab ? 'rgba(211, 47, 47, 0.3)' : 'transparent',
                  color: activeTab === tab ? '#e0e0e0' : '#a0a0a0',
                  border: activeTab === tab ? '1px solid #d32f2f' : 'none',
                  fontSize: '0.875rem',
                }}
              >
                {tab === 'playing' && 'Now Playing'}
                {tab === 'lyrics' && 'Lyrics'}
                {tab === 'bio' && 'Artist'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'playing' && (
          <div className="fade-in">
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
        )}

        {activeTab === 'lyrics' && (
          <div
            className="fade-in p-6 rounded-2xl overflow-y-auto"
            style={{
              backgroundColor: 'rgba(30, 30, 30, 0.8)',
              backdropFilter: 'blur(40px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              maxHeight: '400px',
            }}
          >
            <pre
              className="whitespace-pre-wrap text-center"
              style={{
                color: '#cccccc',
                fontSize: '0.875rem',
                lineHeight: '1.8',
                fontFamily: "'SF Pro Text', 'Inter', sans-serif",
              }}
            >
              {lyrics}
            </pre>
          </div>
        )}

        {activeTab === 'bio' && (
          <div
            className="fade-in p-6 rounded-2xl overflow-y-auto"
            style={{
              backgroundColor: 'rgba(30, 30, 30, 0.8)',
              backdropFilter: 'blur(40px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              maxHeight: '400px',
            }}
          >
            <div className="text-center mb-4">
              <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-3">
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200"
                  alt={track.artist}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="mb-1" style={{ color: '#e0e0e0' }}>
                {track.artist}
              </h3>
              <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                ELECTRONIC • BERLIN
              </p>
            </div>
            <p
              style={{
                color: '#cccccc',
                fontSize: '0.875rem',
                lineHeight: '1.6',
              }}
            >
              {artistBio}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
