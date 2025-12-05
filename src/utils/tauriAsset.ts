import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Convert a local filesystem path into a Tauri asset-protocol URL
 * suitable for <audio>/<video> src attributes.
 */
export function pathToAssetUrl(filePath: string): string {
  return convertFileSrc(filePath);
}

/**
 * Set an HTMLAudioElement source from a filesystem path and trigger preload.
 */
export function setAudioSourceFromPath(audio: HTMLAudioElement, filePath: string) {
  audio.src = pathToAssetUrl(filePath);
  audio.load();
}
