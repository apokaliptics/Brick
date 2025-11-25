import { useState, useEffect, useRef } from 'react';
import { Crown, Users, ArrowLeft } from 'lucide-react';
import { Artist } from '../../types';
import { BrickCard } from '../BrickCard';
import { mockPlaylists } from '../../data/mockData';

interface ArtistProfileScreenV2Props {
  artist: Artist;
  onClose: () => void;
  onShowPatronageLock?: () => void;
}

export function ArtistProfileScreenV2({ artist, onClose, onShowPatronageLock }: ArtistProfileScreenV2Props) {
  const [scrollY, setScrollY] = useState(0);
  const [isPatron, setIsPatron] = useState(false);
  const [patronSlotLocked, setPatronSlotLocked] = useState(true); // Mock: slot is locked
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        setScrollY(scrollRef.current.scrollTop);
      }
    };

    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const headerOpacity = Math.min(scrollY / 200, 1);
  const imageScale = 1 + scrollY / 2000;
  const imageBlur = Math.min(scrollY / 20, 20);

  const albums = [
    {
      id: 1,
      name: 'Industrial Soundscapes',
      year: 2024,
      image: 'https://images.unsplash.com/photo-1644855640845-ab57a047320e?w=400',
    },
    {
      id: 2,
      name: 'Concrete Dreams',
      year: 2023,
      image: 'https://images.unsplash.com/photo-1757889693310-1e77c6063ba7?w=400',
    },
    {
      id: 3,
      name: 'The Foundation',
      year: 2022,
      image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
    },
  ];

  const handleTogglePatronage = () => {
    if (patronSlotLocked && onShowPatronageLock) {
      onShowPatronageLock();
      return;
    }
    setIsPatron(!isPatron);
    // Simulate haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1a1a1a]">
      {/* Sticky Header Bar (Appears on scroll) */}
      <div
        className="fixed top-0 left-0 right-0 z-50 transition-opacity duration-300"
        style={{
          opacity: headerOpacity,
          pointerEvents: headerOpacity > 0.5 ? 'auto' : 'none',
        }}
      >
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{
            backgroundColor: 'rgba(30, 30, 30, 0.8)',
            backdropFilter: 'blur(40px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <button onClick={onClose} className="p-2 -ml-2">
            <ArrowLeft size={24} color="#e0e0e0" />
          </button>
          <h4 className="truncate" style={{ color: '#e0e0e0' }}>
            {artist.name}
          </h4>
          <div className="w-10" />
        </div>
      </div>

      {/* Scrollable Content */}
      <div ref={scrollRef} className="h-full overflow-y-auto">
        {/* Parallax Header */}
        <div className="relative h-96 overflow-hidden">
          {/* Background Image */}
          <div
            className="absolute inset-0 transition-all duration-100"
            style={{
              transform: `scale(${imageScale}) translateY(${scrollY * 0.5}px)`,
              filter: `grayscale(40%) brightness(0.6) blur(${imageBlur}px)`,
            }}
          >
            <img
              src={artist.image}
              alt={artist.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Gradient Overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, #1a1a1a 0%, transparent 60%)',
            }}
          />

          {/* Back Button (Only visible when header is hidden) */}
          <button
            onClick={onClose}
            className="absolute top-6 left-6 w-10 h-10 rounded-full flex items-center justify-center transition-opacity duration-300"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(10px)',
              opacity: 1 - headerOpacity,
            }}
          >
            <ArrowLeft size={20} color="#e0e0e0" />
          </button>

          {/* Artist Info */}
          <div className="absolute bottom-8 left-6 right-6">
            <h2 className="mb-2" style={{ fontSize: '2.5rem', color: '#e0e0e0' }}>
              {artist.name}
            </h2>
            <p style={{ color: '#cccccc', fontSize: '1.125rem' }}>{artist.genre}</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-24">
          {/* Patronage Toggle */}
          <div
            className="p-6 rounded-2xl mb-6 -mt-6"
            style={{
              backgroundColor: 'rgba(30, 30, 30, 0.8)',
              backdropFilter: 'blur(40px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="mb-1" style={{ color: '#e0e0e0' }}>
                  Monthly Support
                </h4>
                <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
                  {isPatron ? '$8.00/month • 80% to artist' : 'Support this artist directly'}
                </p>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={handleTogglePatronage}
                className="relative transition-all duration-300"
                style={{
                  width: '60px',
                  height: '32px',
                  borderRadius: '16px',
                  backgroundColor: isPatron ? '#d32f2f' : '#333333',
                  boxShadow: isPatron ? '0 0 20px rgba(211, 47, 47, 0.4)' : 'none',
                }}
              >
                <div
                  className="absolute top-1 transition-all duration-300"
                  style={{
                    left: isPatron ? 'calc(100% - 28px)' : '4px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '12px',
                    backgroundColor: '#e0e0e0',
                  }}
                />
              </button>
            </div>

            {/* Toast Message (Appears when toggled on) */}
            {isPatron && (
              <div
                className="mt-4 p-3 rounded-lg spring-in"
                style={{
                  backgroundColor: 'rgba(211, 47, 47, 0.1)',
                  border: '1px solid rgba(211, 47, 47, 0.3)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Crown size={16} color="#d32f2f" />
                  <span style={{ color: '#d32f2f', fontSize: '0.875rem' }}>
                    Payment Allocated • Support Active
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Revenue Dashboard */}
          <div
            className="p-6 rounded-2xl mb-6"
            style={{
              backgroundColor: 'rgba(37, 37, 37, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <h3 className="mb-4" style={{ color: '#e0e0e0' }}>
              Revenue Dashboard
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users size={16} color="#c6a700" />
                  <span
                    className="mono"
                    style={{ color: '#a0a0a0', fontSize: '0.7rem', letterSpacing: '0.05em' }}
                  >
                    GLOBAL PATRONS
                  </span>
                </div>
                <p className="mono" style={{ color: '#e0e0e0', fontSize: '1.75rem' }}>
                  {artist.globalChosenUsers.toLocaleString()}
                </p>
              </div>

              <div>
                <p
                  className="mono mb-2"
                  style={{ color: '#a0a0a0', fontSize: '0.7rem', letterSpacing: '0.05em' }}
                >
                  YOUR CONTRIBUTION
                </p>
                <p className="mono" style={{ color: '#e0e0e0', fontSize: '1.75rem' }}>
                  {isPatron ? '$8.00' : '$0.00'}
                </p>
              </div>
            </div>
          </div>

          {/* Essential Albums */}
          <div className="mb-6">
            <h3 className="mb-4" style={{ color: '#e0e0e0' }}>
              Essential Albums
            </h3>
            <div className="overflow-x-auto -mx-6 px-6">
              <div className="flex gap-4" style={{ width: 'max-content' }}>
                {albums.map((album) => (
                  <div
                    key={album.id}
                    className="cursor-pointer transition-transform duration-200 hover:scale-105"
                    style={{ width: '180px' }}
                  >
                    <img
                      src={album.image}
                      alt={album.name}
                      className="w-full aspect-square rounded-xl mb-3 object-cover"
                    />
                    <h4 className="truncate mb-1" style={{ color: '#e0e0e0' }}>
                      {album.name}
                    </h4>
                    <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                      {album.year}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Bricks */}
          <div>
            <h3 className="mb-4" style={{ color: '#e0e0e0' }}>
              Top Bricks
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockPlaylists.slice(0, 4).map((playlist) => (
                <BrickCard key={playlist.id} playlist={playlist} size="medium" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}