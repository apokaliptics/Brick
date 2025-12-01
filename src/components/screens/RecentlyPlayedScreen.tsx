// @ts-ignore
import { useEffect, useState } from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { getRecentlyPlayedTracks, clearRecentlyPlayedTracks, removeRecentlyPlayedTrack, RecentlyPlayedTrack } from '../../utils/recentlyPlayed';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface RecentlyPlayedScreenProps {
  onTrackPlay?: (track: RecentlyPlayedTrack) => void;
}

export function RecentlyPlayedScreen({ onTrackPlay }: RecentlyPlayedScreenProps) {
  const [tracks, setTracks] = useState<RecentlyPlayedTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentlyPlayed();
  }, []);

  const loadRecentlyPlayed = async () => {
    try {
      const recentTracks = await getRecentlyPlayedTracks(100);
      setTracks(recentTracks);
    } catch (error) {
      console.error('Failed to load recently played tracks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    try {
      await removeRecentlyPlayedTrack(trackId);
      setTracks((tracks: RecentlyPlayedTrack[]) => tracks.filter((t: RecentlyPlayedTrack) => t.trackId !== trackId));
    } catch (error) {
      console.error('Failed to remove track:', error);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all recently played tracks?')) return;
    try {
      await clearRecentlyPlayedTracks();
      setTracks([]);
    } catch (error) {
      console.error('Failed to clear recently played:', error);
    }
  };

  const formatPlayedTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    return `${Math.floor(days / 30)}m ago`;
  };

  if (loading) {
    return (
      // @ts-ignore
      <div className="flex items-center justify-center h-screen">
        <p style={{ color: '#a0a0a0' }}>Loading recently played tracks...</p>
      </div>
    );
  }

  return (
    // @ts-ignore - JSX type warnings due to missing React types
    <div className="p-6 pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Clock size={32} color="#d32f2f" />
            <div>
              <h1 style={{ color: '#e0e0e0' }} className="text-3xl font-bold">
                Recently Played
              </h1>
              <p style={{ color: '#a0a0a0' }} className="text-sm mt-1">
                {tracks.length} track{tracks.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {tracks.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 active:scale-95"
              style={{
                backgroundColor: '#252525',
                color: '#d32f2f',
                border: '1px solid #d32f2f',
              }}
            >
              Clear All
            </button>
          )}
        </div>

        {/* Tracks List */}
        {tracks.length === 0 ? (
          <div className="text-center py-20">
            <Clock size={48} color="#444444" className="mx-auto mb-4 opacity-50" />
            <p style={{ color: '#666666' }} className="text-lg mb-2">
              No recently played tracks
            </p>
            <p style={{ color: '#555555' }} className="text-sm">
              Your listening history will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tracks.map((track: RecentlyPlayedTrack, index: number) => (
              <div
                key={`${track.trackId}-${index}`}
                className="flex items-center gap-4 p-3 rounded-lg group hover:bg-[#252525] transition-colors cursor-pointer"
                onClick={() => onTrackPlay?.(track)}
              >
                {/* Track Number */}
                <span
                  style={{ color: '#666666', minWidth: '2rem' }}
                  className="text-sm font-mono text-center"
                >
                  {index + 1}
                </span>

                {/* Album Art */}
                <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                  <ImageWithFallback
                    src={track.coverArt}
                    alt={track.trackTitle}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <p
                    style={{ color: '#e0e0e0' }}
                    className="font-medium truncate hover:text-[#d32f2f] transition-colors"
                  >
                    {track.trackTitle}
                  </p>
                  <p style={{ color: '#a0a0a0' }} className="text-sm truncate">
                    {track.artistName}
                  </p>
                </div>

                {/* Played Time */}
                <span
                  style={{ color: '#666666' }}
                  className="text-sm flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {formatPlayedTime(track.playedAt)}
                </span>

                {/* Remove Button */}
                <button
                  onClick={(e: any) => {
                    e.stopPropagation();
                    handleRemoveTrack(track.trackId);
                  }}
                  className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-[#1a1a1a] hover:text-[#d32f2f]"
                >
                  <Trash2 size={16} color="#a0a0a0" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
