import { Connection } from '../types';

interface NetworkStoriesProps {
  connections: Connection[];
  onStoryClick: (connectionId: string) => void;
}

export function NetworkStories({ connections, onStoryClick }: NetworkStoriesProps) {
  return (
    <div className="px-6 py-4">
      <div className="flex gap-4 overflow-x-auto no-scrollbar">
        {connections.map((connection) => (
          <button
            key={connection.id}
            onClick={() => onStoryClick(connection.id)}
            className="flex flex-col items-center gap-2 flex-shrink-0"
          >
            {/* Avatar with Ring */}
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #546e7a, #d32f2f)',
                  padding: '3px',
                }}
              >
                <div
                  className="w-full h-full rounded-full"
                  style={{ backgroundColor: '#1a1a1a' }}
                />
              </div>
              <img
                src={connection.user.avatar}
                alt={connection.user.name}
                className="relative w-16 h-16 rounded-full object-cover"
                style={{
                  border: '3px solid #1a1a1a',
                }}
              />
              {/* New Activity Indicator */}
              <div
                className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2"
                style={{
                  backgroundColor: '#d32f2f',
                  borderColor: '#1a1a1a',
                }}
              />
            </div>

            {/* Name */}
            <span
              className="text-center max-w-[70px] truncate"
              style={{ color: '#cccccc', fontSize: '0.75rem' }}
            >
              {connection.user.name.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
