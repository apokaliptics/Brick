import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useWall } from '../contexts/WallContext';
import { WALL_COLLAPSE_TIME_SECONDS, WALL_WARNING_TIME_SECONDS } from '../utils/theWall';

interface WallDebugPanelProps {
  isPinkEnabled: boolean;
  onPinkOverride: (value: boolean) => void;
}

declare global {
  interface Window {
    brickWallDebug?: {
      enable: () => void;
      disable: () => void;
    };
  }
}

const buttonBaseStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(0,0,0,0.5)',
  color: '#f5f5f5',
  fontSize: '0.75rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  borderRadius: '6px',
  padding: '6px 10px',
  cursor: 'pointer',
  transition: 'background 0.2s ease, transform 0.2s ease',
};

export function WallDebugPanel({ isPinkEnabled, onPinkOverride }: WallDebugPanelProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(import.meta.env.DEV);
  const collapseTimerRef = useRef<number | null>(null);
  const {
    wallState,
    pinkTierUnlocked,
    themeEnabled,
    setThemeEnabled,
    startWarning,
    cancelWarning,
    triggerCollapse,
    resetToSecure,
  } = useWall();

  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('brick_wall_debug');
      if (stored === 'true') {
        setDebugEnabled(true);
      }
    } catch {
      /* ignore storage errors */
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.brickWallDebug = {
      enable: () => {
        setDebugEnabled(true);
        try {
          window.localStorage.setItem('brick_wall_debug', 'true');
        } catch {
          /* ignore storage errors */
        }
      },
      disable: () => {
        setDebugEnabled(false);
        setPanelOpen(false);
        try {
          window.localStorage.removeItem('brick_wall_debug');
        } catch {
          /* ignore storage errors */
        }
      },
    };
    return () => {
      if (window.brickWallDebug) {
        delete window.brickWallDebug;
      }
    };
  }, []);

  useEffect(() => () => {
    if (collapseTimerRef.current) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }, []);

  const collapseDelayMs = useMemo(() => {
    const diff = (WALL_COLLAPSE_TIME_SECONDS - WALL_WARNING_TIME_SECONDS) * 1000;
    return Math.max(diff, 1500);
  }, []);

  const summaryItems = useMemo(() => [
    { label: 'Wall State', value: wallState },
    { label: 'Pink Tier', value: pinkTierUnlocked ? 'Unlocked' : 'Locked' },
    { label: 'Overlay', value: isPinkEnabled ? 'Forced On' : 'Auto' },
    { label: 'Theme', value: themeEnabled ? 'Enabled' : 'Hidden' },
  ], [isPinkEnabled, pinkTierUnlocked, themeEnabled, wallState]);

  const simulateTrial = () => {
    cancelWarning();
    resetToSecure();
    startWarning();
    if (collapseTimerRef.current) {
      window.clearTimeout(collapseTimerRef.current);
    }
    collapseTimerRef.current = window.setTimeout(() => {
      triggerCollapse();
      collapseTimerRef.current = null;
    }, collapseDelayMs);
  };

  if (!debugEnabled) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '96px',
        right: '24px',
        zIndex: 80,
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        onClick={() => setPanelOpen((prev) => !prev)}
        style={{
          ...buttonBaseStyle,
          pointerEvents: 'auto',
          background: panelOpen ? 'rgba(255,0,204,0.2)' : 'rgba(0,0,0,0.6)',
          borderColor: panelOpen ? 'rgba(255,0,204,0.7)' : 'rgba(255,255,255,0.2)',
          boxShadow: panelOpen ? '0 0 12px rgba(255,0,204,0.4)' : 'none',
        }}
      >
        {panelOpen ? 'Close Wall Debug' : 'Wall Debug'}
      </button>

      {panelOpen && (
        <div
          style={{
            marginTop: '8px',
            width: '320px',
            maxWidth: 'calc(100vw - 32px)',
            background: 'rgba(8,8,8,0.92)',
            border: '1px solid rgba(255,0,204,0.35)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            pointerEvents: 'auto',
            backdropFilter: 'blur(18px)',
          }}
        >
          <p
            style={{
              marginBottom: '12px',
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.75)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Simulate "The Trial" without replaying the entire album. Actions below call the same hooks that the easter egg uses.
          </p>

          <div style={{ display: 'grid', gap: '6px', marginBottom: '12px' }}>
            {summaryItems.map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: 'rgba(255,255,255,0.85)',
                  letterSpacing: '0.05em',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.55)' }}>{item.label}</span>
                <span>{item.value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginBottom: '12px' }}>
            <button type="button" style={buttonBaseStyle} onClick={resetToSecure}>
              Reset Secure
            </button>
            <button type="button" style={buttonBaseStyle} onClick={startWarning}>
              Shake Wall
            </button>
            <button type="button" style={buttonBaseStyle} onClick={cancelWarning}>
              Cancel Shake
            </button>
            <button type="button" style={buttonBaseStyle} onClick={triggerCollapse}>
              Collapse Now
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginBottom: '12px' }}>
            <button type="button" style={{ ...buttonBaseStyle, background: 'rgba(255,0,204,0.15)', borderColor: 'rgba(255,0,204,0.5)' }} onClick={simulateTrial}>
              Simulate Trial Hit
            </button>
            <button
              type="button"
              style={buttonBaseStyle}
              onClick={() => setThemeEnabled(!themeEnabled)}
            >
              {themeEnabled ? 'Hide Pink Theme' : 'Show Pink Theme'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
            <button
              type="button"
              style={buttonBaseStyle}
              onClick={() => onPinkOverride(!isPinkEnabled)}
            >
              {isPinkEnabled ? 'Disable Overlay' : 'Force Overlay'}
            </button>
            <button
              type="button"
              style={buttonBaseStyle}
              onClick={() => {
                window.brickWallDebug?.disable();
              }}
            >
              Hide Debugger
            </button>
          </div>

          <p
            style={{
              marginTop: '12px',
              fontSize: '0.65rem',
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.04em',
            }}
          >
            Tip: run <code>window.brickWallDebug.enable()</code> in the console to re-open this panel outside dev builds.
          </p>
        </div>
      )}
    </div>
  );
}
