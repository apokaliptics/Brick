import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

type TauriAwareWindow = Window & { __TAURI__?: unknown };

export type NativeAudioStatus = "playing" | "paused" | "stopped" | "seeking" | "volume";

export interface NativeAudioEventPayload {
  status: NativeAudioStatus;
  filePath?: string;
  position?: number;
  volume?: number;
}

const hasTauriRuntime = () => typeof window !== "undefined" && Boolean((window as TauriAwareWindow).__TAURI__);

const requireRuntime = () => {
  if (!hasTauriRuntime()) {
    throw new Error("Native playback is only available inside the Tauri runtime.");
  }
};

export const playSong = async (filePath: string) => {
  requireRuntime();
  return invoke("playSong", { filePath });
};

export const pauseSong = async () => {
  requireRuntime();
  return invoke("pauseSong");
};

export const resumeSong = async () => {
  requireRuntime();
  return invoke("resumeSong");
};

export const stopSong = async () => {
  requireRuntime();
  return invoke("stopSong");
};

export const setVolume = async (level: number) => {
  requireRuntime();
  return invoke("setVolume", { level });
};

export const seekTo = async (positionSeconds: number) => {
  requireRuntime();
  return invoke("seekTo", { positionSeconds });
};

export const listenNativeAudioState = async (
  handler: (payload: NativeAudioEventPayload) => void,
): Promise<UnlistenFn> => {
  requireRuntime();
  return listen<NativeAudioEventPayload>("native-audio://state", (event) => handler(event.payload));
};

export const isNativePlaybackAvailable = hasTauriRuntime;
