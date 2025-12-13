// Utility to extract audio metadata: bit depth and sample rate (kHz), with bitrate fallback
// Uses music-metadata-browser when possible; for remote URLs without CORS, falls back to
// lightweight heuristics (file extension/MIME) for codec labeling only.

import { parseBlob, parseBuffer } from 'music-metadata-browser';

export interface AudioMeta {
  bitDepth?: number; // 16, 24, ...
  sampleRate?: number; // in kHz (e.g., 44.1)
  bitrateKbps?: number; // in kbps (optional)
  codecLabel?: string; // e.g., FLAC, WAV, MP3, AAC, ALAC, OPUS
}

function roundKHz(rateHz?: number | null): number | undefined {
  if (rateHz === undefined || rateHz === null) return undefined;
  const khz = rateHz / 1000;
  return Math.round(khz * 10) / 10; // one decimal place
}

function safeSampleRate(rateHz?: number | null): number | undefined {
  if (rateHz === undefined || rateHz === null || Number.isNaN(rateHz)) return undefined;
  return roundKHz(rateHz);
}

function safeBitrateKbps(bitrateBps?: number | null): number | undefined {
  if (bitrateBps === undefined || bitrateBps === null || !Number.isFinite(bitrateBps)) return undefined;
  return Math.round(bitrateBps / 1000);
}

function extFromName(name?: string | null): string | undefined {
  if (name === undefined || name === null || name === '') return undefined;
  const clean = name.split('?')[0].split('#')[0];
  const idx = clean.lastIndexOf('.');
  if (idx === -1) return undefined;
  return clean.substring(idx + 1).toLowerCase();
}

function labelFromMimeOrExt(mime?: string | null, ext?: string | null): string | undefined {
  const m = (mime ?? '').toLowerCase();
  const e = (ext ?? '').toLowerCase();
  const table: Record<string, string> = {
    flac: 'FLAC',
    wav: 'WAV',
    wave: 'WAV',
    aiff: 'AIFF',
    aif: 'AIFF',
    mp3: 'MP3',
    mpeg: 'MP3',
    m4a: 'M4A',
    mp4: 'M4A',
    aac: 'AAC',
    alac: 'ALAC',
    ogg: 'OGG',
    opus: 'OPUS',
    webm: 'WEBM',
  };

  // MIME checks first
  if (m.includes('flac')) return 'FLAC';
  if (m.includes('x-wav') || m.includes('wav')) return 'WAV';
  if (m.includes('aiff')) return 'AIFF';
  if (m.includes('mpeg')) return 'MP3';
  if (m.includes('aac')) return 'AAC';
  if (m.includes('alac')) return 'ALAC';
  if (m.includes('mp4') || m.includes('m4a')) return 'M4A';
  if (m.includes('ogg') && m.includes('opus')) return 'OPUS';
  if (m.includes('ogg')) return 'OGG';
  if (m.includes('webm')) return 'WEBM';

  // Fallback to extension
  if (e && table[e]) return table[e];
  return undefined;
}

function normalizeCodec(container?: string | null, codec?: string | null, mime?: string | null, ext?: string | null): string | undefined {
  const c = (container ?? '').toLowerCase();
  const k = (codec ?? '').toLowerCase();
  // Prefer precise codec mapping when known
  if (k.includes('flac')) return 'FLAC';
  if (k.includes('alac') || k.includes('apple lossless')) return 'ALAC';
  if (k.includes('aac')) return 'AAC';
  if (k.includes('mp3') || k.includes('mpeg')) return 'MP3';
  if (k.includes('opus')) return 'OPUS';
  if (k.includes('vorbis')) return 'OGG';
  if (k.includes('pcm') && (c.includes('wav') || c.includes('wave'))) return 'WAV';
  if (k.includes('aiff') || c.includes('aiff')) return 'AIFF';
  if (c.includes('wave') || c.includes('wav')) return 'WAV';
  if (c.includes('flac')) return 'FLAC';
  if (c.includes('mp4')) return 'M4A';
  if (c.includes('ogg')) return 'OGG';
  if (c.includes('webm')) return 'WEBM';
  return labelFromMimeOrExt(mime, ext);
}

