// Utility to fetch a small HEAD/Ranged slice of an audio URL and parse metadata using jsmediatags
// Note: This relies on CORS allowing ranged requests and/or full GET.
// It will return tags or null.
// @ts-expect-error jsmediatags does not publish TypeScript types
import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';

type JsMediaTagsResult = Record<string, unknown>;

type JsMediaTags = {
  read: (
    file: File,
    opts: { onSuccess: (result: JsMediaTagsResult) => void; onError: (err: unknown) => void },
  ) => void;
};

const typedJsMediaTags = jsmediatags as JsMediaTags;

export async function parseRemoteMetadataFromUrl(
  url: string,
  name?: string,
): Promise<JsMediaTagsResult | null> {
  if (url === undefined || url === null || url === '') return null;
  try {
    const resp = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-65535' } });
    if (!resp.ok) {
      return null;
    }
    const arrayBuffer = await resp.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'audio/*' });
    const fileName = typeof name === 'string' && name !== '' ? name : 'remote';
    const fileForTags = new File([blob], fileName, { type: 'audio/*' });
    return new Promise((resolve) => {
      typedJsMediaTags.read(fileForTags, {
        onSuccess: (result: JsMediaTagsResult) => resolve(result),
        onError: (_err: unknown) => {
          resolve(null);
        }
      });
    });
  } catch (err) {
    console.warn('Failed to parse remote metadata', err);
    return null;
  }
}
