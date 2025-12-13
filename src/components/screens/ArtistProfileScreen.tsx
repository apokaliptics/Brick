/* eslint-disable */
import { Crown, Users } from 'lucide-react';
import { Artist } from '../../types';

interface ArtistProfileScreenProps {
  artist: Artist;
  onClose: () => void;
}

export function ArtistProfileScreen({ artist, onClose }: ArtistProfileScreenProps) {
  const albums = [
    { id: 1, name: 'Industrial Soundscapes', year: 2024, image: 'https://images.unsplash.com/photo-1644855640845-ab57a047320e?w=400' },
    { id: 2, name: 'Concrete Dreams', year: 2023, image: 'https://images.unsplash.com/photo-1757889693310-1e77c6063ba7?w=400' },
    { id: 3, name: 'The Foundation', year: 2022, image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#1a1a1a] overflow-y-auto pb-24">
      {/* Header Image */}
      <div className="relative h-80">
        <img
          src={artist.image}
          alt={artist.name}
          className="w-full h-full object-cover"
          style={{ filter: 'grayscale(40%) brightness(0.6)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, #1a1a1a 0%, transparent 60%)',
          }}
        />
        
        {/* Back Button */}
        <button
          onClick={onClose}
          className="absolute top-6 left-6 w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <span style={{ color: '#e0e0e0' }}>←</span>
        </button>

        {/* Artist Name */}
        <div className="absolute bottom-6 left-6 right-6">
          <h2 className="mb-2">{artist.name}</h2>
          <p style={{ color: '#a0a0a0' }}>{artist.genre}</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pt-6">
        {/* Patronage Button */}
        <div className="mb-8">
          <button
            className="w-full py-4 rounded-full transition-all hover:scale-[1.02] mb-4"
            style={{
              background: 'linear-gradient(to bottom, #d32f2f, #b71c1c)',
              color: '#e0e0e0',
              boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)',
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <Crown size={20} />
              <span>Choose as Monthly Artist</span>
            </div>
          </button>
          
          <button
            className="w-full py-3 rounded-full transition-all hover:bg-[#2a2a2a]"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #546e7a',
              color: '#546e7a',
            }}
          >
            Follow
          </button>
        </div>

        {/* Revenue Dashboard */}
        <div
          className="p-6 rounded-lg mb-8"
          style={{
            backgroundColor: '#252525',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <h3 className="mb-4">Revenue Dashboard</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users size={16} color="#c6a700" />
                <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                  GLOBAL PATRONS
                </span>
              </div>
              <p className="mono" style={{ color: '#e0e0e0', fontSize: '1.5rem' }}>
                {artist.globalChosenUsers.toLocaleString()}
              </p>
            </div>
            
            <div>
              <p className="mono mb-1" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                YOUR CONTRIBUTION
              </p>
              <p className="mono" style={{ color: '#e0e0e0', fontSize: '1.5rem' }}>
                $0.00
              </p>
            </div>
          </div>

          <div
            className="mt-4 p-3 rounded"
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #333333',
            }}
          >
            <p style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
              Choose this artist to contribute $8.00/month directly. 80% goes to the artist.
            </p>
          </div>
        </div>

        {/* Discography */}
        <div className="mb-8">
          <h3 className="mb-4">Discography</h3>
          <div className="space-y-3">
            {albums.map((album) => (
              <div
                key={album.id}
                className="flex items-center gap-4 p-4 rounded-lg cursor-pointer hover:bg-[#2a2a2a] transition-colors"
                style={{
                  backgroundColor: '#252525',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <img
                  src={album.image}
                  alt={album.name}
                  className="w-16 h-16 rounded object-cover"
                />
                <div className="flex-1">
                  <h4 style={{ color: '#e0e0e0' }}>{album.name}</h4>
                  <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                    {album.year}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
