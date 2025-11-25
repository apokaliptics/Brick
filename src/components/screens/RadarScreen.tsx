import { useState } from 'react';
import { Search } from 'lucide-react';
import { mockConnections } from '../../data/mockData';

interface Connection {
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  matchScore: number;
  x: number;
  y: number;
}

interface RadarScreenProps {
  onUserClick: (userId: string) => void;
}

export function RadarScreen({ onUserClick }: RadarScreenProps) {
  const [selectedUser, setSelectedUser] = useState<Connection | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  
  // Add mock x/y coordinates to connections for radar visualization
  const mockUsers: Connection[] = mockConnections.map((conn, i) => ({
    ...conn,
    x: 50 + Math.cos((i / mockConnections.length) * Math.PI * 2) * 30,
    y: 50 + Math.sin((i / mockConnections.length) * Math.PI * 2) * 30,
  }));

  // Filter users based on search query
  const filteredUsers = mockUsers.filter(user => 
    user.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pb-24 px-6 pt-6 md:pt-16 min-h-screen">
      <div className="mb-6">
        <h2 className="mb-2" style={{ letterSpacing: '-0.02em' }}>The Radar</h2>
        <p style={{ color: '#a0a0a0', fontSize: '0.95rem' }}>Discover users with compatible taste.</p>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 focus-within:ring-2 focus-within:ring-[#d32f2f] focus-within:ring-opacity-30"
          style={{
            backgroundColor: '#252525',
            border: '1px solid #333333',
          }}
        >
          <Search size={20} color="#a0a0a0" />
          <input
            type="text"
            placeholder="Search for Materials (Artists, Genres, Bricks)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            style={{ color: '#e0e0e0', fontSize: '0.95rem' }}
          />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 mb-8 overflow-x-auto">
        {[
          { id: 'all', label: 'All' },
          { id: 'architects', label: 'Architects Only' },
          { id: 'local', label: 'Local' },
          { id: 'global', label: 'Global' },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id as any)}
            className="px-4 py-2.5 rounded-xl whitespace-nowrap transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              backgroundColor: activeFilter === filter.id ? '#d32f2f' : '#252525',
              color: activeFilter === filter.id ? '#ffffff' : '#a0a0a0',
              border: '1px solid',
              borderColor: activeFilter === filter.id ? '#d32f2f' : '#333333',
              boxShadow: activeFilter === filter.id ? '0 0 12px rgba(211, 47, 47, 0.3)' : 'none',
            }}
          >
            <span className="mono" style={{ fontSize: '0.8rem', fontWeight: activeFilter === filter.id ? 600 : 400 }}>
              {filter.label}
            </span>
          </button>
        ))}
      </div>

      {/* Results Counter */}
      <div className="mb-4">
        <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
          {filteredUsers.length} COMPATIBLE USERS FOUND
        </p>
      </div>

      {/* Radar Visualization */}
      <div
        className="relative rounded-lg mb-6 overflow-hidden"
        style={{
          backgroundColor: '#151515',
          height: '400px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          border: '1px solid #333333',
        }}
      >
        {/* Radar Grid */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative" style={{ width: '100%', height: '100%' }}>
            {/* Concentric Circles */}
            {[100, 200, 300].map((size, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  border: '1px solid rgba(84, 110, 122, 0.2)',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}

            {/* Center Point (You) */}
            <div
              className="absolute w-4 h-4 rounded-full"
              style={{
                backgroundColor: '#d32f2f',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 20px rgba(211, 47, 47, 0.6)',
              }}
            />

            {/* User Dots */}
            {filteredUsers.map((user, i) => (
              <div
                key={i}
                onClick={() => onUserClick(user.user.id)}
                className="absolute cursor-pointer group"
                style={{
                  left: `${user.x}%`,
                  top: `${user.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {/* Pulse Effect */}
                <div
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{
                    backgroundColor: 'rgba(84, 110, 122, 0.4)',
                    width: '32px',
                    height: '32px',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
                
                {/* Avatar */}
                <img
                  src={user.user.avatar}
                  alt={user.user.name}
                  className="relative w-8 h-8 rounded-full border-2 group-hover:scale-125 transition-transform"
                  style={{ borderColor: '#546e7a' }}
                />

                {/* Tooltip */}
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{
                    backgroundColor: '#252525',
                    border: '1px solid #333333',
                  }}
                >
                  <p className="mono" style={{ color: '#e0e0e0', fontSize: '0.7rem' }}>
                    {user.user.name}
                  </p>
                  <p className="mono" style={{ color: '#546e7a', fontSize: '0.65rem' }}>
                    {user.matchScore}% Match
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div
        className="p-4 rounded-lg"
        style={{
          backgroundColor: '#252525',
          border: '1px solid #333333',
        }}
      >
        <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
          Tap a dot to view Structural Integrity. Closer dots = Higher compatibility.
        </p>
      </div>
    </div>
  );
}