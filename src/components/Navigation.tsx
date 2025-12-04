import { Home, Target, Grid, Lock, Menu, X, Moon, Sun, Settings, Bell } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { Screen } from '../types';
import pinkStyles from '../styles/pinkTier.module.css';

type NavTab = Exclude<Screen, 'feed'>;

interface NavNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  unread?: boolean;
}

interface NavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  activeFilter?: 'all' | 'payroll' | 'network' | 'recent' | 'feed';
  onFilterChange?: (filter: 'all' | 'payroll' | 'network' | 'recent' | 'feed') => void;
  onSettingsClick?: () => void;
  isPinkMode?: boolean;
  notifications?: NavNotification[];
  onNotificationsViewed?: () => void;
  onNotificationDismiss?: (id: string) => void;
}

export function Navigation({
  activeTab,
  onTabChange,
  activeFilter,
  onFilterChange,
  onSettingsClick,
  isPinkMode = false,
  notifications,
  onNotificationsViewed,
  onNotificationDismiss,
}: NavigationProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { theme, toggleTheme, colors } = useTheme();
  const notificationList = notifications ?? [];
  const unreadCount = notificationList.filter((note) => note.unread).length;

  const handleNotificationToggle = () => {
    setNotificationsOpen((prev) => {
      const next = !prev;
      if (!prev && next && unreadCount > 0) {
        onNotificationsViewed?.();
      }
      return next;
    });
  };

  const formatNotificationTime = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const tabs = [
    { id: 'home', label: 'Foundation', icon: Home },
    { id: 'radar', label: 'Radar', icon: Target },
    { id: 'profile', label: 'My Wall', icon: Grid },
    { id: 'vault', label: 'Vault', icon: Lock },
  ] as const;

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'network', label: 'Network' },
    { id: 'recent', label: 'Recent' },
    { id: 'feed', label: 'Feed' },
  ] as const;

  return (
    <>
      {/* Desktop Sidebar - Fixed and always visible */}
      <div
        className={`hidden md:flex fixed left-0 top-0 bottom-0 z-50 flex-col nav-rail`}
        style={{
          width: 'var(--rail-left-width)',
          backgroundColor: 'rgba(30, 30, 30, 0.8)',
          backdropFilter: 'blur(40px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '4px 0 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b" style={{ borderColor: colors.border }}>
          <div className="flex items-center justify-between">
            <h3 style={{ color: colors.text.primary, fontSize: '1.25rem', letterSpacing: '0.08em' }}>BRICK</h3>
            <div className="relative">
              <button
                onClick={handleNotificationToggle}
                className="flex items-center justify-center rounded-full transition-colors relative"
                style={{ width: '36px', height: '36px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.2)' }}
                title="Notifications"
              >
                <Bell size={16} color={colors.text.primary} strokeWidth={2} />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[0.55rem] font-semibold"
                    style={{ width: '16px', height: '16px', backgroundColor: '#ff00cc', color: '#0c0c0c' }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div
                  className="absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl border border-white/10"
                  style={{ backgroundColor: 'rgba(10, 10, 10, 0.95)', backdropFilter: 'blur(14px)', zIndex: 60 }}
                >
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <p className="mono text-[0.65rem] tracking-[0.3em] text-white/70">ALERTS</p>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="rounded-full p-1 hover:bg-white/5 transition-colors"
                      aria-label="Close notifications"
                    >
                      <X size={14} strokeWidth={2} color="rgba(255,255,255,0.6)" />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                    {notificationList.length === 0 && (
                      <div className="px-4 py-5 text-sm text-white/60">You're all caught up.</div>
                    )}
                    {notificationList.map((note) => (
                      <div key={note.id} className="px-4 py-3 flex flex-col gap-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>
                              {note.title}
                            </p>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                              {note.message}
                            </p>
                          </div>
                          <button
                            onClick={() => onNotificationDismiss?.(note.id)}
                            className="p-1 rounded-full hover:bg-white/5 transition-colors"
                            aria-label="Dismiss notification"
                          >
                            <X size={12} strokeWidth={2} color="rgba(255,255,255,0.4)" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          <span>{formatNotificationTime(note.timestamp)}</span>
                          {note.unread && <span style={{ color: '#ff00cc' }}>NEW</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter Pills - Only show when on home tab */}
        {activeTab === 'home' && activeFilter && onFilterChange && (
          <div className="px-3 py-3 border-b border-[#333333]">
            <p className="mono mb-3 px-4" style={{ color: '#666666', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
              FILTERS
            </p>
            <div className="flex flex-col gap-1.5">
              {filters.map((filter) => {
                const isActive = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => {
                      onFilterChange(filter.id);
                      setSidebarOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover:bg-[#252525]"
                    style={{
                      backgroundColor: isActive ? 'rgba(211, 47, 47, 0.1)' : 'transparent',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.82rem',
                        color: isActive ? '#d32f2f' : '#a0a0a0',
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {filter.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto" style={{ paddingBottom: '120px' }}>
          <p className="mono mb-3 px-4" style={{ color: colors.text.tertiary, fontSize: '0.65rem', letterSpacing: '0.05em' }}>
            NAVIGATE
          </p>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isMyWall = tab.id === 'profile';
            const usePinkAccent = isMyWall && isPinkMode;
            const buttonClassName = `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1.5 transition-all duration-200 hover:opacity-80 ${usePinkAccent ? pinkStyles.navPinkButton : ''}`;
            const labelClassName = `${usePinkAccent ? pinkStyles.navPinkLabel : ''}`;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  onTabChange(tab.id);
                  setSidebarOpen(false);
                }}
                style={{
                  backgroundColor: usePinkAccent ? 'transparent' : (isActive ? 'rgba(211, 47, 47, 0.1)' : 'transparent'),
                }}
                className={buttonClassName}
              >
                <Icon
                  size={18}
                  strokeWidth={2}
                  color={usePinkAccent ? '#ffffff' : (isActive ? colors.accent : colors.text.secondary)}
                  className="transition-colors"
                />
                <span
                  className={labelClassName}
                  style={{
                    fontSize: usePinkAccent ? '1rem' : '0.82rem',
                    color: usePinkAccent ? '#ffffff' : (isActive ? colors.accent : colors.text.secondary),
                    fontWeight: usePinkAccent ? 500 : (isActive ? 600 : 400),
                  }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Theme Toggle & Settings - Sidebar Footer (raised above player) */}
        <div
          className="p-4 border-t border-[#333333] space-y-2"
          style={{
            position: 'sticky',
            bottom: '96px',
            backgroundColor: 'rgba(30, 30, 30, 0.8)',
            backdropFilter: 'blur(40px)'
          }}
        >
          <button
            onClick={onSettingsClick}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-[#252525]"
            style={{ backgroundColor: 'rgba(211, 47, 47, 0.05)' }}
          >
            <Settings size={20} strokeWidth={2} color="#d32f2f" />
            <span style={{ fontSize: '0.875rem', color: '#d32f2f', fontWeight: 600 }}>Settings</span>
          </button>
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-[#252525]"
            style={{ backgroundColor: 'rgba(211, 47, 47, 0.1)' }}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={20} strokeWidth={2} color="#d32f2f" />
                <span style={{ fontSize: '0.875rem', color: '#d32f2f', fontWeight: 600 }}>Light Mode</span>
              </>
            ) : (
              <>
                <Moon size={20} strokeWidth={2} color="#d32f2f" />
                <span style={{ fontSize: '0.875rem', color: '#d32f2f', fontWeight: 600 }}>Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Theme Toggle - Bottom Nav */}
      <div className="md:hidden fixed bottom-20 right-4 z-40">
        <button
          onClick={toggleTheme}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
          style={{
            backgroundColor: colors.bg.secondary,
            border: `1px solid ${colors.border}`,
          }}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <Sun size={20} color={colors.accent} strokeWidth={2} />
          ) : (
            <Moon size={20} color={colors.accent} strokeWidth={2} />
          )}
        </button>
      </div>

      {/* Sidebar Toggle Button removed for fixed layout */}

      {/* Sidebar Overlay - Desktop */}
      {sidebarOpen && (
        <div
          className="hidden md:block fixed inset-0 bg-black/40 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          backgroundColor: 'rgba(30, 30, 30, 0.8)',
          backdropFilter: 'blur(40px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div className="max-w-md mx-auto px-6 py-3">
          <div className="flex justify-around items-center">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className="flex flex-col items-center gap-1 py-2 px-4 transition-all"
                >
                  <Icon
                    size={24}
                    strokeWidth={2}
                    color={isActive ? '#d32f2f' : '#a0a0a0'}
                    className="transition-colors"
                  />
                  <span
                    className="mono transition-colors"
                    style={{
                      fontSize: '0.65rem',
                      color: isActive ? '#d32f2f' : '#a0a0a0',
                    }}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}