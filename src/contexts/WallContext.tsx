import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { WallState } from '../utils/theWall';

interface WallContextValue {
  wallState: WallState;
  pinkTierUnlocked: boolean;
  pinkUnlockTimestamp: number | null;
  themeEnabled: boolean;
  setThemeEnabled: (value: boolean) => void;
  startWarning: () => void;
  cancelWarning: () => void;
  triggerCollapse: () => void;
  resetToSecure: () => void;
}

const PinkTierStorageKey = 'pink_tier_unlocked';
const ThemeEnabledStorageKey = 'pink_theme_enabled';
const PinkUnlockTimestampStorageKey = 'pink_unlock_ts';
const stateClassnames: Record<WallState, string> = {
  SECURE: 'wall-secure',
  SHAKING: 'wall-shaking',
  COLLAPSED: 'wall-collapsed',
  REBUILDING: 'wall-rebuilding',
  CRACKED: 'wall-cracked',
};

const WallContext = createContext<WallContextValue | undefined>(undefined);

export const WallProvider = ({ children }: { children: ReactNode }) => {
  const [wallState, setWallState] = useState<WallState>('SECURE');
  const [pinkTierUnlocked, setPinkTierUnlocked] = useState(false);
  const [pinkUnlockTimestamp, setPinkUnlockTimestamp] = useState<number | null>(null);
  const [themeEnabled, setThemeEnabledState] = useState(true);
  const timersRef = useRef<number[]>([]);
  const collapseInFlightRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedUnlock = localStorage.getItem(PinkTierStorageKey);
      if (storedUnlock === 'true') {
        setPinkTierUnlocked(true);
        setWallState('CRACKED');
      }

      const storedTheme = localStorage.getItem(ThemeEnabledStorageKey);
      if (storedTheme === 'false') {
        setThemeEnabledState(false);
      }
    } catch (error) {
      console.warn('Unable to read wall theme flags:', error);
    }
  }, []);

  const persistThemeEnabled = useCallback((value: boolean) => {
    setThemeEnabledState(value);
    try {
      localStorage.setItem(ThemeEnabledStorageKey, value ? 'true' : 'false');
    } catch (error) {
      console.warn('Unable to persist wall theme preference:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    const allStateClasses = Object.values(stateClassnames);
    body.classList.remove(...allStateClasses);
    body.classList.add(stateClassnames[wallState]);
    const shouldShowTheme = themeEnabled && (pinkTierUnlocked || wallState === 'CRACKED');
    body.classList.toggle('theme-cracked', shouldShowTheme);
  }, [wallState, pinkTierUnlocked, themeEnabled]);

  const resetToSecure = useCallback(() => {
    if (pinkTierUnlocked) return;
    clearTimers();
    collapseInFlightRef.current = false;
    setWallState('SECURE');
  }, [clearTimers, pinkTierUnlocked]);

  const startWarning = useCallback(() => {
    if (pinkTierUnlocked || collapseInFlightRef.current) return;
    setWallState((current) => (current === 'SECURE' ? 'SHAKING' : current));
  }, [pinkTierUnlocked]);

  const cancelWarning = useCallback(() => {
    if (pinkTierUnlocked || collapseInFlightRef.current) return;
    setWallState((current) => (current === 'SHAKING' ? 'SECURE' : current));
  }, [pinkTierUnlocked]);

  const finalizeCrack = useCallback(() => {
    clearTimers();
    collapseInFlightRef.current = false;
    setWallState('CRACKED');
    setPinkTierUnlocked(true);
    const unlockTs = Date.now();
    setPinkUnlockTimestamp(unlockTs);
    persistThemeEnabled(true);
    try {
      localStorage.setItem(PinkTierStorageKey, 'true');
      localStorage.setItem(PinkUnlockTimestampStorageKey, String(unlockTs));
    } catch (error) {
      console.warn('Unable to persist pink tier unlock flag:', error);
    }
  }, [clearTimers, persistThemeEnabled]);

  const triggerCollapse = useCallback(() => {
    if (pinkTierUnlocked || collapseInFlightRef.current) return;
    collapseInFlightRef.current = true;
    clearTimers();
    setWallState('COLLAPSED');

    const rebuildTimer = window.setTimeout(() => {
      setWallState('REBUILDING');
    }, 5000);

    const crackedTimer = window.setTimeout(() => {
      finalizeCrack();
    }, 8000);

    timersRef.current = [rebuildTimer, crackedTimer];
  }, [clearTimers, finalizeCrack, pinkTierUnlocked]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const value = useMemo<WallContextValue>(
    () => ({
      wallState,
      pinkTierUnlocked,
      pinkUnlockTimestamp,
      themeEnabled,
      setThemeEnabled: persistThemeEnabled,
      startWarning,
      cancelWarning,
      triggerCollapse,
      resetToSecure,
    }),
    [wallState, pinkTierUnlocked, pinkUnlockTimestamp, themeEnabled, persistThemeEnabled, startWarning, cancelWarning, triggerCollapse, resetToSecure]
  );

  return <WallContext.Provider value={value}>{children}</WallContext.Provider>;
};

export const useWall = () => {
  const context = useContext(WallContext);
  if (!context) {
    throw new Error('useWall must be used within a WallProvider');
  }
  return context;
};
