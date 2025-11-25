import { useState } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import { Track } from '../../types';

interface PlaylistCreationScreenProps {
  onClose: () => void;
  onPublish: (name: string, tracks: Track[]) => void;
}

export function PlaylistCreationScreen({ onClose, onPublish }: PlaylistCreationScreenProps) {
  const [playlistName, setPlaylistName] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [structuralIntegrity, setStructuralIntegrity] = useState(0);

  // Mock available tracks
  const availableTracks: Track[] = [
    {
      id: 'track-1',
      title: 'Concrete Dreams',
      artist: 'Nora Vex',
      album: 'Industrial Soundscapes',
      duration: '4:32',
      quality: 'FLAC',
      coverArt: 'https://images.unsplash.com/photo-1644855640845-ab57a047320e?w=400',
    },
    {
      id: 'track-2',
      title: 'Midnight Foundation',
      artist: 'The Midnight Architects',
      album: 'Structural Integrity',
      duration: '5:18',
      quality: 'FLAC',
      coverArt: 'https://images.unsplash.com/photo-1757889693310-1e77c6063ba7?w=400',
    },
    {
      id: 'track-3',
      title: 'Brass & Stone',
      artist: 'Luna Chen',
      album: 'Material Studies',
      duration: '3:45',
      quality: '320kbps',
      coverArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
    },
  ];

  const addTrack = (track: Track) => {
    const newTracks = [...tracks, track];
    setTracks(newTracks);
    
    // Calculate diversity (simple mock calculation)
    const uniqueArtists = new Set(newTracks.map(t => t.artist)).size;
    const diversity = Math.min(100, (uniqueArtists / newTracks.length) * 100);
    setStructuralIntegrity(Math.round(diversity));
  };

  const removeTrack = (trackId: string) => {
    const newTracks = tracks.filter(t => t.id !== trackId);
    setTracks(newTracks);
    
    if (newTracks.length === 0) {
      setStructuralIntegrity(0);
    } else {
      const uniqueArtists = new Set(newTracks.map(t => t.artist)).size;
      const diversity = Math.min(100, (uniqueArtists / newTracks.length) * 100);
      setStructuralIntegrity(Math.round(diversity));
    }
  };

  const canPublish = playlistName.length > 0 && tracks.length > 0 && structuralIntegrity >= 50;

  return (
    <div className="fixed inset-0 z-50 bg-[#1a1a1a] overflow-y-auto pb-24">
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-6 py-4 border-b border-[#333333]"
        style={{
          backgroundColor: '#252525',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="p-2">
            <X size={24} color="#a0a0a0" />
          </button>
          <h3 style={{ color: '#e0e0e0' }}>Firing New Brick</h3>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-6 pt-6">
        {/* Brick Name Input */}
        <div className="mb-6">
          <label className="mono mb-2 block" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
            BRICK NAME
          </label>
          <input
            type="text"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            placeholder="Enter playlist name..."
            className="w-full px-4 py-3 rounded-lg outline-none"
            style={{
              backgroundColor: '#252525',
              border: '1px solid #333333',
              color: '#e0e0e0',
            }}
          />
        </div>

        {/* The Batch List */}
        <div className="mb-6">
          <h4 className="mb-3">The Batch ({tracks.length} tracks)</h4>
          
          {tracks.length === 0 ? (
            <div
              className="p-8 rounded-lg text-center"
              style={{
                backgroundColor: '#252525',
                border: '1px dashed #333333',
              }}
            >
              <p style={{ color: '#a0a0a0' }}>No tracks added yet</p>
            </div>
          ) : (
            <div
              className="rounded-lg overflow-hidden"
              style={{
                backgroundColor: '#252525',
                border: '1px solid #333333',
              }}
            >
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 p-3 border-b border-[#333333] last:border-b-0"
                  style={{ backgroundColor: index % 2 === 0 ? '#252525' : '#222222' }}
                >
                  <GripVertical size={16} color="#a0a0a0" className="cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ color: '#e0e0e0', fontSize: '0.875rem' }}>
                      {track.title}
                    </p>
                    <p className="mono truncate" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
                      {track.artist} • {track.duration}
                    </p>
                  </div>
                  <button
                    onClick={() => removeTrack(track.id)}
                    className="p-1 hover:bg-[#333333] rounded transition-colors"
                  >
                    <X size={16} color="#a0a0a0" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Tracks */}
        <div className="mb-6">
          <h4 className="mb-3">Available Tracks</h4>
          <div className="space-y-2">
            {availableTracks.map((track) => {
              const isAdded = tracks.some(t => t.id === track.id);
              return (
                <button
                  key={track.id}
                  onClick={() => !isAdded && addTrack(track)}
                  disabled={isAdded}
                  className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all"
                  style={{
                    backgroundColor: isAdded ? '#1a1a1a' : '#252525',
                    border: '1px solid #333333',
                    opacity: isAdded ? 0.5 : 1,
                    cursor: isAdded ? 'not-allowed' : 'pointer',
                  }}
                >
                  <img
                    src={track.coverArt}
                    alt={track.album}
                    className="w-12 h-12 rounded object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ color: '#e0e0e0' }}>
                      {track.title}
                    </p>
                    <p className="mono truncate" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                      {track.artist}
                    </p>
                  </div>
                  {!isAdded && <Plus size={20} color="#546e7a" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Structural Integrity Gauge */}
        <div
          className="p-6 rounded-lg mb-6"
          style={{
            backgroundColor: '#252525',
            border: '1px solid #333333',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 style={{ color: '#e0e0e0' }}>Structural Integrity</h4>
            <span
              className="mono"
              style={{
                color: structuralIntegrity >= 50 ? '#4caf50' : '#d32f2f',
                fontSize: '1.25rem',
              }}
            >
              {structuralIntegrity}%
            </span>
          </div>
          
          <div className="w-full bg-[#1a1a1a] rounded-full h-2 mb-3">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${structuralIntegrity}%`,
                background:
                  structuralIntegrity >= 50
                    ? 'linear-gradient(to right, #4caf50, #8bc34a)'
                    : 'linear-gradient(to right, #d32f2f, #b71c1c)',
              }}
            />
          </div>

          <p style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
            {structuralIntegrity < 50
              ? 'Too much repetition. Diversify to strengthen this Brick.'
              : 'Good diversity. This Brick has strong structural integrity.'}
          </p>
        </div>

        {/* Fire Brick Button */}
        <button
          onClick={() => canPublish && onPublish(playlistName, tracks)}
          disabled={!canPublish}
          className="w-full py-4 rounded-full transition-all mb-6"
          style={{
            background: canPublish
              ? 'linear-gradient(to bottom, #d32f2f, #b71c1c)'
              : 'linear-gradient(to bottom, #333333, #2a2a2a)',
            color: canPublish ? '#e0e0e0' : '#666666',
            boxShadow: canPublish ? '0 4px 12px rgba(211, 47, 47, 0.3)' : 'none',
            cursor: canPublish ? 'pointer' : 'not-allowed',
          }}
        >
          Fire Brick (Publish)
        </button>
      </div>
    </div>
  );
}