// Recently Played Playlists Management
export interface RecentlyPlayedPlaylist {
  playlistId: string;
  playlistName: string;
  coverImage: string;
  creatorName: string;
  trackCount: number;
  playedAt?: number; // Optional since it's automatically added by addRecentlyPlayedPlaylist
  structuralIntegrity?: number;
  id?: string;
  name?: string;
  creator?: string;
}


const DB_NAME = 'BrickMusicDB';
const STORE_NAME = 'recentlyPlayedPlaylists';

export async function openRecentlyPlayedPlaylistsDB(): Promise<IDBDatabase> {
  console.log('Opening recently played playlists DB, version 4');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 4); // Increased version to force upgrade

    request.onerror = () => {
      console.error('Failed to open recently played playlists DB:', request.error);
      reject(request.error);
    };
    request.onsuccess = () => {
      console.log('Successfully opened recently played playlists DB');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      console.log('Upgrading recently played playlists DB');
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        console.log('Creating recentlyPlayedPlaylists object store');
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'playlistId' });
        store.createIndex('playedAt', 'playedAt', { unique: false });
      }
    };
  });
}


export async function addRecentlyPlayedPlaylist(playlist: RecentlyPlayedPlaylist): Promise<void> {
  const db = await openRecentlyPlayedPlaylistsDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.put({
      ...playlist,
      playedAt: Date.now(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getRecentlyPlayedPlaylists(limit = 10): Promise<RecentlyPlayedPlaylist[]> {
  const db = await openRecentlyPlayedPlaylistsDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const index = store.index('playedAt');

  return new Promise((resolve, reject) => {
    const request = index.getAll();

    request.onsuccess = () => {
      const playlists = request.result as RecentlyPlayedPlaylist[];
      // Sort by playedAt descending and limit (with fallback for undefined values)
      const sorted = playlists.sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0)).slice(0, limit);
      resolve(sorted);
    };


    request.onerror = () => reject(request.error);
  });
}

export async function clearRecentlyPlayedPlaylists(): Promise<void> {
  const db = await openRecentlyPlayedPlaylistsDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function removeRecentlyPlayedPlaylist(playlistId: string): Promise<void> {
  const db = await openRecentlyPlayedPlaylistsDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.delete(playlistId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
