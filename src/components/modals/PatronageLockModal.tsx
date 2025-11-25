import { Lock, Clock, DollarSign } from 'lucide-react';

interface PatronageLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistName: string;
  daysRemaining: number;
  onPayEarlyUnlock: () => void;
}

export function PatronageLockModal({
  isOpen,
  onClose,
  artistName,
  daysRemaining,
  onPayEarlyUnlock,
}: PatronageLockModalProps) {
  if (!isOpen) return null;

  const earlyUnlockFee = 5.00; // $5 early unlock fee

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-md p-8 rounded-2xl spring-in"
        style={{
          backgroundColor: 'rgba(30, 30, 30, 0.95)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
        }}
      >
        {/* Lock Icon */}
        <div className="mb-6 text-center">
          <div
            className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4"
            style={{
              backgroundColor: 'rgba(198, 167, 0, 0.2)',
              border: '2px solid #c6a700',
            }}
          >
            <Lock size={36} color="#c6a700" />
          </div>

          <h3 className="mb-2" style={{ color: '#e0e0e0' }}>
            Patronage Slot Locked
          </h3>
          <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
            You're currently supporting another artist
          </p>
        </div>

        {/* Info Box */}
        <div
          className="p-5 rounded-xl mb-6"
          style={{
            backgroundColor: 'rgba(37, 37, 37, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Clock size={20} color="#546e7a" />
            <div className="flex-1">
              <p className="mono mb-1" style={{ color: '#e0e0e0', fontSize: '0.875rem' }}>
                Time Until Unlock
              </p>
              <p className="mono" style={{ color: '#546e7a', fontSize: '1.25rem' }}>
                {daysRemaining} Days
              </p>
            </div>
          </div>

          <div
            className="w-full rounded-full h-2"
            style={{
              backgroundColor: '#1a1a1a',
            }}
          >
            <div
              className="h-2 rounded-full"
              style={{
                width: `${((30 - daysRemaining) / 30) * 100}%`,
                background: 'linear-gradient(to right, #546e7a, #d32f2f)',
              }}
            />
          </div>
        </div>

        {/* Explanation */}
        <div
          className="p-4 rounded-lg mb-6"
          style={{
            backgroundColor: 'rgba(26, 26, 26, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <p style={{ color: '#cccccc', fontSize: '0.875rem', lineHeight: '1.6' }}>
            Brick encourages long-term support. Your monthly patronage slots unlock every 30 days,
            ensuring artists receive stable, committed support.
          </p>
        </div>

        {/* Early Unlock Option */}
        <div
          className="p-5 rounded-xl mb-6"
          style={{
            background: 'linear-gradient(135deg, rgba(198, 167, 0, 0.1), rgba(198, 167, 0, 0.05))',
            border: '1px solid rgba(198, 167, 0, 0.3)',
          }}
        >
          <div className="flex items-start gap-3 mb-3">
            <DollarSign size={20} color="#c6a700" className="flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="mb-1" style={{ color: '#c6a700' }}>
                Early Unlock Available
              </h4>
              <p style={{ color: '#cccccc', fontSize: '0.875rem' }}>
                Switch your patronage immediately for a one-time fee
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
              Early Unlock Fee
            </span>
            <span className="mono" style={{ color: '#c6a700', fontSize: '1.25rem' }}>
              ${earlyUnlockFee.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => {
              onPayEarlyUnlock();
              onClose();
            }}
            className="w-full py-3 rounded-full transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(to bottom, #c6a700, #a08700)',
              color: '#1a1a1a',
              fontWeight: 600,
              boxShadow: '0 4px 20px rgba(198, 167, 0, 0.4)',
            }}
          >
            Pay ${earlyUnlockFee.toFixed(2)} to Switch Now
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-full transition-all hover:bg-[#2a2a2a]"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #333333',
              color: '#a0a0a0',
            }}
          >
            Wait {daysRemaining} Days
          </button>
        </div>

        {/* Fine Print */}
        <p
          className="mono text-center mt-4"
          style={{ color: '#666666', fontSize: '0.65rem' }}
        >
          80% OF FEE GOES TO {artistName.toUpperCase()}
        </p>
      </div>
    </div>
  );
}
