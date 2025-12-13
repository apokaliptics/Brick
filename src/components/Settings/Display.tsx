/* eslint-disable */
import React, { useEffect } from 'react';
import { Zap } from 'lucide-react';

type DisplaySettingsProps = {
  analyserNode?: AnalyserNode | null;
  enabled: boolean;
  onToggle: (next: boolean) => void;
};

export default function DisplaySettings({ analyserNode, enabled, onToggle }: DisplaySettingsProps) {

  const doToggle = async (next: boolean) => {
    onToggle(next);
  };

  return (
    <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: '#252525', border: '1px solid #333333' }}>
          <button
            onClick={() => doToggle(!enabled)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); onToggle(!enabled); } }}
        // Keep UI responsive - parent owns the loading and toggling
        className="w-full flex items-center justify-between cursor-pointer"
        aria-pressed={enabled}
        aria-label="Toggle Seismic Monitor"
      >
        <div className="flex items-center gap-3">
          <Zap size={18} color={enabled ? '#d32f2f' : '#a0a0a0'} fill={enabled ? '#d32f2f' : 'none'} />
          <div className="text-left">
            <p style={{ color: '#e0e0e0' }} className="font-medium">
              Seismic Monitor
            </p>
            <p style={{ color: '#666666' }} className="text-xs">
              Spectrum analyzer below the album art in the right rail.
            </p>
          </div>
        </div>
        <div
          className="w-10 h-6 rounded-full flex items-center px-1 transition-colors"
          style={{ backgroundColor: enabled ? '#d32f2f' : '#444444' }}
        >
          <div
            className="w-4 h-4 rounded-full bg-white transition-transform"
            style={{ transform: enabled ? 'translateX(16px)' : 'translateX(0)' }}
          />
        </div>
      </button>
      {enabled && !analyserNode && (
        <p className="text-xs mono mt-2" style={{ color: '#9a9a9a' }}>
          Enabled — waiting for the audio engine's analyser. Play a track to initialize the analyzer and start the visualizer.
        </p>
      )}
    </div>
  );
}
