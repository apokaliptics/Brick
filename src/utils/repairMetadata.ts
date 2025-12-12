import { openBrickDB } from './db';

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

export async function repairMetadataInDB(): Promise<{ updated: number; tracks?: any[] }> {
  try {
    const db = await openBrickDB();
    const tx = db.transaction(['localTracks'], 'readwrite');
    const store = tx.objectStore('localTracks');
    const all = await new Promise<any[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    let updatedCount = 0;
    for (const t of all) {
      const inferred = deriveFromFilename(t.file?.name || t.name || '');
      const needsArtist = !t.artist || t.artist === 'Unknown Artist';
      const needsAlbum = !t.album || t.album === 'Unknown Album';
      const needsTitle = !t.name || /^\d{1,3}[\s._-]/.test(t.name);
      const next = {
        ...t,
        artist: needsArtist ? (inferred.artist || t.artist) : t.artist,
        album: needsAlbum ? (inferred.album || t.album) : t.album,
        name: needsTitle ? (inferred.title || t.name) : t.name,
        albumArtist: t.albumArtist || (needsArtist ? (inferred.artist || t.artist) : t.artist),
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

    // Notify UI to refresh
    try {
      const refreshed = await new Promise<any[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      // Attach URLs if files exist
      const tracksWithUrls = refreshed.map((track) => ({ ...track, url: track.url || (track.file ? URL.createObjectURL(track.file) : '') }));
      window.dispatchEvent(new CustomEvent('brick:local-tracks-refreshed', { detail: { count: updatedCount, tracks: tracksWithUrls } }));
    } catch {}

    console.log(`Repair complete: updated ${updatedCount} tracks`);
    return { updated: updatedCount, tracks: undefined };
  } catch (e) {
    console.error('Repair metadata failed:', e);
    throw e;
  }
}
