import { X, Download, Heart, Zap } from 'lucide-react';
// @ts-ignore
import { useState, useEffect } from 'react';

interface UserSettings {
  monthlySupport: boolean;
  plan: 'Sketcher' | 'Mason' | 'Architect';
}

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userAvatar?: string;
}

export function UserSettingsModal({ isOpen, onClose, userName = 'User', userAvatar = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=100' }: UserSettingsModalProps) {
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('userSettings');
    if (saved) return JSON.parse(saved);
    return {
      monthlySupport: false,
      plan: 'Sketcher' as const,
    };
  });

  useEffect(() => {
    localStorage.setItem('userSettings', JSON.stringify(settings));
  }, [settings]);

  const handleExportData = async () => {
    try {
      // Get data from IndexedDB
      const db = await openPlaylistDB();
      const tx = db.transaction(['playlists', 'localTracks', 'recentlyPlayed'], 'readonly');
      
      const playlists = await new Promise<any[]>((resolve) => {
        const request = tx.objectStore('playlists').getAll();
        request.onsuccess = () => resolve(request.result);
      });

      const listeningData = {
        exportDate: new Date().toISOString(),
        userPlan: settings.plan,
        monthlySupport: settings.monthlySupport,
        playlistsCount: playlists.length,
        playlists: playlists.map((p: any) => ({
          name: p.name,
          artist: p.artist,
          trackCount: p.tracks.length,
          structuralIntegrity: p.structuralIntegrity,
          createdDate: new Date(parseInt(p.id)).toISOString(),
        })),
      };

      // Create and download JSON file
      const dataStr = JSON.stringify(listeningData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `brick-listening-data-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export listening data');
    }
  };

  if (!isOpen) return null;

  return (
    // @ts-ignore - JSX type warnings due to missing React types
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      {/* @ts-ignore */}
      <div
        className="w-full max-w-md rounded-lg p-6 relative"
        style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #333333',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
        >
          <X size={20} color="#a0a0a0" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <img src={userAvatar} alt={userName} className="w-12 h-12 rounded-full" />
          <div>
            <h2 style={{ color: '#e0e0e0' }} className="text-xl font-bold">
              {userName}
            </h2>
            <p style={{ color: '#a0a0a0' }} className="text-sm">
              Settings
            </p>
          </div>
        </div>

        {/* Plan Section */}
        <div className="mb-6">
          <h3 style={{ color: '#e0e0e0' }} className="font-semibold mb-3">
            Plan
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {(['Sketcher', 'Mason', 'Architect'] as const).map((plan) => (
              <button
                key={plan}
                onClick={() => setSettings({ ...settings, plan })}
                className="p-3 rounded-lg transition-all text-sm font-medium"
                style={{
                  backgroundColor: settings.plan === plan ? 'rgba(211, 47, 47, 0.15)' : '#252525',
                  color: settings.plan === plan ? '#d32f2f' : '#a0a0a0',
                  border: settings.plan === plan ? '1px solid #d32f2f' : '1px solid #333333',
                }}
              >
                {plan}
              </button>
            ))}
          </div>
          <p style={{ color: '#666666' }} className="text-xs mt-2">
            {settings.plan === 'Sketcher' && 'Basic features, up to 10 playlists'}
            {settings.plan === 'Mason' && 'Advanced features, up to 50 playlists'}
            {settings.plan === 'Architect' && 'Premium features, unlimited playlists'}
          </p>
        </div>

        {/* Monthly Support Toggle */}
        <div className="mb-6 p-3 rounded-lg" style={{ backgroundColor: '#252525' }}>
          <button
            onClick={() => setSettings({ ...settings, monthlySupport: !settings.monthlySupport })}
            className="w-full flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Heart
                size={18}
                color={settings.monthlySupport ? '#d32f2f' : '#a0a0a0'}
                fill={settings.monthlySupport ? '#d32f2f' : 'none'}
              />
              <div className="text-left">
                <p style={{ color: '#e0e0e0' }} className="font-medium">
                  Monthly Support
                </p>
                <p style={{ color: '#666666' }} className="text-xs">
                  ${settings.monthlySupport ? '9.99' : '0'}/month
                </p>
              </div>
            </div>
            <div
              className="w-10 h-6 rounded-full flex items-center px-1 transition-colors"
              style={{
                backgroundColor: settings.monthlySupport ? '#d32f2f' : '#444444',
              }}
            >
              <div
                className="w-4 h-4 rounded-full bg-white transition-transform"
                style={{
                  transform: settings.monthlySupport ? 'translateX(16px)' : 'translateX(0)',
                }}
              />
            </div>
          </button>
        </div>

        {/* Export Data Button */}
        <button
          onClick={handleExportData}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg mb-4 transition-all hover:scale-105 active:scale-95"
          style={{
            backgroundColor: '#252525',
            color: '#e0e0e0',
            border: '1px solid #333333',
          }}
        >
          <Download size={18} />
          Export Listening Data
        </button>

        {/* Info */}
        <p style={{ color: '#666666' }} className="text-xs text-center">
          Your settings are saved locally. Monthly support is for creators.
        </p>
      </div>
    </div>
  );
}

const openPlaylistDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BrickMusicDB', 2);
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
    };
  });
};
