export function isPlaceholderAudioUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    // Common demo/example placeholder domains and hostnames used in the repo
    const placeholderHosts = ['soundhelix.com', 'placehold.co', 'placekitten.com', 'example.com'];
    return placeholderHosts.some(h => host.includes(h));
  } catch (e) {
    // If URL constructor fails (maybe it's a blob URL) treat as not placeholder
    if (typeof url === 'string' && url.startsWith('blob:')) return false;
    return true; // non-HTTP-ish URLs should be treated as not playable by default
  }
}

export function isPlayableTrack(t: any): boolean {
  if (!t) return false;
  if (t.previewAvailable === true) return true;
  const url = t.audioUrl || t.downloadUrl || t.previewUrl;
  if (!url) return false;
  return !isPlaceholderAudioUrl(url);
}
