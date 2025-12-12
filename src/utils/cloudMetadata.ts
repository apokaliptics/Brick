// Utility to fetch a small HEAD/Ranged slice of an audio URL and parse metadata using jsmediatags
// Note: This relies on CORS allowing ranged requests and/or full GET.
// It will return tags or null.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';

export async function parseRemoteMetadataFromUrl(url: string, name?: string): Promise<any | null> {
  if (!url) return null;
  try {
    const resp = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-65535' } });
    if (!resp.ok) {
      return null;
    }
    const arrayBuffer = await resp.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'audio/*' });
    const fileForTags = new File([blob], name || 'remote', { type: 'audio/*' });
    return new Promise((resolve) => {
      // @ts-ignore
      jsmediatags.read(fileForTags, {
        onSuccess: (result: any) => resolve(result),
        onError: (err: any) => {
          resolve(null);
        }
      });
    });
  } catch (err) {
    console.warn('Failed to parse remote metadata', err);
    return null;
  }
}
