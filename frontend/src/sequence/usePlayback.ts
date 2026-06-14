import { useCallback, useEffect, useRef, useState } from 'react';
import type { SceneFrame } from '../schema/sceneFrame';
import { loadFrame, loadManifest, type SequenceManifest } from './manifest';

// Continuous playback. Position is a float frame coordinate (e.g. 12.37 = 37% of
// the way from keyframe 12 to keyframe 13). The integer part selects which source
// frames are loaded; the fractional part (alpha) drives interpolation in the view.
//
// Playback is paced by per-segment timestamps so it matches real time. nuScenes
// keyframes are ~2 Hz, so a 30-frame sequence plays in ~15 s at 1x. Frames are
// fetched on demand and cached; the next two are prefetched so playback stays
// responsive without preloading the whole sequence.

const FALLBACK_SEGMENT_MS = 500;
const PLAYBACK_SPEED = 1;
// Clamp per-tick advance so a backgrounded tab (huge dt) doesn't jump or spin.
const MAX_TICK_MS = 100;

export interface Playback {
  manifest: SequenceManifest | null;
  current: SceneFrame | null;
  next: SceneFrame | null;
  index: number;
  alpha: number;
  playing: boolean;
  error: string | null;
  toggle: () => void;
  seek: (index: number) => void;
}

/** Real-time duration of the segment starting at keyframe `i`, in ms. */
function segmentMs(manifest: SequenceManifest, i: number): number {
  const a = manifest.frames[i];
  const b = manifest.frames[i + 1];
  if (!a || !b) return FALLBACK_SEGMENT_MS;
  const dt = (b.timestamp_us - a.timestamp_us) / 1000;
  return dt > 0 && Number.isFinite(dt) ? dt : FALLBACK_SEGMENT_MS;
}

/** Advance a float position by `dtMs`, consuming variable-length segments and looping. */
function advance(manifest: SequenceManifest, pos: number, dtMs: number): number {
  const count = manifest.frame_count;
  if (count <= 1) return 0;
  let p = pos;
  let remaining = dtMs;
  while (remaining > 0) {
    const i = Math.floor(p);
    const seg = segmentMs(manifest, i);
    const msToBoundary = (i + 1 - p) * seg;
    if (remaining < msToBoundary) {
      p += remaining / seg;
      break;
    }
    remaining -= msToBoundary;
    p = i + 1;
    if (p >= count - 1) return 0; // loop back to start, consume rest next tick
  }
  return p;
}

export function usePlayback(manifestUrl: string): Playback {
  const [manifest, setManifest] = useState<SequenceManifest | null>(null);
  const [current, setCurrent] = useState<SceneFrame | null>(null);
  const [next, setNext] = useState<SceneFrame | null>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cache = useRef(new Map<number, SceneFrame>());
  const posRef = useRef(0); // mirrors `position` for the rAF loop without stale closures

  const index =
    manifest ? Math.min(Math.floor(position), manifest.frame_count - 1) : 0;
  const alpha = position - index;

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

  // Load current + next source frames whenever the integer index changes, and
  // prefetch one more. Keyed on `index`, not `position`, so it does not refetch
  // every animation tick.
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

    Promise.all([get(index), get(index + 1)])
      .then(([cur, nxt]) => {
        if (cancelled) return;
        if (cur) setCurrent(cur);
        setNext(nxt);
        void get(index + 2); // prefetch
      })
      .catch(e => {
        if (!cancelled) setError(String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [manifest, manifestUrl, index]);

  // Continuous animation loop.
  useEffect(() => {
    if (!playing || !manifest) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, MAX_TICK_MS) * PLAYBACK_SPEED;
      last = now;
      posRef.current = advance(manifest, posRef.current, dt);
      setPosition(posRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, manifest]);

  const toggle = useCallback(() => setPlaying(p => !p), []);
  const seek = useCallback((i: number) => {
    setPlaying(false);
    posRef.current = i;
    setPosition(i);
  }, []);

  return { manifest, current, next, index, alpha, playing, error, toggle, seek };
}
