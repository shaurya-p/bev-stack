import { useCallback, useEffect, useRef, useState } from 'react';
import type { SceneFrame } from '../schema/sceneFrame';
import { loadFrame, loadManifest, type SequenceManifest } from './manifest';

// Real-time playback paced by per-frame timestamps. nuScenes keyframes are ~2 Hz,
// so a 30-frame sequence plays in ~15 s at 1x. If timestamps are unusable we fall
// back to a fixed step. Frames are fetched on demand and cached; the next frame is
// prefetched so playback stays responsive without preloading the whole sequence.

const FALLBACK_FRAME_MS = 500;
const PLAYBACK_SPEED = 1;

export interface Playback {
  manifest: SequenceManifest | null;
  frame: SceneFrame | null;
  index: number;
  playing: boolean;
  error: string | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (index: number) => void;
}

function frameStepMs(manifest: SequenceManifest, index: number): number {
  const cur = manifest.frames[index];
  const next = manifest.frames[index + 1];
  if (!next) return FALLBACK_FRAME_MS;
  const dt = (next.timestamp_us - cur.timestamp_us) / 1000;
  return dt > 0 && Number.isFinite(dt) ? dt : FALLBACK_FRAME_MS;
}

export function usePlayback(manifestUrl: string): Playback {
  const [manifest, setManifest] = useState<SequenceManifest | null>(null);
  const [frame, setFrame] = useState<SceneFrame | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cache = useRef(new Map<number, SceneFrame>());

  useEffect(() => {
    let cancelled = false;
    loadManifest(manifestUrl)
      .then(m => {
        if (!cancelled) setManifest(m);
      })
      .catch(e => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [manifestUrl]);

  // Load the active frame (from cache when possible) and prefetch the next one.
  useEffect(() => {
    if (!manifest) return;
    let cancelled = false;

    const get = async (i: number): Promise<SceneFrame | null> => {
      const entry = manifest.frames[i];
      if (!entry) return null;
      const cached = cache.current.get(i);
      if (cached) return cached;
      const loaded = await loadFrame(manifestUrl, entry);
      cache.current.set(i, loaded);
      return loaded;
    };

    get(index)
      .then(f => {
        if (!cancelled && f) setFrame(f);
        void get(index + 1); // prefetch
      })
      .catch(e => {
        if (!cancelled) setError(String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [manifest, manifestUrl, index]);

  // Advance frames in real time while playing.
  useEffect(() => {
    if (!playing || !manifest) return;
    const stepMs = frameStepMs(manifest, index) / PLAYBACK_SPEED;
    const id = window.setTimeout(() => {
      setIndex(i => (i + 1) % manifest.frame_count);
    }, stepMs);
    return () => window.clearTimeout(id);
  }, [playing, manifest, index]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying(p => !p), []);
  const seek = useCallback((i: number) => {
    setPlaying(false);
    setIndex(i);
  }, []);

  return { manifest, frame, index, playing, error, play, pause, toggle, seek };
}
