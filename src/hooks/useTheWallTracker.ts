// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWall } from '../contexts/WallContext';
import type { Track } from '../types';
import {
  WALL_COLLAPSE_TIME_SECONDS,
  WALL_REQUIRED_COMPLETED_TRACKS,
  WALL_WARNING_TIME_SECONDS,
  getWallTrackOrder,
  isTheTrialTrack,
  isWallAlbumTrack,
} from '../utils/theWall';

interface UseWallTrackerOptions {
  currentTrack: Track | null;
  currentTime: number;
  isPlaying: boolean;
}

interface WallTrackerApi {
  consecutiveTracks: number;
  registerNaturalCompletion: (track: Track | null) => void;
  invalidateSession: (reason?: string) => void;
}

const LONG_PAUSE_RESET_MS = 10 * 60 * 1000; // 10 minutes

export function useTheWallTracker({ currentTrack, currentTime, isPlaying }: UseWallTrackerOptions): WallTrackerApi {
  const { startWarning, cancelWarning, triggerCollapse, pinkTierUnlocked } = useWall();
  const [consecutiveTracks, setConsecutiveTracks] = useState(0);

  const countRef = useRef(0);
  const lastOrderRef = useRef<number | null>(null);
  const warningArmedRef = useRef(false);
  const collapseTriggeredRef = useRef(false);
  const pauseTimerRef = useRef<number | null>(null);

  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current !== null) {
      if (typeof window !== 'undefined') {
        window.clearTimeout(pauseTimerRef.current);
      }
      pauseTimerRef.current = null;
    }
  }, []);

  const resetSession = useCallback(
    () => {
      if (countRef.current !== 0 || warningArmedRef.current) {
        cancelWarning();
      }
      countRef.current = 0;
      lastOrderRef.current = null;
      warningArmedRef.current = false;
      collapseTriggeredRef.current = false;
      setConsecutiveTracks(0);
    },
    [cancelWarning]
  );

  const invalidateSession = useCallback(
    () => {
      if (pinkTierUnlocked) return;
      resetSession();
    },
    [pinkTierUnlocked, resetSession]
  );

  const registerNaturalCompletion = useCallback(
    (track: Track | null) => {
      if (pinkTierUnlocked) return;
      if (!track) {
        invalidateSession('missing-track');
        return;
      }

      if (!isWallAlbumTrack(track)) {
        invalidateSession('non-wall');
        return;
      }

      const order = getWallTrackOrder(track);
      if (order === null) {
        invalidateSession('unknown-order');
        return;
      }

      const expectedNext = (lastOrderRef.current ?? -1) + 1;

      if (order === 0 && countRef.current === 0) {
        lastOrderRef.current = 0;
        countRef.current = 1;
        setConsecutiveTracks(1);
        return;
      }

      if (order === expectedNext) {
        lastOrderRef.current = order;
        const nextCount = order + 1;
        countRef.current = nextCount;
        setConsecutiveTracks(nextCount);
        return;
      }

      if (order === 0) {
        lastOrderRef.current = 0;
        countRef.current = 1;
        setConsecutiveTracks(1);
        warningArmedRef.current = false;
        collapseTriggeredRef.current = false;
        cancelWarning();
        return;
      }

      invalidateSession('out-of-order');
    },
    [cancelWarning, invalidateSession, pinkTierUnlocked]
  );

  // Reset if user pauses for more than 10 minutes (optional requirement)
  useEffect(() => {
    if (pinkTierUnlocked || typeof window === 'undefined') return;
    if (!isPlaying) {
      if (pauseTimerRef.current === null) {
        pauseTimerRef.current = window.setTimeout(() => {
          invalidateSession('long-pause');
          pauseTimerRef.current = null;
        }, LONG_PAUSE_RESET_MS);
      }
    } else {
      clearPauseTimer();
    }

    return () => {
      clearPauseTimer();
    };
  }, [isPlaying, invalidateSession, clearPauseTimer, pinkTierUnlocked]);

  useEffect(() => {
    if (pinkTierUnlocked) return;
    if (!currentTrack) {
      warningArmedRef.current = false;
      collapseTriggeredRef.current = false;
      cancelWarning();
      return;
    }

    if (!isWallAlbumTrack(currentTrack)) {
      if (countRef.current > 0) {
        invalidateSession('switched-album');
      }
      return;
    }

    if (!isTheTrialTrack(currentTrack)) {
      if (warningArmedRef.current) {
        warningArmedRef.current = false;
        cancelWarning();
      }
      collapseTriggeredRef.current = false;
      return;
    }

    const hasValidSession = countRef.current >= WALL_REQUIRED_COMPLETED_TRACKS;

    if (!hasValidSession) {
      if (warningArmedRef.current) {
        warningArmedRef.current = false;
        cancelWarning();
      }
      return;
    }

    if (
      currentTime >= WALL_WARNING_TIME_SECONDS &&
      currentTime < WALL_COLLAPSE_TIME_SECONDS &&
      !warningArmedRef.current
    ) {
      startWarning();
      warningArmedRef.current = true;
    }

    if (currentTime < WALL_WARNING_TIME_SECONDS && warningArmedRef.current) {
      warningArmedRef.current = false;
      cancelWarning();
    }

    if (currentTime >= WALL_COLLAPSE_TIME_SECONDS && !collapseTriggeredRef.current) {
      collapseTriggeredRef.current = true;
      triggerCollapse();
    }
  }, [currentTrack, currentTime, cancelWarning, invalidateSession, pinkTierUnlocked, startWarning, triggerCollapse]);

  const api = useMemo<WallTrackerApi>(
    () => ({ consecutiveTracks, registerNaturalCompletion, invalidateSession }),
    [consecutiveTracks, registerNaturalCompletion, invalidateSession]
  );

  return api;
}
