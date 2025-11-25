import { X, AlertTriangle } from 'lucide-react';

interface ConnectionAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userAvatar: string;
  matchScore: number;
  mutualArtists: string[];
  diversityScore?: number;
  onConnect: () => void;
  onConnectSuccess: () => void;
}

export function ConnectionAuditModal({
  isOpen,
  onClose,
  userName,
  userAvatar,
  matchScore,
  mutualArtists,
  diversityScore = 85,
  onConnect,
  onConnectSuccess,
}: ConnectionAuditModalProps) {
  if (!isOpen) return null;

  const isLowDiversity = diversityScore < 30;

  const handleConnect = () => {
    onConnect();
    onClose();
    onConnectSuccess();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#252525] rounded-t-2xl md:rounded-2xl overflow-hidden animate-slide-up"
        style={{
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#333333]">
          <h3 style={{ color: '#e0e0e0' }}>Connection Audit</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#333333] transition-colors"
          >
            <X size={20} color="#a0a0a0" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* User Info */}
          <div className="flex items-center gap-4 mb-6">
            <img
              src={userAvatar}
              alt={userName}
              className="w-16 h-16 rounded-full"
            />
            <div>
              <h4 style={{ color: '#e0e0e0' }}>{userName}</h4>
              <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                Architect • Diversity: {diversityScore}/100
              </p>
            </div>
          </div>

          {/* Match Score */}
          <div className="mb-6 text-center">
            <div className="relative inline-block mb-3">
              <svg width="120" height="120" className="transform -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="#1a1a1a"
                  strokeWidth="10"
                  fill="none"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="#546e7a"
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={`${(matchScore / 100) * 314} 314`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="mono" style={{ color: '#e0e0e0', fontSize: '2rem' }}>
                  {matchScore}%
                </span>
              </div>
            </div>
            <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
              STRUCTURAL INTEGRITY
            </p>
          </div>

          {/* Venn Diagram - Mutual Artists */}
          <div className="mb-6">
            <p className="mono mb-3" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
              SHARED TASTE ANALYSIS
            </p>
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333333',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="flex -space-x-2">
                  <div
                    className="w-8 h-8 rounded-full border-2"
                    style={{ backgroundColor: '#333333', borderColor: '#546e7a' }}
                  />
                  <div
                    className="w-8 h-8 rounded-full border-2"
                    style={{ backgroundColor: '#333333', borderColor: '#546e7a' }}
                  />
                </div>
                <span className="mono" style={{ color: '#e0e0e0', fontSize: '0.875rem' }}>
                  {mutualArtists.length} Mutual Artists
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {mutualArtists.map((artist, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded"
                    style={{
                      backgroundColor: '#252525',
                      color: '#e0e0e0',
                      fontSize: '0.75rem',
                    }}
                  >
                    {artist}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Warning */}
          {isLowDiversity && (
            <div
              className="p-4 rounded-lg mb-6"
              style={{
                backgroundColor: 'rgba(211, 47, 47, 0.1)',
                border: '1px solid #d32f2f',
              }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={20} color="#d32f2f" className="flex-shrink-0 mt-0.5" />
                <div>
                  <p style={{ color: '#d32f2f', fontSize: '0.875rem' }}>
                    <strong>Warning: High Repetition Detected</strong>
                  </p>
                  <p style={{ color: '#d32f2f', fontSize: '0.75rem' }}>
                    Potential stream farm. Low diversity score indicates repetitive listening.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-full transition-all hover:bg-[#2a2a2a]"
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #333333',
                color: '#a0a0a0',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConnect}
              className="flex-1 py-3 rounded-full transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: '#546e7a',
                color: '#e0e0e0',
                boxShadow: '0 4px 12px rgba(84, 110, 122, 0.3)',
              }}
            >
              Send Connection Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}