export async function extractAudioMeta(fileOrUrl: File | string): Promise<AudioMeta> {
  // Compute cheap label early from name/MIME when possible
  let cheapLabel: string | undefined;
  if (fileOrUrl instanceof File) {
    cheapLabel = labelFromMimeOrExt(fileOrUrl.type, extFromName(fileOrUrl.name));
  } else if (typeof fileOrUrl === 'string') {
    cheapLabel = labelFromMimeOrExt(undefined, extFromName(fileOrUrl));
  }

  try {
    // Prefer music-metadata-browser for detailed metadata
    if (fileOrUrl instanceof File) {
      const meta = await parseBlob(fileOrUrl);
      const fmt = meta.format;
      const bitDepth = typeof fmt.bitsPerSample === 'number' && Number.isFinite(fmt.bitsPerSample) ? fmt.bitsPerSample : undefined;
      const sampleRate = safeSampleRate(fmt.sampleRate);
      const bitrateKbps = safeBitrateKbps(fmt.bitrate);
      return {
        bitDepth,
        sampleRate,
        bitrateKbps,
        codecLabel: normalizeCodec(fmt.container, fmt.codec, fileOrUrl.type, extFromName(fileOrUrl.name)) ?? cheapLabel,
      };
    } else if (typeof fileOrUrl === 'string') {
      // Fetch as ArrayBuffer (requires CORS for remote URLs)
      const res = await fetch(fileOrUrl, { mode: 'cors' });
      const buf = await res.arrayBuffer();
      const mimeType = res.headers.get('Content-Type') ?? undefined;
      const meta = await parseBuffer(new Uint8Array(buf), { mimeType, size: buf.byteLength });
      const fmt = meta.format;
      const bitDepth = typeof fmt.bitsPerSample === 'number' && Number.isFinite(fmt.bitsPerSample) ? fmt.bitsPerSample : undefined;
      const sampleRate = safeSampleRate(fmt.sampleRate);
      const bitrateKbps = safeBitrateKbps(fmt.bitrate);
      return {
        bitDepth,
        sampleRate,
        bitrateKbps,
        codecLabel: normalizeCodec(fmt.container, fmt.codec, mimeType, extFromName(fileOrUrl)) ?? cheapLabel,
      };
    }
  } catch (e) {
    // Intentionally ignore parsing errors; we'll return cheapLabel + any safe estimates below
  }

  // Final fallback: estimate bitrate for Files only; avoid fake sample rate.
  return new Promise((resolve) => {
    const audio = new Audio();
    if (typeof fileOrUrl === 'string') {
      audio.src = fileOrUrl;
    } else {
      audio.src = URL.createObjectURL(fileOrUrl);
    }
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => {
      let sampleRate: number | undefined;
      let bitrateKbps: number | undefined;
      try {
        type AudioContextCtor = new () => AudioContext;
        const ctxSource = window as typeof window & { webkitAudioContext?: AudioContextCtor };
        const Ctx = ctxSource.AudioContext ?? ctxSource.webkitAudioContext;
        if (Ctx === undefined) {
          resolve({ sampleRate, bitrateKbps, codecLabel: cheapLabel });
          return;
        }
        const ctx = new Ctx();
        const req = new XMLHttpRequest();
        req.open('GET', audio.src, true);
        req.responseType = 'arraybuffer';
        req.onload = function () {
          const responseBuffer: unknown = req.response;
          if (!(responseBuffer instanceof ArrayBuffer)) {
            resolve({ sampleRate, bitrateKbps, codecLabel: cheapLabel });
            return;
          }

          const finishWithBitrate = () => {
            sampleRate = undefined; // decoded rate matches AudioContext, not the file
            const hasDuration = Number.isFinite(audio.duration) && audio.duration > 0;
            if (fileOrUrl instanceof File && hasDuration) {
              bitrateKbps = Math.round((fileOrUrl.size / audio.duration) * 8 / 1000);
            }
            resolve({ sampleRate, bitrateKbps, codecLabel: cheapLabel });
          };

          void ctx.decodeAudioData(responseBuffer, finishWithBitrate, () => {
            resolve({ sampleRate, bitrateKbps, codecLabel: cheapLabel });
          });
        };
        req.onerror = function () {
          resolve({ sampleRate, bitrateKbps, codecLabel: cheapLabel });
        };
        req.send();
      } catch {
        resolve({ sampleRate, bitrateKbps, codecLabel: cheapLabel });
      }
    });
    audio.addEventListener('error', () => resolve({ codecLabel: cheapLabel }));
  });
}

export function formatMetaBadge(meta: AudioMeta): string | null {
  const depth = typeof meta.bitDepth === 'number' && Number.isFinite(meta.bitDepth) ? meta.bitDepth : undefined;
  const rate = typeof meta.sampleRate === 'number' && Number.isFinite(meta.sampleRate) ? meta.sampleRate : undefined; // already kHz
  if (depth === undefined && rate === undefined) return null;
  const depthPart = depth !== undefined ? `${depth}-bit` : undefined;
  const ratePart = rate !== undefined ? `${rate}kHz` : undefined;
  return [depthPart, ratePart].filter(Boolean).join('/');
}
