import type { Track } from '../types';

export type WallState = 'SECURE' | 'SHAKING' | 'COLLAPSED' | 'REBUILDING' | 'CRACKED';

export const WALL_WARNING_TIME_SECONDS = 310;
export const WALL_COLLAPSE_TIME_SECONDS = 313;
export const WALL_REQUIRED_COMPLETED_TRACKS = 24; // Tracks that must finish before "The Trial"

interface WallTrackDefinition {
  title: string;
  aliases?: string[];
}

const WALL_TRACK_SEQUENCE: WallTrackDefinition[] = [
  { title: 'In The Flesh?', aliases: ['In the Flesh'] },
  { title: 'The Thin Ice' },
  { title: 'Another Brick In The Wall, Part 1', aliases: ['Another Brick in the Wall Part 1'] },
  { title: 'The Happiest Days Of Our Lives', aliases: ['The Happiest Days of Our Lives'] },
  { title: 'Another Brick In The Wall, Part 2', aliases: ['Another Brick in the Wall Part 2'] },
  { title: 'Mother' },
  { title: 'Goodbye Blue Sky' },
  { title: 'Empty Spaces' },
  { title: 'Young Lust' },
  { title: 'One Of My Turns', aliases: ['One of My Turns'] },
  { title: "Don't Leave Me Now", aliases: ['Dont Leave Me Now'] },
  { title: 'Another Brick In The Wall, Part 3', aliases: ['Another Brick in the Wall Part 3'] },
  { title: 'Goodbye Cruel World' },
  { title: 'Hey You' },
  { title: 'Is There Anybody Out There?', aliases: ['Is There Anybody Out There'] },
  { title: 'Nobody Home' },
  { title: 'Vera' },
  { title: 'Bring The Boys Back Home', aliases: ['Bring the Boys Back Home'] },
  { title: 'Comfortably Numb' },
  { title: 'The Show Must Go On' },
  { title: 'In The Flesh', aliases: ['In the Flesh (Reprise)', 'In the Flesh? (Reprise)'] },
  { title: 'Run Like Hell' },
  { title: 'Waiting For The Worms', aliases: ['Waiting for the Worms'] },
  { title: 'Stop' },
  { title: 'The Trial' },
  { title: 'Outside The Wall', aliases: ['Outside the Wall'] },
];

const stripKnownPrefixes = (value: string) => {
  let working = value;
  working = working.replace(/^[\s._-]*(disc|cd)\s*\d+\s*/g, '');
  working = working.replace(/^[\s._-]*\d+\s*(?:-|\.|:|\/)\s*/g, '');
  working = working.replace(/^[\s._-]*\d+\s+/g, '');
  working = working.replace(/^pink\s+floyd\s*[-:_]?\s*/, '');
  working = working.replace(/^the\s+wall\s*[-:_]?\s*/, '');
  working = working.replace(/^[\s._-]+/, '');
  return working;
};

const normalizeTitle = (input: string) => {
  if (!input) return '';
  let working = input.toLowerCase();
  working = working.replace(/\((disc|cd)\s*\d+\)/g, ' ');
  working = working.replace(/\[(disc|cd)\s*\d+\]/g, ' ');
  working = working.replace(/\b(disc|cd)\s*\d+\b/g, ' ');
  working = working.replace(/pink\s+floyd/g, ' ');
  working = working.replace(/the\s+wall/g, ' ');
  working = stripKnownPrefixes(working);
  working = working.replace(/[^a-z0-9\s]/g, ' ');
  working = working.replace(/\s+/g, ' ');
  return working.trim();
};

const normalizedWallTrackMap = new Map<string, number>();
WALL_TRACK_SEQUENCE.forEach((track, index) => {
  normalizedWallTrackMap.set(normalizeTitle(track.title), index);
  track.aliases?.forEach((alias) => {
    normalizedWallTrackMap.set(normalizeTitle(alias), index);
  });
});

const normalizedTrialTitle = normalizeTitle('The Trial');
const normalizedOutsideTitle = normalizeTitle('Outside The Wall');

const resolveOrderFromNormalized = (normalized: string): number | null => {
  if (!normalized) return null;
  const direct = normalizedWallTrackMap.get(normalized);
  if (typeof direct === 'number') {
    return direct;
  }

  for (const [key, value] of normalizedWallTrackMap.entries()) {
    if (!key) continue;
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  return null;
};

const isPinkFloyd = (track?: Track | null) =>
  !!track?.artist && track.artist.toLowerCase().includes('pink floyd');

const isTheWallAlbum = (track?: Track | null) =>
  !!track?.album && track.album.toLowerCase().includes('the wall');

export const isWallAlbumTrack = (track?: Track | null) => isPinkFloyd(track) && isTheWallAlbum(track);

export const getWallTrackOrder = (track?: Track | null): number | null => {
  if (!track) return null;
  const titleCandidate = track.title || track.name;
  if (!titleCandidate) return null;
  const normalized = normalizeTitle(titleCandidate);
  return resolveOrderFromNormalized(normalized);
};

export const isTheTrialTrack = (track?: Track | null) => getWallTrackOrder(track) === THE_TRIAL_ORDER_INDEX;

export const isOutsideTheWallTrack = (track?: Track | null) => getWallTrackOrder(track) === OUTSIDE_THE_WALL_ORDER_INDEX;

export const TOTAL_WALL_TRACKS = WALL_TRACK_SEQUENCE.length;
export const THE_TRIAL_ORDER_INDEX = normalizedWallTrackMap.get(normalizedTrialTitle) ?? WALL_TRACK_SEQUENCE.length - 2;
export const OUTSIDE_THE_WALL_ORDER_INDEX = normalizedWallTrackMap.get(normalizedOutsideTitle) ?? WALL_TRACK_SEQUENCE.length - 1;
