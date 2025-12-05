const DB_NAME = 'BrickMusicDB';
const DB_VERSION = 5;

const ensureObjectStores = (db: IDBDatabase) => {
  if (!db.objectStoreNames.contains('localTracks')) {
    db.createObjectStore('localTracks', { keyPath: 'id' });
  }

  if (!db.objectStoreNames.contains('playlists')) {
    db.createObjectStore('playlists', { keyPath: 'id' });
  }

  if (!db.objectStoreNames.contains('recentlyPlayedTracks')) {
    const store = db.createObjectStore('recentlyPlayedTracks', { keyPath: 'trackId' });
    store.createIndex('playedAt', 'playedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains('recentlyPlayedPlaylists')) {
    const store = db.createObjectStore('recentlyPlayedPlaylists', { keyPath: 'playlistId' });
    store.createIndex('playedAt', 'playedAt', { unique: false });
  }
};

export const openBrickDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      ensureObjectStores(db);
    };
  });
};

export { DB_NAME, DB_VERSION };
