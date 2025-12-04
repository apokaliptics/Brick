import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useWall } from '../contexts/WallContext';

const BRICK_COLUMNS = 8;
const BRICK_ROWS = 6;
const TOTAL_BRICKS = BRICK_COLUMNS * BRICK_ROWS;

interface BrickMeta {
  id: string;
  row: number;
  column: number;
  jitter: number;
}

interface WallOverlayProps {
  enabled?: boolean;
}

const FORCED_OVERLAY_STATES = new Set(['SHAKING', 'COLLAPSED', 'REBUILDING']);

export function WallOverlay({ enabled = true }: WallOverlayProps) {
  const { wallState } = useWall();
  const shouldRender = enabled || FORCED_OVERLAY_STATES.has(wallState);
  if (!shouldRender) {
    return null;
  }

  const bricks = useMemo<BrickMeta[]>(() => {
    return Array.from({ length: TOTAL_BRICKS }).map((_, index) => {
      const row = Math.floor(index / BRICK_COLUMNS);
      const column = index % BRICK_COLUMNS;
      return {
        id: `wall-brick-${index}`,
        row,
        column,
        jitter: (Math.random() - 0.5) * 4,
      };
    });
  }, []);

  return (
    <div className={`wall-overlay wall-overlay--${wallState.toLowerCase()}`} aria-hidden="true">
      {bricks.map((brick) => {
        const style: CSSProperties = {
          '--wall-row': `${brick.row}`,
          '--wall-column': `${brick.column}`,
          '--wall-jitter': `${brick.jitter}px`,
        } as CSSProperties;

        return <div key={brick.id} className="wall-overlay__brick" style={style} />;
      })}
    </div>
  );
}
