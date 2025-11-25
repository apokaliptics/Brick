interface PillNavigationProps {
  activeFilter: 'all' | 'payroll' | 'network' | 'recent' | 'feed';
  onFilterChange: (filter: 'all' | 'payroll' | 'network' | 'recent' | 'feed') => void;
}

export function PillNavigation({ activeFilter, onFilterChange }: PillNavigationProps) {
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'network', label: 'Network' },
    { id: 'recent', label: 'Recent' },
    { id: 'feed', label: 'Feed' },
  ] as const;

  return (
    <div
      className="sticky top-0 md:top-14 z-40 px-6 py-4"
      style={{
        backgroundColor: 'rgba(30, 30, 30, 0.8)',
        backdropFilter: 'blur(40px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {filters.map((filter) => {
          const isActive = activeFilter === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => onFilterChange(filter.id)}
              className="px-5 py-2 rounded-full whitespace-nowrap transition-all duration-200"
              style={{
                backgroundColor: isActive ? '#e0e0e0' : 'transparent',
                color: isActive ? '#1a1a1a' : '#e0e0e0',
                border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {filter.label}
            </button>
          );
        })}
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