import { openBrickDB } from './db';

// Recently Played Tracks Management
export interface RecentlyPlayedTrack {
  trackId: string;
  trackTitle: string;
  artistName: string;
  coverArt: string;
  audioUrl: string;
  playedAt: number;
  album?: string;
  quality?: string;
  codecLabel?: string;
  codec?: string; // Simple codec property for compatibility
  bitDepth?: number;
  sampleRate?: number;
  bitrateKbps?: number;
  bitrate?: number; // kbps legacy field
  durationSeconds?: number;
  id?: string;
  title?: string;
  artist?: string;
}

const STORE_NAME = 'recentlyPlayedTracks';
const LOCAL_TRACK_STORE = 'localTracks';

interface LocalTrackEntry {
  file?: Blob;
  album?: string;
  format?: string;
  codecLabel?: string;
  bitDepth?: number;
  sampleRate?: number;
  bitrateKbps?: number;
  duration?: number;
  codec?: string;
  url?: string;
  name?: string;
  artist?: string;
}

export async function openRecentlyPlayedDB(): Promise<IDBDatabase> {
  return openBrickDB();
}

async function getLocalTrackById(trackId: string): Promise<LocalTrackEntry | null> {
  try {
    const db = await openBrickDB();
    if (!db.objectStoreNames.contains(LOCAL_TRACK_STORE)) return null;
    return await new Promise<LocalTrackEntry | null>((resolve) => {
      const tx = db.transaction([LOCAL_TRACK_STORE], 'readonly');
      const store = tx.objectStore(LOCAL_TRACK_STORE);
      const request = store.get(trackId) as IDBRequest<LocalTrackEntry | undefined>;
      request.onsuccess = () => {
        const value = request.result;
        resolve(value ?? null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function addRecentlyPlayedTrack(track: RecentlyPlayedTrack): Promise<void> {
  const db = await openRecentlyPlayedDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.put({
      ...track,
      playedAt: Date.now(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getRecentlyPlayedTracks(limit = 10): Promise<RecentlyPlayedTrack[]> {
  const db = await openRecentlyPlayedDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const index = store.index('playedAt');

  return new Promise((resolve, reject) => {
    const request = index.getAll();

    request.onsuccess = async () => {
      const tracks = Array.isArray(request.result) ? request.result as RecentlyPlayedTrack[] : [];
      // Sort by playedAt descending and limit
      const sorted = tracks
        .filter((t): t is RecentlyPlayedTrack => typeof t?.playedAt === 'number' && typeof t.trackId === 'string')
        .sort((a, b) => b.playedAt - a.playedAt)
        .slice(0, limit);

      const enriched = await Promise.all(sorted.map(async (track) => {
        const audioUrl = typeof track.audioUrl === 'string' ? track.audioUrl : '';
        const needsLocalLookup = audioUrl === '' || audioUrl.includes('SoundHelix') || audioUrl.startsWith('blob:');
        if (!needsLocalLookup) {
          return track;
        }

        const local = await getLocalTrackById(track.trackId);
        if (local === null) return track;

        let rebuiltUrl = audioUrl;
        if (local.file instanceof Blob) {
          try {
            rebuiltUrl = URL.createObjectURL(local.file);
          } catch {
            // ignore blob rebuild failure
          }
        }

        return {
          ...track,
          audioUrl: rebuiltUrl || audioUrl,
          album: track.album ?? local.album,
          quality: track.quality ?? local.format,
          codecLabel: track.codecLabel ?? local.codecLabel,
          bitDepth: track.bitDepth ?? local.bitDepth,
          sampleRate: track.sampleRate ?? local.sampleRate,
          bitrateKbps: track.bitrateKbps ?? local.bitrateKbps,
          durationSeconds: track.durationSeconds ?? (typeof local.duration === 'number' ? local.duration : undefined),
        } as RecentlyPlayedTrack;
      }));

      // If no tracks, add some test data for debugging
      if (enriched.length === 0) {
        const testTracks: RecentlyPlayedTrack[] = [
          {
            trackId: 'test-track-1',
            trackTitle: 'Test Track 1',
            artistName: 'Test Artist',
            coverArt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
            audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            playedAt: Date.now() - 1000,
            album: 'Test Album',
            quality: 'FLAC',
            bitrateKbps: 1411,
            durationSeconds: 240,
          },
          {
            trackId: 'test-track-2',
            trackTitle: 'Test Track 2',
            artistName: 'Another Artist',
            coverArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300',
            audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
            playedAt: Date.now() - 2000,
            album: 'Another Album',
            quality: 'MP3',
            bitrateKbps: 320,
            durationSeconds: 260,
          }
        ];
        resolve(testTracks);
        // Also add them to DB for future loads
        testTracks.forEach((track) => { void addRecentlyPlayedTrack(track).catch(() => {}); });
      } else {
        resolve(enriched);
      }
    };

    request.onerror = () => reject(request.error);
  });
}


export async function clearRecentlyPlayedTracks(): Promise<void> {
  const db = await openRecentlyPlayedDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function removeRecentlyPlayedTrack(trackId: string): Promise<void> {
  const db = await openRecentlyPlayedDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.delete(trackId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
