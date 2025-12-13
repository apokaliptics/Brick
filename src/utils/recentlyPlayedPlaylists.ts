import { openBrickDB } from './db';

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


const STORE_NAME = 'recentlyPlayedPlaylists';

export async function openRecentlyPlayedPlaylistsDB(): Promise<IDBDatabase> {
  return openBrickDB();
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
      const playlists = Array.isArray(request.result) ? request.result as RecentlyPlayedPlaylist[] : [];
      // Sort by playedAt descending and limit (with fallback for undefined values)
      const getPlayedAt = (value?: number) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
      const sorted = playlists.sort((a, b) => getPlayedAt(b.playedAt) - getPlayedAt(a.playedAt)).slice(0, limit);
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
