/* eslint-disable */
import React, { useEffect, useRef } from 'react';

type Props = {
  analyser: AnalyserNode | null;
  enabled: boolean;
};

export default function SeismicMonitor({ analyser, enabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef<Uint8Array | null>(null);

  // Keep canvas pixel size in sync with CSS size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // smoothing buffer to hold previous values for EMA
    let smoothing: Float32Array | null = null;
    const smoothingAlpha = 0.35; // Lower = smoother

    const drawGrid = (cx: number, cy: number, radius: number) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = Math.max(1, 1);
      ctx.beginPath();
      // Draw only the outermost ring; remove smaller inner rings
      ctx.moveTo(cx + radius, cy);
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const drawAxes = (cx: number, cy: number, radius: number, dpr: number) => {
      ctx.save();
      // Primary axes (longer, more visible)
      ctx.strokeStyle = 'rgba(211,47,47,0.32)'; // slightly stronger crimson for axes
      ctx.lineWidth = Math.max(2, 2.5 * dpr);
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.stroke();

      // Tick marks along axes
      const ticks = 6; // more tick marks for a larger axis
      const tickLen = 10 * dpr; // slightly longer ticks
      ctx.lineWidth = Math.max(0.5, 0.75 * dpr);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      for (let i = 1; i <= ticks; i++) {
        const step = (radius / ticks) * i;
        // right
        ctx.beginPath();
        ctx.moveTo(cx + step, cy - tickLen / 2);
        ctx.lineTo(cx + step, cy + tickLen / 2);
        ctx.stroke();
        // left
        ctx.beginPath();
        ctx.moveTo(cx - step, cy - tickLen / 2);
        ctx.lineTo(cx - step, cy + tickLen / 2);
        ctx.stroke();
        // bottom
        ctx.beginPath();
        ctx.moveTo(cx - tickLen / 2, cy + step);
        ctx.lineTo(cx + tickLen / 2, cy + step);
        ctx.stroke();
        // top
        ctx.beginPath();
        ctx.moveTo(cx - tickLen / 2, cy - step);
        ctx.lineTo(cx + tickLen / 2, cy - step);
        ctx.stroke();
      }

      // Axis labels at ends (small, subtle)
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.font = `${12 * dpr}px mono`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+X', cx + radius - 12 * dpr, cy - 8 * dpr);
      ctx.fillText('-X', cx - radius + 12 * dpr, cy - 8 * dpr);
      ctx.fillText('+Y', cx + 14 * dpr, cy - radius + 12 * dpr);
      ctx.fillText('-Y', cx + 14 * dpr, cy + radius - 12 * dpr);

      ctx.restore();
    };

    const drawRadial = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // center
      const cx = width / 2;
      const cy = height / 2;

      // determine base radius and max radius
      const minDim = Math.min(width, height) / dpr;
      const baseRadius = Math.floor(minDim * 0.18) * dpr; // inner radius
      // increase both base and max radius by a small number of pixels for a larger circle
      const additionalRadiusPx = 60; // increase by 60px to enlarge the coordinate system
      const additionalDpr = additionalRadiusPx * dpr;
      // provide a slightly larger max radius and clamp to half canvas size
      const rawMaxRadius = Math.floor(minDim * 0.45) * dpr; // base max extent
      let maxRadius = rawMaxRadius + additionalDpr;
      let adjBaseRadius = baseRadius + additionalDpr;
      const halfDim = Math.floor(minDim * 0.5) * dpr;
      const margin = 4 * dpr;
      maxRadius = Math.min(maxRadius, halfDim - margin);
      // ensure inner radius is valid and also within max radius
      adjBaseRadius = Math.min(adjBaseRadius, maxRadius - (8 * dpr));

      // draw subtle grid ring for technical aesthetic (outermost only)
      drawGrid(cx, cy, maxRadius + 6 * dpr);
      // draw XY coordinate axes with ticks and subtle label markers
      // Extend axes more beyond the ring for prominence
      const axisLen = Math.min(maxRadius + 70 * dpr, halfDim - margin);
      drawAxes(cx, cy, axisLen, dpr);

      const fftSize = analyser!.frequencyBinCount;
      if (!bufferRef.current || bufferRef.current.length !== fftSize) {
        bufferRef.current = new Uint8Array(fftSize);
      }
      const buf = bufferRef.current!;
      const typedView = new Uint8Array(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength);
      analyser!.getByteFrequencyData(typedView);
      const raw = bufferRef.current;

      // downsample or resample to points
      const points = Math.min(128, raw.length);
      if (!smoothing || smoothing.length !== points) smoothing = new Float32Array(points);

      // smooth and normalize data
      const values: number[] = new Array(points);
      for (let i = 0; i < points; i++) {
        // average a small range if raw is larger
        const idx = Math.floor((i / points) * raw.length);
        const v = raw[idx] / 255.0; // normalized
        // EMA smoothing
        const prev = smoothing[i] || 0;
        const next = prev + (v - prev) * smoothingAlpha;
        smoothing[i] = next;
        values[i] = next; // normalized smoothed value [0..1]
      }

      // draw connected radial path
      ctx.save();
      ctx.translate(0, 0);
      ctx.lineWidth = Math.max(1.0, 1.5 * dpr);
      ctx.strokeStyle = 'rgba(211,47,47,0.95)'; // Crimson
      ctx.fillStyle = 'rgba(211,47,47,0.9)';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // create outer path
      ctx.beginPath();
      for (let i = 0; i < points; i++) {
        const a = (i / points) * Math.PI * 2 - Math.PI / 2; // start at top
        const v = values[i];
        const radius = adjBaseRadius + v * (maxRadius - adjBaseRadius);
        const x = cx + Math.cos(a) * radius;
        const y = cy + Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      // close path by connecting to first point
      ctx.closePath();
      // stroke outer path
      ctx.stroke();

      // Removed the inner overlay path to eliminate the smaller circle

      // dots for nodes
      const dotRadius = Math.max(1.0 * dpr, 1.5);
      ctx.fillStyle = 'rgba(211,47,47,0.95)';
      for (let i = 0; i < points; i++) {
        const a = (i / points) * Math.PI * 2 - Math.PI / 2;
        const v = values[i];
        const radius = adjBaseRadius + v * (maxRadius - adjBaseRadius);
        const x = cx + Math.cos(a) * radius;
        const y = cy + Math.sin(a) * radius;
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    const render = () => {
      if (!enabled) return;
      if (analyser) {
        drawRadial();
        rafRef.current = requestAnimationFrame(render);
      }
    };

    if (enabled && analyser) {
      rafRef.current = requestAnimationFrame(render);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [analyser, enabled]);

  // If disabled, render nothing
  if (!enabled) return null;

  // If enabled but no analyser, render placeholder
  if (!analyser) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4" style={{ color: '#9a9a9a' }}>
        <div className="text-center">
          <div style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', margin: '0 auto 8px' }} />
          <div className="text-sm font-medium" style={{ color: '#e0e0e0' }}>Seismic Analyzer</div>
          <div className="text-xs mt-1">Play audio to initialize the visualizer</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full" style={{ position: 'relative' }}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}