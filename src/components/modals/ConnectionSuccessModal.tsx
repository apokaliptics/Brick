import { Check, Music, Shield, Zap } from 'lucide-react';

interface ConnectionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userAvatar: string;
}

export function ConnectionSuccessModal({ isOpen, onClose, userName, userAvatar }: ConnectionSuccessModalProps) {
  if (!isOpen) return null;

  const benefits = [
    {
      icon: Music,
      title: 'Unlock Playlists',
      description: 'Access their curated collections',
    },
    {
      icon: Shield,
      title: 'Ad-Free Listening',
      description: 'No ads when playing their bricks',
    },
    {
      icon: Zap,
      title: 'Live Updates',
      description: 'See their new bricks in your feed',
    },
  ];

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
        {/* Success Icon */}
        <div className="mb-6 text-center">
          <div
            className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(to bottom, #d32f2f, #b71c1c)',
              boxShadow: '0 8px 30px rgba(211, 47, 47, 0.5)',
            }}
          >
            <Check size={40} color="#e0e0e0" strokeWidth={3} />
          </div>

          {/* User Avatar */}
          <img
            src={userAvatar}
            alt={userName}
            className="w-16 h-16 rounded-full mx-auto mb-3 border-2"
            style={{ borderColor: '#546e7a' }}
          />

          <h3 className="mb-2" style={{ color: '#e0e0e0' }}>
            Connected to {userName}
          </h3>
          <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
            CONNECTION ESTABLISHED
          </p>
        </div>

        {/* Benefits */}
        <div className="space-y-4 mb-6">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="flex items-start gap-3 p-4 rounded-lg"
                style={{
                  backgroundColor: 'rgba(37, 37, 37, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: 'rgba(84, 110, 122, 0.2)',
                    border: '1px solid #546e7a',
                  }}
                >
                  <Icon size={18} color="#546e7a" />
                </div>
                <div>
                  <h4 className="mb-1" style={{ color: '#e0e0e0', fontSize: '0.875rem' }}>
                    {benefit.title}
                  </h4>
                  <p style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                    {benefit.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-full transition-all duration-200 hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(to bottom, #d32f2f, #b71c1c)',
            color: '#e0e0e0',
            boxShadow: '0 4px 20px rgba(211, 47, 47, 0.4)',
          }}
        >
          Start Exploring
        </button>
      </div>
    </div>
  );
}
