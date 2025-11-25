import { useState } from 'react';
import { Music } from 'lucide-react';

interface ImportScreenProps {
  onImport: (platform: string) => void;
  onSkip: () => void;
}

export function ImportScreen({ onImport, onSkip }: ImportScreenProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const platforms = [
    { id: 'spotify', name: 'Spotify', icon: '♫' },
    { id: 'apple', name: 'Apple Music', icon: '🍎' },
    { id: 'tidal', name: 'Tidal', icon: '〰' },
  ];

  const handleImport = (platformId: string) => {
    setSelectedPlatform(platformId);
    setIsImporting(true);
    
    // Simulate import process
    setTimeout(() => {
      onImport(platformId);
    }, 3000);
  };

  if (isImporting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: '#1a1a1a' }}>
        <div className="text-center fade-in">
          <div className="mb-6">
            <div
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(to bottom, #d32f2f, #b71c1c)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            >
              <Music size={32} color="#e0e0e0" />
            </div>
          </div>
          <h3 className="mb-2" style={{ color: '#e0e0e0' }}>
            Connecting...
          </h3>
          <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
            Analyzing Audio Quality...
          </p>
          <div className="mt-6 mono" style={{ color: '#546e7a', fontSize: '0.75rem' }}>
            <p className="animate-pulse">Importing library...</p>
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.05);
              opacity: 0.8;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: '#1a1a1a' }}>
      <div className="w-full max-w-lg px-6">
        {/* Header */}
        <div className="text-center mb-12 fade-in">
          <h2 className="mb-3" style={{ color: '#e0e0e0' }}>
            Do you have existing materials?
          </h2>
          <p style={{ color: '#a0a0a0' }}>
            Import your library to upgrade to lossless quality.
          </p>
        </div>

        {/* Platform Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {platforms.map((platform, index) => (
            <button
              key={platform.id}
              onClick={() => handleImport(platform.id)}
              className="spring-in p-8 rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                backgroundColor: 'rgba(30, 30, 30, 0.8)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
                animationDelay: `${index * 0.1}s`,
              }}
            >
              <div
                className="text-6xl mb-4 opacity-80"
                style={{
                  filter: 'grayscale(1) brightness(1.5)',
                }}
              >
                {platform.icon}
              </div>
              <h4 style={{ color: '#e0e0e0' }}>{platform.name}</h4>
            </button>
          ))}
        </div>

        {/* Skip Option */}
        <div className="text-center">
          <button
            onClick={onSkip}
            className="transition-all duration-200 hover:opacity-70"
            style={{
              color: '#a0a0a0',
              fontSize: '0.875rem',
              textDecoration: 'underline',
            }}
          >
            No, I'm starting fresh
          </button>
        </div>
      </div>
    </div>
  );
}
