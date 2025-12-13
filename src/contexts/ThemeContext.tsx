import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
  colors: {
    bg: {
      primary: string;
      secondary: string;
      tertiary: string;
    };
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
    };
    accent: string;
    border: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage or system preference
    const saved = localStorage.getItem('brick-theme') as Theme | null;
    if (saved) return saved;
    
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });

  const isDark = theme === 'dark';

  const colors = isDark
    ? {
        bg: {
          primary: '#1a1a1a',
          secondary: '#252525',
          tertiary: '#2a2a2a',
        },
        text: {
          primary: '#e0e0e0',
          secondary: '#a0a0a0',
          tertiary: '#666666',
        },
        accent: '#d32f2f',
        border: '#333333',
      }
    : {
        bg: {
          primary: '#ffffff',
          secondary: '#f8f8f8',
          tertiary: '#e8e8e8',
        },
        text: {
          primary: '#1a1a1a',
          secondary: '#666666',
          tertiary: '#999999',
        },
        accent: '#d32f2f',
        border: '#cccccc',
      };

  useEffect(() => {
    localStorage.setItem('brick-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev: Theme) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
