export function isPlaceholderAudioUrl(url?: string | null): boolean {
  if (typeof url !== 'string') return true;
  if (url.trim() === '') return true;

  try {
    const u = new URL(url);
    const protocol = u.protocol.toLowerCase();
    // Local and app-specific schemes should be treated as playable, not placeholders
    if (protocol === 'file:' || protocol === 'tauri:' || protocol === 'app:' || protocol === 'capacitor:' || protocol === 'native:') {
      return false;
    }
    const host = u.hostname.toLowerCase();
    // Common demo/example placeholder domains and hostnames used in the repo
    const placeholderHosts = ['soundhelix.com', 'placehold.co', 'placekitten.com', 'example.com'];
    return placeholderHosts.some(h => host.includes(h));
  } catch (e) {
    // If URL parsing fails (likely a local filesystem path or blob), treat as playable unless blob is explicitly empty
    if (url.startsWith('blob:')) return false;
    // Windows/Unix local paths should be considered playable
    if (/^[a-zA-Z]:[\\/]/.test(url) || url.startsWith('/')) return false;
    return false;
  }
}

type TrackLike = {
  previewAvailable?: boolean;
  audioUrl?: string | null;
  downloadUrl?: string | null;
  previewUrl?: string | null;
};

export function isPlayableTrack(t: unknown): boolean {
  if (t === null || t === undefined || typeof t !== 'object') return false;
  const track = t as TrackLike;
  if (track.previewAvailable === true) return true;
  const url = track.audioUrl ?? track.downloadUrl ?? track.previewUrl;
  if (url === undefined || url === null || url === '') return false;
  return !isPlaceholderAudioUrl(url);
}
