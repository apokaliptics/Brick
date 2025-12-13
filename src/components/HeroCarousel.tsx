/* eslint-disable */
import { useState, useEffect } from 'react';
import { Artist } from '../types';
import { Crown } from 'lucide-react';

interface HeroCarouselProps {
  artists: Artist[];
  onArtistPress: (artistId: string) => void;
}

export function HeroCarousel({ artists, onArtistPress }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
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
      setCurrentIndex((prev) => (prev + 1) % artists.length);
    }
    if (touchStart - touchEnd < -75) {
      // Swipe right
      setCurrentIndex((prev) => (prev - 1 + artists.length) % artists.length);
    }
  };

  const currentArtist = artists[currentIndex];

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: '40vh', minHeight: '320px', maxHeight: '450px' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Artist Cards - Swipeable */}
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{
          transform: `translateX(-${currentIndex * 100}%)`,
        }}
      >
        {artists.map((artist) => (
          <div
            key={artist.id}
            className="w-full flex-shrink-0 relative cursor-pointer"
            onClick={() => onArtistPress(artist.id)}
          >
            {/* Background Image with Parallax Effect */}
            <div
              className="absolute inset-0 transition-transform duration-700"
              style={{
                transform: `scale(${currentIndex === artists.indexOf(artist) ? 1 : 1.1})`,
              }}
            >
              <img
                src={artist.image}
                alt={artist.name}
                className="w-full h-full object-cover"
                style={{
                  filter: 'grayscale(20%) brightness(0.5)',
                }}
              />
            </div>

            {/* Gradient Overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 70%)',
              }}
            />

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="mb-4">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: 'rgba(211, 47, 47, 0.2)',
                    border: '1px solid #d32f2f',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <Crown size={14} color="#d32f2f" />
                  <span
                    className="mono"
                    style={{
                      color: '#d32f2f',
                      fontSize: '0.7rem',
                      letterSpacing: '0.05em',
                    }}
                  >
                    CHOSEN ARTIST
                  </span>
                </div>
              </div>

              <h2 className="mb-2" style={{ fontSize: '2.5rem', color: '#e0e0e0' }}>
                {artist.name}
              </h2>

              <p className="mb-4" style={{ color: '#cccccc', fontSize: '1rem' }}>
                {artist.genre}
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Prominent Revenue Share Badge */}
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
                  style={{
                    backgroundColor: '#d32f2f',
                    boxShadow: '0 0 20px rgba(211, 47, 47, 0.6), 0 0 40px rgba(211, 47, 47, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: '#ffffff' }}
                  />
                  <span
                    className="mono"
                    style={{
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                    }}
                  >
                    80% REVENUE SHARE ACTIVE
                  </span>
                </div>
              </div>

              <p className="mono mt-3" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
                TAP TO PLAY ESSENTIALS • HOLD TO VIEW PROFILE
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Dots */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
        {artists.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className="transition-all duration-200"
            style={{
              width: currentIndex === index ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              backgroundColor: currentIndex === index ? '#e0e0e0' : 'rgba(224, 224, 224, 0.3)',
            }}
          />
        ))}
      </div>
    </div>
  );
}