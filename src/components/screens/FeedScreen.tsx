// @ts-nocheck
/* eslint-disable */
import { Users, Music, Crown, Heart, TrendingUp, Send } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { mockFeedEvents, mockConnections, mockArtists } from '../../data/mockData';
import type { User } from '../../types';

interface FeedScreenProps {
  currentUser?: User | null;
}

export function FeedScreen({ currentUser }: FeedScreenProps) {
  const { colors } = useTheme();
  const [postContent, setPostContent] = useState('');
  const [posts, setPosts] = useState<Array<{ id: string; content: string; user: any; timestamp: string; likes: number }>>([]);

  const handlePostSubmit = () => {
    if (!postContent.trim()) return;

    const newPost = {
      id: Date.now().toString(),
      content: postContent,
      user: {
        name: currentUser?.name || 'You',
        avatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=100',
      },
      timestamp: new Date().toISOString(),
      likes: 0,
    };

    setPosts([newPost, ...posts]);
    setPostContent('');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Generate more realistic feed events
  const expandedFeedEvents = [
    ...mockFeedEvents,
    {
      id: 'feed-7',
      type: 'listening_milestone' as const,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      data: {
        user: mockConnections[0].user,
        hours: 100,
      },
    },
    {
      id: 'feed-8',
      type: 'new_favorite' as const,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      data: {
        user: mockConnections[1].user,
        track: {
          title: 'Architectural Daydreams',
          artist: mockArtists[2].name,
          coverArt: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400',
        },
        playCount: 42,
      },
    },
    {
      id: 'feed-9',
      type: 'playlist_created' as const,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      data: {
        user: mockConnections[2].user,
        playlist: {
          name: 'Midnight Foundations',
          trackCount: 28,
          coverImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
        },
      },
    },
    {
      id: 'feed-10',
      type: 'connection_formed' as const,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
      data: {
        userA: mockConnections[0].user,
        userB: mockConnections[1].user,
        matchScore: 87,
      },
    },
  ];

  return (
    <div className="pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6">
        {/* Post Creation Box */}
        <div
          className="p-5 rounded-lg mb-6"
          style={{
            backgroundColor: colors.bg.secondary,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            border: `1px solid ${colors.border}`,
          }}
        >
          <div className="flex items-start gap-4">
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=100'}
              alt={`${currentUser?.name || 'Your'} avatar`}
              className="w-10 h-10 rounded-full"
            />
            <div className="flex-1">
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="Share your thoughts on The Neighbourhood..."
                className="w-full bg-[#1a1a1a] text-[#e0e0e0] rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#d32f2f] placeholder-[#555555]"
                rows={3}
              />
              <div className="flex justify-end gap-3 mt-3">
                <button
                  onClick={() => setPostContent('')}
                  className="px-4 py-2 rounded-lg transition-colors hover:opacity-80"
                  style={{
                    color: colors.text.secondary,
                    backgroundColor: colors.bg.primary,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePostSubmit}
                  disabled={!postContent.trim()}
                  className="px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: postContent.trim() ? colors.accent : colors.text.tertiary,
                    color: '#e0e0e0',
                    fontWeight: 600,
                  }}
                >
                  <Send size={16} />
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* User Posts */}
        {posts.length > 0 && (
          <div className="space-y-4 mb-6">
            {posts.map((post) => {
              const timeAgo = new Date();
              const postDate = new Date(post.timestamp);
              const diffMs = timeAgo.getTime() - postDate.getTime();
              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
              const timeString = diffHours < 1 ? 'Just now' : diffHours < 24 ? `${diffHours}h ago` : `${Math.floor(diffHours / 24)}d ago`;

              return (
                <div
                  key={post.id}
                  className="p-5 rounded-lg"
                  style={{
                    backgroundColor: '#252525',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={post.user.avatar}
                      alt={post.user.name}
                      className="w-12 h-12 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <p style={{ color: colors.text.primary }} className="font-semibold">
                          {post.user.name}
                        </p>
                        <p className="mono" style={{ color: colors.text.tertiary, fontSize: '0.7rem' }}>
                          {timeString}
                        </p>
                      </div>
                      <p style={{ color: colors.text.primary }} className="mb-3 leading-relaxed">
                        {post.content}
                      </p>
                      <button
                        onClick={() => {
                          const updatedPosts = posts.map(p =>
                            p.id === post.id ? { ...p, likes: p.likes + 1 } : p
                          );
                          setPosts(updatedPosts);
                        }}
                        className="flex items-center gap-2 px-3 py-1 rounded-lg transition-colors hover:bg-[#1a1a1a]"
                      >
                        <Heart
                          size={16}
                          fill={post.likes > 0 ? '#d32f2f' : 'none'}
                          color={post.likes > 0 ? '#d32f2f' : '#a0a0a0'}
                        />
                        <span style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
                          {post.likes > 0 ? post.likes : 'Like'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Feed Events */}
        <div className="space-y-4">
          {expandedFeedEvents.map((event) => {
            if (event.type === 'playlist_created') {
              return (
                <div
                  key={event.id}
                  className="p-5 rounded-lg"
                  style={{
                    backgroundColor: '#252525',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <img
                      src={event.data.user.avatar}
                      alt={event.data.user.name}
                      className="w-12 h-12 rounded-full"
                    />
                    <div className="flex-1">
                      <p style={{ color: '#e0e0e0' }}>
                        <strong>{event.data.user.name}</strong> created a new brick
                      </p>
                      <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
                        {formatTime(event.timestamp)}
                      </p>
                    </div>
                    <Music size={20} color="#d32f2f" />
                  </div>

                  <div
                    className="p-3 rounded-lg"
                    style={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333333',
                    }}
                  >
                    <h4 className="mb-3" style={{ color: '#e0e0e0' }}>
                      {event.data.playlist.name}
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <img
                          key={i}
                          src={event.data.playlist.coverImage}
                          alt=""
                          className="w-full aspect-square object-cover rounded"
                        />
                      ))}
                    </div>
                    <p className="mono mt-2" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
                      {event.data.playlist.trackCount} tracks
                    </p>
                  </div>
                </div>
              );
            }

            if (event.type === 'connection_formed') {
              return (
                <div
                  key={event.id}
                  className="p-5 rounded-lg"
                  style={{
                    backgroundColor: '#252525',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex -space-x-2">
                      <img
                        src={event.data.userA.avatar}
                        alt={event.data.userA.name}
                        className="w-10 h-10 rounded-full border-2 border-[#252525]"
                      />
                      <img
                        src={event.data.userB.avatar}
                        alt={event.data.userB.name}
                        className="w-10 h-10 rounded-full border-2 border-[#252525]"
                      />
                    </div>
                    <div className="flex-1">
                      <p style={{ color: '#e0e0e0' }}>
                        <strong>{event.data.userA.name}</strong> connected with{' '}
                        <strong>{event.data.userB.name}</strong>
                      </p>
                      <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
                        {formatTime(event.timestamp)}
                      </p>
                    </div>
                    <Users size={20} color="#546e7a" />
                  </div>

                  <div
                    className="p-3 rounded-lg text-center"
                    style={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333333',
                    }}
                  >
                    <p className="mono" style={{ color: '#546e7a', fontSize: '1.5rem' }}>
                      {event.data.matchScore}%
                    </p>
                    <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
                      STRUCTURAL INTEGRITY
                    </p>
                  </div>
                </div>
              );
            }

            if (event.type === 'patronage_update') {
              return (
                <div
                  key={event.id}
                  className="p-5 rounded-lg"
                  style={{
                    backgroundColor: '#252525',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <img
                      src={event.data.user.avatar}
                      alt={event.data.user.name}
                      className="w-12 h-12 rounded-full"
                    />
                    <div className="flex-1">
                      <p style={{ color: '#e0e0e0' }}>
                        <strong>{event.data.user.name}</strong> chose a new artist for November
                      </p>
                      <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
                        {formatTime(event.timestamp)}
                      </p>
                    </div>
                    <Crown size={20} color="#d32f2f" />
                  </div>

                  <div
                    className="p-4 rounded-lg flex items-center gap-4"
                    style={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333333',
                    }}
                  >
                    <img
                      src={event.data.artist.image}
                      alt={event.data.artist.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h4 style={{ color: '#e0e0e0' }}>{event.data.artist.name}</h4>
                      <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
                        {event.data.artist.genre}
                      </p>
                    </div>
                  </div>

                  <button
                    className="w-full mt-3 py-2 rounded-full transition-all hover:bg-[#2a2a2a]"
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #546e7a',
                      color: '#546e7a',
                    }}
                  >
                    <span className="mono" style={{ fontSize: '0.75rem' }}>
                      Listen Ad-Free via {event.data.user.name}
                    </span>
                  </button>
                </div>
              );
            }

            if (event.type === 'listening_milestone') {
              return (
                <div
                  key={event.id}
                  className="p-5 rounded-lg"
                  style={{
                    backgroundColor: '#252525',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <img
                      src={event.data.user.avatar}
                      alt={event.data.user.name}
                      className="w-12 h-12 rounded-full"
                    />
                    <div className="flex-1">
                      <p style={{ color: '#e0e0e0' }}>
                        <strong>{event.data.user.name}</strong> reached {event.data.hours} hours of listening
                      </p>
                      <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
                        {formatTime(event.timestamp)}
                      </p>
                    </div>
                    <TrendingUp size={20} color="#d32f2f" />
                  </div>

                  <div
                    className="p-4 rounded-lg flex items-center gap-4"
                    style={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333333',
                    }}
                  >
                    <img
                      src={event.data.user.avatar}
                      alt={event.data.user.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h4 style={{ color: '#e0e0e0' }}>{event.data.user.name}</h4>
                      <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
                        {event.data.hours} hours of listening
                      </p>
                    </div>
                  </div>

                  <button
                    className="w-full mt-3 py-2 rounded-full transition-all hover:bg-[#2a2a2a]"
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #546e7a',
                      color: '#546e7a',
                    }}
                  >
                    <span className="mono" style={{ fontSize: '0.75rem' }}>
                      Celebrate with {event.data.user.name}
                    </span>
                  </button>
                </div>
              );
            }

            if (event.type === 'new_favorite') {
              return (
                <div
                  key={event.id}
                  className="p-5 rounded-lg"
                  style={{
                    backgroundColor: '#252525',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <img
                      src={event.data.user.avatar}
                      alt={event.data.user.name}
                      className="w-12 h-12 rounded-full"
                    />
                    <div className="flex-1">
                      <p style={{ color: '#e0e0e0' }}>
                        <strong>{event.data.user.name}</strong> added a new favorite track
                      </p>
                      <p className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
                        {formatTime(event.timestamp)}
                      </p>
                    </div>
                    <Heart size={20} color="#d32f2f" />
                  </div>

                  <div
                    className="p-4 rounded-lg flex items-center gap-4"
                    style={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333333',
                    }}
                  >
                    <img
                      src={event.data.track.coverArt}
                      alt={event.data.track.title}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h4 style={{ color: '#e0e0e0' }}>{event.data.track.title}</h4>
                      <p style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
                        {event.data.track.artist}
                      </p>
                    </div>
                  </div>

                  <button
                    className="w-full mt-3 py-2 rounded-full transition-all hover:bg-[#2a2a2a]"
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #546e7a',
                      color: '#546e7a',
                    }}
                  >
                    <span className="mono" style={{ fontSize: '0.75rem' }}>
                      Listen to {event.data.track.title}
                    </span>
                  </button>
                </div>
              );
            }

            return null;
          })}
        </div>

        {/* Load More */}
        <div className="mt-6 text-center">
          <button
            className="px-6 py-3 rounded-full transition-all hover:bg-[#2a2a2a]"
            style={{
              backgroundColor: '#252525',
              border: '1px solid #333333',
              color: '#a0a0a0',
            }}
          >
            <span className="mono" style={{ fontSize: '0.75rem' }}>
              Load More
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}