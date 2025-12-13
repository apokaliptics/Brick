/* eslint-disable */
import { Connection } from '../types';

interface ConnectionItemProps {
  connection: Connection;
  onClick?: () => void;
}

export function ConnectionItem({ connection, onClick }: ConnectionItemProps) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 p-4 bg-[#252525] rounded-lg cursor-pointer transition-all duration-200 hover:bg-[#2a2a2a]"
      style={{
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <img
          src={connection.user.avatar}
          alt={connection.user.name}
          className="w-12 h-12 rounded-full"
        />
        
        {/* Connection Line - SVG */}
        <svg
          className="absolute -right-8 top-1/2 -translate-y-1/2 w-8 h-12 overflow-visible"
          style={{ pointerEvents: 'none' }}
        >
          <path
            d="M 0 6 Q 12 6, 20 6"
            stroke="#546e7a"
            strokeWidth="2"
            fill="none"
            opacity="0.6"
          />
        </svg>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3 mb-1">
          <h4 className="truncate" style={{ color: '#e0e0e0' }}>
            {connection.user.name}
          </h4>
          <span
            className="mono flex-shrink-0"
            style={{ color: '#546e7a', fontSize: '0.9rem' }}
          >
            {connection.matchScore}%
          </span>
        </div>
        <p style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
          {connection.mutualArtists.length} mutual artists
        </p>
      </div>
    </div>
  );
}
