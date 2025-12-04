import { useEffect, useMemo, useState } from 'react';
import type { Track } from '../types';
import type { AudioMeta } from '../utils/audioMetadata';
import { extractAudioMeta } from '../utils/audioMetadata';
import { inferCodecLabel } from '../utils/audioMetaHelpers';

const normalizeNumber = (value?: number | string | null): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeSampleRate = (value?: number | string | null): number | undefined => {
  const normalized = normalizeNumber(value);
  if (!normalized) return undefined;
  if (normalized > 1000) {
    // Convert Hz to kHz when callers store raw sample rate
    return Math.round((normalized / 1000) * 10) / 10;
  }
  return normalized;
};

const needsExtraction = (meta: AudioMeta | null): boolean => {
  if (!meta) return true;
  return !meta.bitDepth || !meta.sampleRate || !meta.bitrateKbps || !meta.codecLabel;
};

const mergeMeta = (base: AudioMeta | null, update: AudioMeta): AudioMeta => ({
  bitDepth: base?.bitDepth ?? update.bitDepth,
  sampleRate: base?.sampleRate ?? update.sampleRate,
  bitrateKbps: base?.bitrateKbps ?? update.bitrateKbps,
  codecLabel: base?.codecLabel ?? update.codecLabel,
});

export function useTrackAudioMeta(track: Track | null): AudioMeta | null {
  const baseMeta = useMemo<AudioMeta | null>(() => {
    if (!track) return null;
    const bitDepth = normalizeNumber(track.bitDepth ?? null);
    const sampleRate = normalizeSampleRate(track.sampleRate ?? null);
    const bitrateKbps = normalizeNumber(track.bitrateKbps ?? null);
    const codecLabel = inferCodecLabel({
      file: track.file,
      url: track.audioUrl,
      qualityHint: track.quality,
      codecLabel: track.codecLabel,
    });

    if (!bitDepth && !sampleRate && !bitrateKbps && !codecLabel) {
      return null;
    }

    return {
      bitDepth: bitDepth || undefined,
      sampleRate: sampleRate || undefined,
      bitrateKbps: bitrateKbps || undefined,
      codecLabel: codecLabel || undefined,
    };
  }, [track]);

  const [resolvedMeta, setResolvedMeta] = useState<AudioMeta | null>(baseMeta);

  useEffect(() => {
    setResolvedMeta(baseMeta);
  }, [baseMeta]);

  useEffect(() => {
    if (!track) return;
    if (!track.file && !track.audioUrl) return;
    if (!needsExtraction(resolvedMeta)) return;

    let cancelled = false;
    const source = track.file ?? track.audioUrl!;

    const enrichMeta = async () => {
      try {
        const extracted = await extractAudioMeta(source);
        if (cancelled || !extracted) return;
        setResolvedMeta((prev) => mergeMeta(prev, extracted));
      } catch (error) {
        console.warn('Failed to extract audio metadata:', error);
      }
    };

    enrichMeta();

    return () => {
      cancelled = true;
    };
  }, [track, resolvedMeta]);

  return resolvedMeta;
}
