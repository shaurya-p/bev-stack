import type { NormalizedCategory } from '../categories';
import type { VehicleKind } from './proceduralGeometry';

// Procedural fallback shapes. Used when a registry entry has no asset, or
// when an asset is missing / failing to load.
export type FallbackShape =
  | 'vehicle'     // extruded body silhouette + wheels + glass + light strips
  | 'two_wheel'   // slim body + inline wheels + rider
  | 'pedestrian'  // capsule figure
  | 'cone'        // banded traffic cone
  | 'barrier'     // jersey-barrier extrusion
  | 'box';        // plain box + edges (unknowns)

export interface FallbackSpec {
  shape: FallbackShape;
  // Which body silhouette a 'vehicle' fallback uses. Defaults to 'sedan'.
  vehicleKind?: VehicleKind;
}

// Optional asset entry. Populated when real GLB meshes land.
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
