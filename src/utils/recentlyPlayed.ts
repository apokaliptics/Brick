// Recently Played Tracks Management
export interface RecentlyPlayedTrack {
  trackId: string;
  trackTitle: string;
  artistName: string;
  coverArt: string;
  audioUrl: string;
  playedAt: number;
  id?: string;
  title?: string;
  artist?: string;
}

const DB_NAME = 'BrickMusicDB';
const STORE_NAME = 'recentlyPlayedTracks';

export async function openRecentlyPlayedDB(): Promise<IDBDatabase> {
  console.log('Opening recently played tracks DB, version 4');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 4); // Increased version to force upgrade

    request.onerror = () => {
      console.error('Failed to open recently played tracks DB:', request.error);
      reject(request.error);
    };
    request.onsuccess = () => {
      console.log('Successfully opened recently played tracks DB');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      console.log('Upgrading recently played tracks DB');
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        console.log('Creating recentlyPlayedTracks object store');
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'trackId' });
        store.createIndex('playedAt', 'playedAt', { unique: false });
      }
    };
  });
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

    request.onsuccess = () => {
      const tracks = request.result as RecentlyPlayedTrack[];
      console.log('Retrieved tracks from DB:', tracks);
      // Sort by playedAt descending and limit
      const sorted = tracks.sort((a, b) => b.playedAt - a.playedAt).slice(0, limit);
      console.log('Sorted and limited tracks:', sorted);

      // If no tracks, add some test data for debugging
      if (sorted.length === 0) {
        console.log('No recently played tracks found, adding test data...');
        const testTracks: RecentlyPlayedTrack[] = [
          {
            trackId: 'test-track-1',
            trackTitle: 'Test Track 1',
            artistName: 'Test Artist',
            coverArt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300',
            audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            playedAt: Date.now() - 1000,
          },
          {
            trackId: 'test-track-2',
            trackTitle: 'Test Track 2',
            artistName: 'Another Artist',
            coverArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300',
            audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
            playedAt: Date.now() - 2000,
          }
        ];
        resolve(testTracks);
        // Also add them to DB for future loads
        testTracks.forEach(track => addRecentlyPlayedTrack(track).catch(console.error));
      } else {
        resolve(sorted);
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
