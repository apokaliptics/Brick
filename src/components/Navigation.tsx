import { Home, Target, Grid, Lock, Menu, X, Moon, Sun, Settings, Bell, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useWall } from '../contexts/WallContext';
import type { Screen } from '../types';
import pinkStyles from '../styles/pinkTier.module.css';

type NavTab = Screen;

interface NavNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  unread?: boolean;
  system?: boolean;
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
  pinkTierLabel?: string;
  pinkTierUnlocked?: boolean;
  pinkUnlockTimestamp?: number | null;
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
  pinkTierLabel,
  pinkTierUnlocked,
  pinkUnlockTimestamp,
}: NavigationProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { theme, toggleTheme, colors } = useTheme();
  const { pinkTierUnlocked: contextPinkUnlocked } = useWall();
  const baseNotifications = notifications ?? [];
  const pinkBadgeNotification = useMemo<NavNotification | null>(() => {
    const unlocked = pinkTierUnlocked ?? contextPinkUnlocked;
    if (!unlocked) return null;
    return {
      id: 'pink-tier-alert',
      title: 'Pink Badge Activated',
      message: pinkTierLabel ? `You've received the ${pinkTierLabel} badge.` : "You've received the Pink badge.",
      timestamp: pinkUnlockTimestamp ?? Date.now(),
      unread: false,
      system: true,
    };
  }, [contextPinkUnlocked, pinkTierLabel, pinkTierUnlocked, pinkUnlockTimestamp]);

  const notificationList = useMemo(() => {
    if (!pinkBadgeNotification) {
      return baseNotifications;
    }
    const exists = baseNotifications.some((note) => note.id === pinkBadgeNotification.id);
    if (exists) {
      return baseNotifications;
    }
    return [pinkBadgeNotification, ...baseNotifications];
  }, [baseNotifications, pinkBadgeNotification]);
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
    { id: 'feed', label: 'Neighborhood', icon: Users },
    { id: 'vault', label: 'Vault', icon: Lock },
  ] as const;

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'network', label: 'Network' },
    { id: 'recent', label: 'Recent' },
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
                className={`flex items-center justify-center rounded-full transition-all duration-300 relative overflow-hidden group ${
                  unreadCount > 0 ? 'notification-glow' : ''
                }`}
                style={{
                  width: '36px',
                  height: '36px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: unreadCount > 0
                    ? 'linear-gradient(135deg, rgba(211,47,47,0.15), rgba(198,166,0,0.1), rgba(84,110,122,0.1))'
                    : 'linear-gradient(135deg, rgba(30,30,30,0.8), rgba(20,20,20,0.9))',
                  boxShadow: unreadCount > 0
                    ? '0 0 20px rgba(211,47,47,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.3)',
                  backdropFilter: 'blur(10px)',
                }}
                title="Notifications"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Bell
                  size={16}
                  color={unreadCount > 0 ? '#ff6b6b' : colors.text.primary}
                  strokeWidth={unreadCount > 0 ? 2.5 : 2}
                  className="relative z-10 transition-all duration-300"
                />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[0.55rem] font-bold notification-badge"
                    style={{
                      width: '18px',
                      height: '18px',
                      background: 'linear-gradient(135deg, #ff00cc, #ff6b6b)',
                      color: '#ffffff',
                      boxShadow: '0 0 12px rgba(255,0,204,0.6), 0 2px 4px rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div
                  className="absolute mt-4 rounded-xl shadow-2xl border notification-popover spring-in fade-in"
                  style={{
                    width: '420px',
                    maxHeight: '280px',
                    right: '-220px',
                    backgroundColor: 'rgba(18, 18, 18, 0.96)',
                    backdropFilter: 'blur(20px)',
                    borderColor: 'rgba(198, 167, 0, 0.15)',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(198, 167, 0, 0.08), inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                    zIndex: 60,
                  }}
                >
                  <div
                    className="px-6 py-3 border-b flex items-center justify-between"
                    style={{
                      borderColor: 'rgba(198, 167, 0, 0.1)',
                      background: 'linear-gradient(180deg, rgba(198, 167, 0, 0.04), rgba(198, 167, 0, 0.01))',
                    }}
                  >
                    <p className="text-[0.65rem] uppercase tracking-[0.25em] font-semibold" style={{ color: 'rgba(198, 167, 0, 0.8)' }}>
                      ALERTS
                    </p>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="rounded-full p-1 hover:bg-white/5 transition-all duration-200"
                      aria-label="Close notifications"
                      style={{ color: 'rgba(255,255,255,0.5)' }}
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: '240px' }}>
                    {notificationList.length === 0 && (
                      <div
                        className="px-8 py-10 text-base text-center"
                        style={{
                          color: 'rgba(255,255,255,0.72)',
                          lineHeight: '1.5',
                          minHeight: '72px',
                          letterSpacing: '0.02em',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        You're all caught up.
                      </div>
                    )}
                    {notificationList.map((note, idx) => {
                      const isSystemNotification = Boolean(note.system);
                      const isLast = idx === notificationList.length - 1;
                      return (
                        <div
                          key={note.id}
                          className={`px-6 py-3 flex items-center gap-3 notification-item ${!isLast ? 'border-b' : ''}`}
                          style={{
                            borderColor: 'rgba(255, 255, 255, 0.03)',
                            background: note.unread ? 'rgba(198, 167, 0, 0.02)' : 'transparent',
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-semibold truncate"
                              style={{
                                color: isSystemNotification ? 'rgba(198, 167, 0, 0.95)' : '#e0e0e0',
                                letterSpacing: '-0.01em',
                              }}
                            >
                              {note.title}
                            </p>
                            <p className="text-[0.72rem] notification-message" style={{ color: 'rgba(255,255,255,0.55)', lineHeight: '1.25rem' }}>
                              {note.message}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-[0.6rem]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                              {formatNotificationTime(note.timestamp)}
                            </span>
                            {!isSystemNotification && (
                              <button
                                onClick={() => onNotificationDismiss?.(note.id)}
                                className="p-0.5 rounded hover:bg-white/10 transition-colors"
                                aria-label="Dismiss notification"
                                style={{ color: 'rgba(255,255,255,0.4)' }}
                              >
                                <X size={12} strokeWidth={2} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
            const buttonClassName = `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1.5 nav-tab ${isActive ? 'nav-tab-active' : ''} transition-all duration-200 hover:opacity-80 ${usePinkAccent ? pinkStyles.navPinkButton : ''}`;
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
                aria-current={isActive ? 'page' : undefined}
              >
                {/* indicator removed per UX: simpler left nav without left bar */}
                <Icon
                  size={18}
                  strokeWidth={2}
                  color={usePinkAccent ? '#ffffff' : (isActive ? colors.accent : colors.text.secondary)}
                  className={`nav-icon transition-colors ${isActive ? 'text-accent' : ''}`}
                />
                <span
                  className={`${labelClassName} nav-label ${isActive ? 'nav-label-active' : ''}`}
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
          className="hidden md:block fixed inset-0 bg-transparent z-40"
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