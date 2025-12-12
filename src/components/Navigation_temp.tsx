import { Home, Target, Grid, Lock, Menu, X, Moon, Sun, Settings } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface NavigationProps {
  activeTab: 'home' | 'radar' | 'profile' | 'vault';
  onTabChange: (tab: 'home' | 'radar' | 'profile' | 'vault') => void;
  activeFilter?: 'all' | 'payroll' | 'network' | 'recent' | 'feed';
  onFilterChange?: (filter: 'all' | 'payroll' | 'network' | 'recent' | 'feed') => void;
  onSettingsClick?: () => void;
}

export function Navigation({ activeTab, onTabChange, activeFilter, onFilterChange, onSettingsClick }: NavigationProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme, colors } = useTheme();


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
      {/* Desktop Sidebar - Hidden by default, slides in when opened */}
      <div
        className={`hidden md:flex fixed left-0 top-0 bottom-0 z-50 flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          width: '240px',
          backgroundColor: 'rgba(30, 30, 30, 0.8)',
          backdropFilter: 'blur(40px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '4px 0 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b" style={{ borderColor: colors.border }}>
          <div className="flex items-center justify-between">
            <h3 style={{ color: colors.text.primary, fontSize: '1.25rem' }}>BRICK</h3>
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
              style={{ backgroundColor: colors.bg.secondary }}
            >
              <X size={18} color={colors.text.secondary} />
            </button>
          </div>
        </div>

        {/* Filter Pills - Only show when on home tab */}
        {activeTab === 'home' && activeFilter && onFilterChange && (
          <div className="p-4 border-b border-[#333333]">
            <p className="mono mb-3 px-4" style={{ color: '#666666', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
              FILTERS
            </p>
            <div className="flex flex-col gap-2">
              {filters.map((filter) => {
                const isActive = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => {
                      onFilterChange(filter.id);
                      setSidebarOpen(false);
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-[#252525]"
                    style={{
                      backgroundColor: isActive ? 'rgba(211, 47, 47, 0.1)' : 'transparent',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.875rem',
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
        <nav className="flex-1 p-4">
          <p className="mono mb-3 px-4" style={{ color: colors.text.tertiary, fontSize: '0.65rem', letterSpacing: '0.05em' }}>
            NAVIGATE
          </p>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  console.log('Navigation: clicking tab:', tab.id);
                  onTabChange(tab.id);
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-xl mb-2 transition-all duration-200 hover:opacity-80"
                style={{
                  backgroundColor: isActive ? 'rgba(211, 47, 47, 0.1)' : 'transparent',
                }}
              >
                <Icon
                  size={20}
                  strokeWidth={2}
                  color={isActive ? colors.accent : colors.text.secondary}
                  className="transition-colors"
                />
                <span
                  style={{
                    fontSize: '0.875rem',
                    color: isActive ? colors.accent : colors.text.secondary,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Theme Toggle & Settings - Sidebar Footer */}
        <div className="p-4 border-t border-[#333333] space-y-2">
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

      {/* Sidebar Toggle Button - Desktop Only */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="hidden md:flex fixed left-4 top-4 z-40 w-10 h-10 rounded-full items-center justify-center transition-all duration-200 hover:scale-110"
        style={{
          backgroundColor: 'rgba(30, 30, 30, 0.8)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
      >
        <Menu size={20} color="#e0e0e0" />
      </button>

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
                  onClick={() => {
                    console.log('Navigation mobile: clicking tab:', tab.id);
                    onTabChange(tab.id);
                  }}
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
