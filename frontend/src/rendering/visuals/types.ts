import type { NormalizedCategory } from '../categories';

// Procedural fallback shapes. Used when a registry entry has no asset, or
// when an asset is missing / failing to load.
export type FallbackShape =
  | 'vehicle'     // body box + cabin + optional heading line
  | 'two_wheel'   // body box + heading line (no cabin)
  | 'pedestrian'  // upright cylinder
  | 'cone'        // cone primitive
  | 'barrier'     // low box + edges
  | 'box';        // plain box + edges

export interface FallbackSpec {
  shape: FallbackShape;
}

// Optional asset entry. Populated in Ticket #2 when real GLB meshes land.
//
// nativeForwardAxis records the +X / -X / +Z / -Z axis along which the asset
// faces in its own local frame. The loader uses this to rotate the asset so
// its forward aligns with the renderer's local +Z (which then maps to ego-x
// forward via the scene-graph mapping documented in frames.ts).
export interface AssetEntry {
  url: string;
  nativeLengthM: number;
  nativeForwardAxis: '+X' | '-X' | '+Z' | '-Z';
}

export interface VisualSpec {
  color: string;
  fallback: FallbackSpec;
  asset?: AssetEntry;
  scaleMode?: 'fit-box' | 'native';
  yawOffsetRad?: number;
  groundOffsetM?: number;
}

export type RegistryKey = NormalizedCategory | 'ego';
