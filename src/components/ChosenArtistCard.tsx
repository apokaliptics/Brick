/* eslint-disable */
import { Artist } from '../types';

interface ChosenArtistCardProps {
  artist: Artist;
  revenueShare?: number;
}

export function ChosenArtistCard({ artist, revenueShare = 80 }: ChosenArtistCardProps) {
  return (
    <div
      className="relative h-64 rounded-lg overflow-hidden cursor-pointer group"
      style={{
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        border: '2px solid #d32f2f',
      }}
    >
      {/* Background Image */}
      <img
        src={artist.image}
        alt={artist.name}
        className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-300"
      />

      {/* Gradient Overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 60%)',
        }}
      />

      {/* Glowing Border Effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 20px rgba(211, 47, 47, 0.3)',
        }}
      />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="mb-2">
          <span
            className="mono px-2 py-1 rounded"
            style={{
              backgroundColor: 'rgba(211, 47, 47, 0.2)',
              color: '#d32f2f',
              fontSize: '0.7rem',
              border: '1px solid #d32f2f',
            }}
          >
            CHOSEN ARTIST
          </span>
        </div>
        <h3 className="mb-2" style={{ color: '#e0e0e0' }}>
          {artist.name}
        </h3>
        <p className="mb-3" style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
          {artist.genre}
        </p>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: '#d32f2f' }}
          />
          <span className="mono" style={{ color: '#e0e0e0', fontSize: '0.8rem' }}>
            {revenueShare}% Revenue Share Active
          </span>
        </div>
      </div>
    </div>
  );
}
