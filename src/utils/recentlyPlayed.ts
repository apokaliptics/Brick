import { openBrickDB, DB_VERSION } from './db';

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
  bitDepth?: number;
  sampleRate?: number;
  bitrateKbps?: number;
  durationSeconds?: number;
  id?: string;
  title?: string;
  artist?: string;
}

const STORE_NAME = 'recentlyPlayedTracks';
const LOCAL_TRACK_STORE = 'localTracks';

export async function openRecentlyPlayedDB(): Promise<IDBDatabase> {
  console.log(`Opening recently played tracks DB, version ${DB_VERSION}`);
  return openBrickDB();
}

async function getLocalTrackById(trackId: string): Promise<any | null> {
  try {
    const db = await openBrickDB();
    if (!db.objectStoreNames.contains(LOCAL_TRACK_STORE)) return null;
    return await new Promise((resolve) => {
      const tx = db.transaction([LOCAL_TRACK_STORE], 'readonly');
      const store = tx.objectStore(LOCAL_TRACK_STORE);
      const request = store.get(trackId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    console.error('Failed to load local track for recent playback', error);
    return null;
  }
}

export async function addRecentlyPlayedTrack(track: RecentlyPlayedTrack): Promise<void> {
  console.log('addRecentlyPlayedTrack called with:', track);
  const db = await openRecentlyPlayedDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.put({
      ...track,
      playedAt: Date.now(),
    });

    request.onsuccess = () => {
      console.log('Successfully added track to recently played:', track.trackTitle);
      resolve();
    };
    request.onerror = () => {
      console.error('Failed to add track to recently played:', request.error);
      reject(request.error);
    };
  });
}

export async function getRecentlyPlayedTracks(limit = 10): Promise<RecentlyPlayedTrack[]> {
  console.log('getRecentlyPlayedTracks called with limit:', limit);
  const db = await openRecentlyPlayedDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const index = store.index('playedAt');

  return new Promise((resolve, reject) => {
    const request = index.getAll();

    request.onsuccess = async () => {
      const tracks = request.result as RecentlyPlayedTrack[];
      console.log('Retrieved tracks from DB:', tracks);
      // Sort by playedAt descending and limit
      const sorted = tracks.sort((a, b) => b.playedAt - a.playedAt).slice(0, limit);
      console.log('Sorted and limited tracks:', sorted);

      const enriched = await Promise.all(sorted.map(async (track) => {
        const needsLocalLookup = !track.audioUrl || track.audioUrl.includes('SoundHelix') || track.audioUrl.startsWith('blob:');
        if (!needsLocalLookup) {
          return track;
        }

        const local = await getLocalTrackById(track.trackId);
        if (!local) return track;

        let rebuiltUrl = track.audioUrl;
        try {
          if (local.file) {
            rebuiltUrl = URL.createObjectURL(local.file);
          }
        } catch (err) {
          console.error('Failed to rebuild blob URL for recent track', err);
        }

        return {
          ...track,
          audioUrl: rebuiltUrl || track.audioUrl,
          album: track.album || local.album,
          quality: track.quality || local.format,
          codecLabel: track.codecLabel || local.codecLabel,
          bitDepth: track.bitDepth ?? local.bitDepth,
          sampleRate: track.sampleRate ?? local.sampleRate,
          bitrateKbps: track.bitrateKbps ?? local.bitrateKbps,
          durationSeconds: track.durationSeconds ?? (typeof local.duration === 'number' ? local.duration : undefined),
        } as RecentlyPlayedTrack;
      }));

      // If no tracks, add some test data for debugging
      if (enriched.length === 0) {
        console.log('No recently played tracks found, adding test data...');
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
        testTracks.forEach(track => addRecentlyPlayedTrack(track).catch(console.error));
      } else {
        resolve(enriched);
      }
    };

    request.onerror = () => {
      console.error('Failed to get recently played tracks:', request.error);
      reject(request.error);
    };
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
