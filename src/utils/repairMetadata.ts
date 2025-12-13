import { openBrickDB } from './db';

interface StoredLocalTrack {
  file?: Blob;
  name?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  url?: string;
}

// Derive artist/album/title from filename heuristics (copied from LocalMusicUploader)
const stripExtension = (filename: string) => filename.replace(/\.[^.]+$/, '');
const sanitizeSegment = (s: string) => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const removeTrackNumberPrefix = (s: string) => s.replace(/^\s*\d{1,3}[\s._-]+/, '').trim();

export const deriveFromFilename = (name: string): { artist?: string; album?: string; title?: string } => {
  const base = stripExtension(name);
  const parts = base.split(' - ').map(sanitizeSegment);
  if (parts.length >= 3) {
    const artist = parts[0];
    const album = parts[1];
    const title = removeTrackNumberPrefix(parts.slice(2).join(' - '));
    return { artist, album, title };
  }
  if (parts.length === 2) {
    const artist = parts[0];
    const title = removeTrackNumberPrefix(parts[1]);
    return { artist, title };
  }
  return { title: removeTrackNumberPrefix(base) };
};

export async function repairMetadataInDB(): Promise<{ updated: number; tracks?: StoredLocalTrack[] }> {
  const db = await openBrickDB();
  const tx = db.transaction(['localTracks'], 'readwrite');
  const store = tx.objectStore('localTracks');
  const all = await new Promise<StoredLocalTrack[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result as StoredLocalTrack[] : []);
    req.onerror = () => reject(req.error);
  });

  let updatedCount = 0;
  for (const t of all) {
    const filename = t.file instanceof File ? t.file.name : (typeof t.name === 'string' ? t.name : '');
    const inferred = deriveFromFilename(filename);
    const artist = typeof t.artist === 'string' ? t.artist : '';
    const album = typeof t.album === 'string' ? t.album : '';
    const title = typeof t.name === 'string' ? t.name : '';

    const needsArtist = artist === '' || artist === 'Unknown Artist';
    const needsAlbum = album === '' || album === 'Unknown Album';
    const needsTitle = title === '' || /^\d{1,3}[\s._-]/.test(title);
    const fallbackArtist = inferred.artist ?? (artist !== '' ? artist : undefined);
    const fallbackAlbum = inferred.album ?? (album !== '' ? album : undefined);
    const fallbackTitle = inferred.title ?? (title !== '' ? title : undefined);
    const albumArtist = typeof t.albumArtist === 'string' && t.albumArtist !== ''
      ? t.albumArtist
      : (needsArtist ? fallbackArtist : (artist !== '' ? artist : undefined));
    const next: StoredLocalTrack = {
      ...t,
      artist: needsArtist ? fallbackArtist : (artist !== '' ? artist : undefined),
      album: needsAlbum ? fallbackAlbum : (album !== '' ? album : undefined),
      name: needsTitle ? fallbackTitle : (title !== '' ? title : undefined),
      albumArtist,
    };

    if (next.artist !== t.artist || next.album !== t.album || next.name !== t.name || next.albumArtist !== t.albumArtist) {
      await new Promise<void>((resolve, reject) => {
        const putReq = store.put(next);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      });
      updatedCount += 1;
    }
  }

  let tracksWithUrls: StoredLocalTrack[] | undefined;
  try {
    const refreshed = await new Promise<StoredLocalTrack[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result as StoredLocalTrack[] : []);
      req.onerror = () => reject(req.error);
    });
    tracksWithUrls = refreshed.map((track) => {
      const hasUrl = typeof track.url === 'string' && track.url !== '';
      const blobUrl = track.file instanceof Blob ? URL.createObjectURL(track.file) : '';
      return { ...track, url: hasUrl ? track.url : blobUrl };
    });
    window.dispatchEvent(new CustomEvent('brick:local-tracks-refreshed', { detail: { count: updatedCount, tracks: tracksWithUrls } }));
  } catch {
    tracksWithUrls = undefined;
  }

  return { updated: updatedCount, tracks: tracksWithUrls };
}
