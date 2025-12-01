import { useState, useEffect } from 'react';
import { Home, User, Layout, Search, Heart, Plus, X, Music, ChevronLeft, Play, HardDrive, Grid3x3, Orbit, Trash2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Playlist } from '../../types';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { BrickCard } from '../BrickCard';
import { mockPlaylists, mockCurrentUser } from '../../data/mockData';

interface ProfileScreenProps {
  onPlaylistClick: (playlistId: string) => void;
}

export function ProfileScreen({ onPlaylistClick }: ProfileScreenProps) {
  const { colors } = useTheme();
  const userPlaylists = mockPlaylists;
  const [layoutMode, setLayoutMode] = useState<'brick' | 'spiral'>('brick');
  const [wallView, setWallView] = useState<'online' | 'local'>('online');
  const [localPlaylists, setLocalPlaylists] = useState<Playlist[]>([]);

  // Load local playlists from IndexedDB
  useEffect(() => {
    loadLocalPlaylists();
    
    // Listen for custom event to switch to local wall
    const handleSwitchToLocal = () => {
      setWallView('local');
      loadLocalPlaylists();
    };
    
    window.addEventListener('switchToLocalWall', handleSwitchToLocal as EventListener);
    
    return () => {
      window.removeEventListener('switchToLocalWall', handleSwitchToLocal as EventListener);
    };
  }, []);

  const loadLocalPlaylists = async () => {
    try {
      const db = await openPlaylistDB();
      const transaction = db.transaction(['playlists'], 'readonly');
      const store = transaction.objectStore('playlists');
      const playlists = await new Promise<Playlist[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      setLocalPlaylists(playlists);
      console.log('Loaded playlists from IndexedDB:', playlists);
    } catch (error) {
      console.error('Failed to load playlists:', error);
      setLocalPlaylists([]);
    }
  };

  const openPlaylistDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BrickMusicDB', 4);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('localTracks')) {
          db.createObjectStore('localTracks', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }

        // Create recentlyPlayedPlaylists store if it doesn't exist
        if (!db.objectStoreNames.contains('recentlyPlayedPlaylists')) {
          const store = db.createObjectStore('recentlyPlayedPlaylists', { keyPath: 'playlistId' });
          store.createIndex('playedAt', 'playedAt', { unique: false });
        }

        // Create recentlyPlayedTracks store if it doesn't exist
        if (!db.objectStoreNames.contains('recentlyPlayedTracks')) {
          const store = db.createObjectStore('recentlyPlayedTracks', { keyPath: 'trackId' });
          store.createIndex('playedAt', 'playedAt', { unique: false });
        }
      };
    });
  };

  // Get dynamic size based on structural integrity
  const getCardSize = (structuralIntegrity: number | undefined): 'small' | 'medium' | 'large' => {
    if (!structuralIntegrity) return 'medium';
    if (structuralIntegrity >= 85) return 'large';
    if (structuralIntegrity >= 70) return 'medium';
    return 'small';
  };

  const DELETION_COOLDOWN_HOURS = 24;

  const canDeletePlaylist = (playlist: Playlist): boolean => {
    if (!playlist.deletionQueuedAt) return true;
    const now = Date.now();
    const scheduledTime = playlist.deletionScheduledFor || 0;
    return now >= scheduledTime;
  };

  const getTimeUntilDeletion = (playlist: Playlist): string => {
    if (!playlist.deletionScheduledFor) return '';
    const now = Date.now();
    const timeLeft = playlist.deletionScheduledFor - now;
    
    if (timeLeft <= 0) return 'Ready to delete';
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `Delete in ${hours}h ${minutes}m`;
    return `Delete in ${minutes}m`;
  };

  const queuePlaylistDeletion = async (playlistId: string) => {
    try {
      const db = await openPlaylistDB();
      const transaction = db.transaction(['playlists'], 'readwrite');
      const store = transaction.objectStore('playlists');
      
      const getRequest = store.get(playlistId);
      getRequest.onsuccess = () => {
        const playlist: Playlist = getRequest.result;
        if (playlist) {
          const now = Date.now();
          playlist.deletionQueuedAt = now;
          playlist.deletionScheduledFor = now + (DELETION_COOLDOWN_HOURS * 60 * 60 * 1000);
          
          const updateRequest = store.put(playlist);
          updateRequest.onsuccess = () => {
            loadLocalPlaylists();
          };
        }
      };
    } catch (error) {
      console.error('Failed to queue playlist deletion:', error);
    }
  };

  const confirmPlaylistDeletion = async (playlistId: string) => {
    try {
      const db = await openPlaylistDB();
      const transaction = db.transaction(['playlists'], 'readwrite');
      const store = transaction.objectStore('playlists');
      await new Promise<void>((resolve) => {
        const deleteRequest = store.delete(playlistId);
        deleteRequest.onsuccess = () => resolve();
      });
      loadLocalPlaylists();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
    }
  };

  const cancelPlaylistDeletion = async (playlistId: string) => {
    try {
      const db = await openPlaylistDB();
      const transaction = db.transaction(['playlists'], 'readwrite');
      const store = transaction.objectStore('playlists');
      
      const getRequest = store.get(playlistId);
      getRequest.onsuccess = () => {
        const playlist: Playlist = getRequest.result;
        if (playlist) {
          playlist.deletionQueuedAt = undefined;
          playlist.deletionScheduledFor = undefined;
          
          const updateRequest = store.put(playlist);
          updateRequest.onsuccess = () => {
            loadLocalPlaylists();
          };
        }
      };
    } catch (error) {
      console.error('Failed to cancel deletion:', error);
    }
  };

  // Render bricks in spiral layout
  const renderSpiralLayout = (playlists: any[]) => {
    const sorted = [...playlists].sort((a, b) => 
      (b.structuralIntegrity || 0) - (a.structuralIntegrity || 0)
    );

    return (
      <div
        className="relative rounded-2xl mb-6 overflow-hidden flex items-center justify-center"
        style={{
          minHeight: '800px',
          backgroundColor: colors.bg.primary,
          border: `1px solid ${colors.border}`,
        }}
      >
        {/* Concentric Circles */}
        {[150, 300, 450].map((size, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              border: '1px solid rgba(211, 47, 47, 0.15)',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}

        {/* Center Album (Highest Integrity) */}
        {sorted[0] && (
          <div
            className="absolute cursor-pointer group"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            onClick={() => onPlaylistClick(sorted[0].id)}
          >
            <ImageWithFallback
              src={sorted[0].coverImage}
              alt={sorted[0].name}
              className="rounded-xl transition-all duration-300 group-hover:scale-110"
              style={{
                width: '140px',
                height: '140px',
                objectFit: 'cover',
                boxShadow: '0 0 40px rgba(211, 47, 47, 0.6)',
                border: '3px solid #d32f2f',
              }}
            />
            {/* Tooltip */}
            <div
              className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{
                backgroundColor: '#252525',
                border: '1px solid #333333',
              }}
            >
              <p className="mono" style={{ color: '#e0e0e0', fontSize: '0.75rem' }}>
                {sorted[0].name}
              </p>
              <p className="mono" style={{ color: '#d32f2f', fontSize: '0.7rem' }}>
                {sorted[0].structuralIntegrity}% Integrity
              </p>
            </div>
          </div>
        )}

        {/* Orbiting Albums */}
        {sorted.slice(1).map((playlist, index) => {
          const integrity = playlist.structuralIntegrity || 50;
          const size = integrity >= 85 ? 100 : integrity >= 70 ? 80 : 60;
          
          const totalItems = sorted.length - 1;
          const angle = (index / totalItems) * Math.PI * 2;
          const orbitRadius = integrity >= 85 ? 150 : integrity >= 70 ? 220 : 290;
          const x = 50 + Math.cos(angle) * (orbitRadius / 8);
          const y = 50 + Math.sin(angle) * (orbitRadius / 8);

          return (
            <div
              key={playlist.id}
              className="absolute cursor-pointer group"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              onClick={() => onPlaylistClick(playlist.id)}
            >
              {/* Pulse Effect */}
              <div
                className="absolute inset-0 rounded-lg animate-ping"
                style={{
                  backgroundColor: 'rgba(211, 47, 47, 0.2)',
                  width: `${size}px`,
                  height: `${size}px`,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
              
              {/* Album Image */}
              <ImageWithFallback
                src={playlist.coverImage}
                alt={playlist.name}
                className="relative rounded-lg transition-all duration-300 group-hover:scale-125"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  objectFit: 'cover',
                  border: '2px solid #d32f2f',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
                }}
              />

              {/* Tooltip */}
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                style={{
                  backgroundColor: '#252525',
                  border: '1px solid #333333',
                }}
              >
                <p className="mono" style={{ color: '#e0e0e0', fontSize: '0.7rem' }}>
                  {playlist.name}
                </p>
                <p className="mono" style={{ color: '#d32f2f', fontSize: '0.65rem' }}>
                  {integrity}% Integrity
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="pb-24 px-6 pt-10">
      {/* Profile Header */}
      <div className="mb-8 text-center">
        <img
          src={mockCurrentUser.avatar}
          alt={mockCurrentUser.name}
          className="w-24 h-24 rounded-full mx-auto mb-4"
          style={{
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          }}
        />
        <h2 className="mb-1" style={{ color: colors.text.primary }}>{mockCurrentUser.name}</h2>
        <p style={{ color: colors.text.secondary }}>{mockCurrentUser.tier} Tier</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Diversity Score */}
        <div
          className="p-6 rounded-lg text-center"
          style={{
            backgroundColor: '#252525',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div className="relative inline-block mb-3">
            {/* Ring Chart */}
            <svg width="80" height="80" className="transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="35"
                stroke="#1a1a1a"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="40"
                cy="40"
                r="35"
                stroke="url(#diversity-gradient)"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${(mockCurrentUser.diversityScore / 100) * 220} 220`}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="diversity-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4caf50" />
                  <stop offset="100%" stopColor="#546e7a" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="mono" style={{ color: colors.text.primary, fontSize: '1.5rem' }}>
                {mockCurrentUser.diversityScore}
              </span>
            </div>
          </div>
          <h4 style={{ color: colors.text.primary }}>Authenticity</h4>
          <p className="mono" style={{ color: colors.text.secondary, fontSize: '0.75rem' }}>
            Diversity Score
          </p>
        </div>

        {/* Connection Cap */}
        <div
          className="p-6 rounded-lg text-center"
          style={{
            backgroundColor: colors.bg.secondary,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            border: `1px solid ${colors.border}`,
          }}
        >
          <div className="mb-3">
            <span className="mono" style={{ color: '#e0e0e0', fontSize: '2rem' }}>
              {mockCurrentUser.connectionsUsed}
            </span>
            <span className="mono" style={{ color: '#a0a0a0', fontSize: '1.2rem' }}>
              /{mockCurrentUser.connectionsMax}
            </span>
          </div>
          <h4 style={{ color: '#e0e0e0' }}>Connections</h4>
          <div className="flex justify-center gap-1 mt-2">
            {Array.from({ length: mockCurrentUser.connectionsMax }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    i < mockCurrentUser.connectionsUsed ? '#546e7a' : '#1a1a1a',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Playlists Grid */}
      <div className="mb-6">
        {/* Header with Toggles */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 style={{ color: colors.text.primary }}>The Wall</h3>
            
            {/* Online/Local Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setWallView('online')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  backgroundColor: wallView === 'online' ? 'rgba(211, 47, 47, 0.2)' : '#252525',
                  border: `1px solid ${wallView === 'online' ? '#d32f2f' : '#333333'}`,
                }}
              >
                <Music size={14} color={wallView === 'online' ? '#d32f2f' : '#a0a0a0'} />
                <span className="mono" style={{ color: wallView === 'online' ? '#d32f2f' : '#a0a0a0', fontSize: '0.7rem' }}>
                  Online
                </span>
              </button>
              <button
                onClick={() => setWallView('local')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  backgroundColor: wallView === 'local' ? 'rgba(211, 47, 47, 0.2)' : '#252525',
                  border: `1px solid ${wallView === 'local' ? '#d32f2f' : '#333333'}`,
                }}
              >
                <HardDrive size={14} color={wallView === 'local' ? '#d32f2f' : '#a0a0a0'} />
                <span className="mono" style={{ color: wallView === 'local' ? '#d32f2f' : '#a0a0a0', fontSize: '0.7rem' }}>
                  Local ({localPlaylists.length})
                </span>
              </button>
            </div>
          </div>
          
          {/* Layout Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setLayoutMode('brick')}
              className="p-2 rounded-lg transition-all duration-200"
              style={{
                backgroundColor: layoutMode === 'brick' ? 'rgba(211, 47, 47, 0.15)' : 'rgba(37, 37, 37, 0.5)',
                border: `1px solid ${layoutMode === 'brick' ? '#d32f2f' : 'rgba(255, 255, 255, 0.05)'}`,
              }}
              title="Brick Look"
            >
              <Grid3x3 size={18} color={layoutMode === 'brick' ? '#d32f2f' : '#a0a0a0'} />
            </button>
            <button
              onClick={() => setLayoutMode('spiral')}
              className="p-2 rounded-lg transition-all duration-200"
              style={{
                backgroundColor: layoutMode === 'spiral' ? 'rgba(211, 47, 47, 0.15)' : 'rgba(37, 37, 37, 0.5)',
                border: `1px solid ${layoutMode === 'spiral' ? '#d32f2f' : 'rgba(255, 255, 255, 0.05)'}`,
              }}
              title="Spiral View"
            >
              <Orbit size={18} color={layoutMode === 'spiral' ? '#d32f2f' : '#a0a0a0'} />
            </button>
          </div>
        </div>

        {/* Render based on layout mode */}
        {wallView === 'local' && localPlaylists.length === 0 ? (
          <div className="p-12 rounded-lg text-center" style={{ backgroundColor: '#252525', border: '1px dashed #333333' }}>
            <HardDrive size={48} color="#666666" className="mx-auto mb-4" />
            <h4 style={{ color: '#a0a0a0', marginBottom: '8px' }}>No Local Blueprints Yet</h4>
            <p className="mono" style={{ color: '#666666', fontSize: '0.75rem' }}>
              Create your first playlist from the "+" button
            </p>
          </div>
        ) : layoutMode === 'brick' ? (
          <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {(wallView === 'online' ? userPlaylists : localPlaylists)
              .sort((a, b) => (b.structuralIntegrity || 0) - (a.structuralIntegrity || 0))
              .map((playlist) => {
                const size = getCardSize(playlist.structuralIntegrity);
                return (
                  <div
                    key={playlist.id}
                    className={size === 'large' ? 'col-span-2' : ''}
                  >
                    <BrickCard
                      playlist={playlist}
                      onClick={() => onPlaylistClick(playlist.id)}
                      size="small"
                      onDelete={wallView === 'local' ? queuePlaylistDeletion : undefined}
                      onCancelDelete={wallView === 'local' ? cancelPlaylistDeletion : undefined}
                      onConfirmDelete={wallView === 'local' ? confirmPlaylistDeletion : undefined}
                      canDelete={canDeletePlaylist(playlist)}
                      timeUntilDeletion={getTimeUntilDeletion(playlist)}
                    />
                  </div>
                );
              })}
          </div>
        ) : (
          renderSpiralLayout(wallView === 'online' ? userPlaylists : localPlaylists)
        )}
      </div>
    </div>
  );
}
