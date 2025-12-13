/* eslint-disable */
import { useState } from 'react';
import { X, Search, UserMinus, Users, Activity, AlertCircle } from 'lucide-react';
import { mockConnections, mockCurrentUser } from '../../data/mockData';

interface ConnectionManagementScreenProps {
  onClose: () => void;
  isOpen?: boolean;
}

export function ConnectionManagementScreen({ onClose }: ConnectionManagementScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'active' | 'pending' | 'blocked'>('active');

  const activeConnections = mockConnections.slice(0, 8);
  const pendingConnections = mockConnections.slice(8, 10);
  const blockedUsers = mockConnections.slice(10, 11);

  const filteredConnections = activeConnections.filter(conn =>
    conn.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const usedSlots = activeConnections.length;
  const maxSlots = mockCurrentUser.connectionsMax;
  const availableSlots = maxSlots - usedSlots;

  return (
    <div className="fixed inset-0 z-50 bg-[#1a1a1a] overflow-y-auto">
      <div className="max-w-4xl mx-auto min-h-screen">
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-6 py-4 border-b border-[#333333]"
          style={{
            backgroundColor: 'rgba(26, 26, 26, 0.95)',
            backdropFilter: 'blur(40px)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="mb-0">Bond Management</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{
                backgroundColor: 'rgba(37, 37, 37, 0.8)',
              }}
            >
              <X size={20} color="#e0e0e0" />
            </button>
          </div>

          {/* Capacity Indicator */}
          <div
            className="p-4 rounded-lg mb-4"
            style={{
              backgroundColor: '#252525',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users size={18} color="#546e7a" />
                <span className="mono" style={{ color: '#546e7a', fontSize: '0.75rem' }}>
                  BOND CAPACITY
                </span>
              </div>
              <p style={{ color: '#e0e0e0' }}>
                <span style={{ color: availableSlots <= 2 ? '#d32f2f' : '#c6a700' }}>
                  {usedSlots}
                </span>
                /{maxSlots}
              </p>
            </div>
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(usedSlots / maxSlots) * 100}%`,
                  backgroundColor: availableSlots <= 2 ? '#d32f2f' : '#c6a700',
                }}
              />
            </div>
            {availableSlots <= 2 && (
              <div className="flex items-center gap-2 mt-2">
                <AlertCircle size={14} color="#d32f2f" />
                <p style={{ color: '#d32f2f', fontSize: '0.75rem' }}>
                  {availableSlots === 0
                    ? 'Connection capacity reached. Remove connections or upgrade tier.'
                    : `Only ${availableSlots} slot${availableSlots === 1 ? '' : 's'} remaining.`}
                </p>
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2"
              size={18}
              color="#a0a0a0"
            />
            <input
              type="text"
              placeholder="Search connections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg transition-all"
              style={{
                backgroundColor: '#252525',
                border: '1px solid #333333',
                color: '#e0e0e0',
                outline: 'none',
              }}
            />
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedTab('active')}
              className="px-4 py-2 rounded-full transition-all"
              style={{
                backgroundColor: selectedTab === 'active' ? '#d32f2f' : 'transparent',
                color: selectedTab === 'active' ? '#e0e0e0' : '#a0a0a0',
                border: `1px solid ${selectedTab === 'active' ? '#d32f2f' : '#333333'}`,
              }}
            >
              <span className="mono" style={{ fontSize: '0.75rem' }}>
                ACTIVE ({activeConnections.length})
              </span>
            </button>
            <button
              onClick={() => setSelectedTab('pending')}
              className="px-4 py-2 rounded-full transition-all"
              style={{
                backgroundColor: selectedTab === 'pending' ? '#d32f2f' : 'transparent',
                color: selectedTab === 'pending' ? '#e0e0e0' : '#a0a0a0',
                border: `1px solid ${selectedTab === 'pending' ? '#d32f2f' : '#333333'}`,
              }}
            >
              <span className="mono" style={{ fontSize: '0.75rem' }}>
                PENDING ({pendingConnections.length})
              </span>
            </button>
            <button
              onClick={() => setSelectedTab('blocked')}
              className="px-4 py-2 rounded-full transition-all"
              style={{
                backgroundColor: selectedTab === 'blocked' ? '#d32f2f' : 'transparent',
                color: selectedTab === 'blocked' ? '#e0e0e0' : '#a0a0a0',
                border: `1px solid ${selectedTab === 'blocked' ? '#d32f2f' : '#333333'}`,
              }}
            >
              <span className="mono" style={{ fontSize: '0.75rem' }}>
                BLOCKED ({blockedUsers.length})
              </span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 pb-24">
          {/* Active Connections */}
          {selectedTab === 'active' && (
            <div className="space-y-3">
              {filteredConnections.map((connection) => (
                <div
                  key={connection.user.id}
                  className="p-4 rounded-lg transition-all hover:bg-[#2a2a2a]"
                  style={{
                    backgroundColor: '#252525',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={connection.user.avatar}
                      alt={connection.user.name}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="truncate" style={{ color: '#e0e0e0' }}>
                          {connection.user.name}
                        </h4>
                        <div
                          className="px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: 'rgba(84, 110, 122, 0.2)',
                            border: '1px solid #546e7a',
                          }}
                        >
                          <span
                            className="mono"
                            style={{ color: '#546e7a', fontSize: '0.65rem' }}
                          >
                            {connection.matchScore}% MATCH
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Activity size={14} color="#a0a0a0" />
                          <span style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                            {connection.mutualArtists} mutual artists
                          </span>
                        </div>
                        <span style={{ color: '#666666', fontSize: '0.75rem' }}>
                          Connected {Math.floor(Math.random() * 90 + 10)} days ago
                        </span>
                      </div>
                    </div>
                    <button
                      className="p-2 rounded-lg transition-all hover:bg-[#333333]"
                      style={{
                        color: '#d32f2f',
                      }}
                    >
                      <UserMinus size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending Connections */}
          {selectedTab === 'pending' && (
            <div className="space-y-3">
              {pendingConnections.map((connection) => (
                <div
                  key={connection.user.id}
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: '#252525',
                    border: '1px solid rgba(198, 167, 0, 0.3)',
                  }}
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={connection.user.avatar}
                      alt={connection.user.name}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="truncate mb-1" style={{ color: '#e0e0e0' }}>
                        {connection.user.name}
                      </h4>
                      <p style={{ color: '#c6a700', fontSize: '0.75rem' }}>
                        Awaiting their acceptance
                      </p>
                    </div>
                    <button
                      className="px-4 py-2 rounded-full transition-all hover:bg-[#333333]"
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid #666666',
                        color: '#a0a0a0',
                        fontSize: '0.75rem',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Blocked Users */}
          {selectedTab === 'blocked' && (
            <div className="space-y-3">
              {blockedUsers.map((user) => (
                <div
                  key={user.user.id}
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: '#252525',
                    border: '1px solid rgba(211, 47, 47, 0.3)',
                  }}
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={user.user.avatar}
                      alt={user.user.name}
                      className="w-14 h-14 rounded-full object-cover opacity-50"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="truncate mb-1" style={{ color: '#e0e0e0' }}>
                        {user.user.name}
                      </h4>
                      <p style={{ color: '#d32f2f', fontSize: '0.75rem' }}>
                        Blocked user
                      </p>
                    </div>
                    <button
                      className="px-4 py-2 rounded-full transition-all hover:bg-[#333333]"
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid #546e7a',
                        color: '#546e7a',
                        fontSize: '0.75rem',
                      }}
                    >
                      Unblock
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}