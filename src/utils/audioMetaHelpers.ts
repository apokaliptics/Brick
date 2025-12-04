const EXTENSION_TABLE: Record<string, string> = {
  flac: 'FLAC',
  wav: 'WAV',
  wave: 'WAV',
  aiff: 'AIFF',
  aif: 'AIFF',
  mp3: 'MP3',
  m4a: 'M4A',
  mp4: 'M4A',
  aac: 'AAC',
  alac: 'ALAC',
  ogg: 'OGG',
  opus: 'OPUS',
  webm: 'WEBM',
};

const QUALITY_KEYWORDS: Array<[string, string]> = [
  ['FLAC', 'FLAC'],
  ['ALAC', 'ALAC'],
  ['AAC', 'AAC'],
  ['AIFF', 'AIFF'],
  ['WAV', 'WAV'],
  ['MP3', 'MP3'],
  ['320KBPS', 'MP3'],
  ['256KBPS', 'AAC'],
  ['M4A', 'M4A'],
  ['OGG', 'OGG'],
  ['OPUS', 'OPUS'],
  ['LOSSLESS', 'FLAC'],
];

const MIME_KEYWORDS: Array<[string, string]> = [
  ['flac', 'FLAC'],
  ['x-wav', 'WAV'],
  ['wav', 'WAV'],
  ['wave', 'WAV'],
  ['aiff', 'AIFF'],
  ['aac', 'AAC'],
  ['alac', 'ALAC'],
  ['mp4', 'M4A'],
  ['m4a', 'M4A'],
  ['mpeg', 'MP3'],
  ['mp3', 'MP3'],
  ['ogg', 'OGG'],
  ['opus', 'OPUS'],
  ['webm', 'WEBM'],
];

const matchKeyword = (value: string | undefined, table: Array<[string, string]>) => {
  if (!value) return undefined;
  const upper = value.toUpperCase();
  for (const [keyword, label] of table) {
    if (upper.includes(keyword)) return label;
  }
  return undefined;
};

const matchMime = (mime?: string) => {
  if (!mime) return undefined;
  const lower = mime.toLowerCase();
  for (const [keyword, label] of MIME_KEYWORDS) {
    if (lower.includes(keyword)) return label;
  }
  return undefined;
};

const extFromName = (input?: string): string | undefined => {
  if (!input) return undefined;
  const clean = input.split('?')[0].split('#')[0];
  const idx = clean.lastIndexOf('.');
  if (idx === -1) return undefined;
  return clean.substring(idx + 1).toLowerCase();
};

const labelFromExtension = (input?: string) => {
  const ext = extFromName(input);
  return ext ? EXTENSION_TABLE[ext] : undefined;
};

export function inferCodecLabel(opts: { file?: File; url?: string; qualityHint?: string; codecLabel?: string }): string | undefined {
  if (opts.codecLabel) return opts.codecLabel;
  const quality = matchKeyword(opts.qualityHint, QUALITY_KEYWORDS);
  if (quality) return quality;
  if (opts.file) {
    const fileMime = matchMime(opts.file.type);
    if (fileMime) return fileMime;
    const fromFileName = labelFromExtension(opts.file.name);
    if (fromFileName) return fromFileName;
  }
  if (opts.url) {
    const fromUrl = labelFromExtension(opts.url);
    if (fromUrl) return fromUrl;
  }
  return undefined;
}

export function formatBitrate(bitrateKbps?: number): string | null {
  if (!bitrateKbps) return null;
  const rounded = Math.round(bitrateKbps);
  return `${rounded.toLocaleString()} kbps`;
}
