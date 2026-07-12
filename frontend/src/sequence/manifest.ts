// Source-agnostic sequence manifest. Mirrors the backend build_manifest() output
// in backend/bevstack/export/sequence_exporter.py.
//
// The frontend treats `source` as an opaque label and `dataset` as an opaque blob.
// It must never branch on dataset-specific fields, so playback stays source-agnostic.
//
// Frame paths are relative to the manifest URL, so a sequence folder is relocatable.

import type { SceneFrame } from '../schema/sceneFrame';

export interface ManifestFrame {
  index: number;
  path: string;
  timestamp_us: number;
}

export interface SequenceManifest {
  schema_version: number;
  sequence_id: string;
  name: string;
  source: string;
  frame_count: number;
  frames: ManifestFrame[];
  dataset?: Record<string, unknown>;
}

/** Resolve a frame path that is relative to the manifest URL. */
export function resolveFramePath(manifestUrl: string, framePath: string): string {
  return new URL(framePath, new URL(manifestUrl, window.location.href)).toString();
}

export async function loadManifest(manifestUrl: string): Promise<SequenceManifest> {
  const r = await fetch(manifestUrl);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as SequenceManifest;
}

/** Normalize fields that older exports may omit (schema additions). */
export function normalizeFrame(raw: SceneFrame): SceneFrame {
  return { ...raw, map_layers: raw.map_layers ?? [] };
}

export async function loadFrame(manifestUrl: string, frame: ManifestFrame): Promise<SceneFrame> {
  const url = resolveFramePath(manifestUrl, frame.path);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return normalizeFrame((await r.json()) as SceneFrame);
}
