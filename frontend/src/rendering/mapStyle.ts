// Visual style resolution for SceneFrame map layers.
//
// The schema carries semantic facts only (element geometry, divider `kind`,
// `confidence`). Everything visual — color, opacity, dash pattern, HD-muted
// vs model-vivid treatment, confidence fade — is decided here, keyed by the
// layer `source`. Shared by the 3D scene and the 2D canvas so both views
// agree on layer identity.

import type { MapLayer } from '../schema/sceneFrame';
import { THEME } from './visuals/theme';

export const MAP_SUBLAYERS = [
  'drivable_areas',
  'lane_dividers',
  'crosswalks',
  'stop_lines',
  'centerlines',
] as const;

export type MapSublayer = (typeof MAP_SUBLAYERS)[number];

export const SUBLAYER_LABELS: Record<MapSublayer, string> = {
  drivable_areas: 'drivable',
  lane_dividers: 'dividers',
  crosswalks: 'crosswalks',
  stop_lines: 'stop lines',
  centerlines: 'centerlines',
};

// Per-source visibility: master toggle + per-sublayer toggles.
export interface MapSourceVisibility {
  enabled: boolean;
  sublayers: Record<MapSublayer, boolean>;
}

export type MapVisibility = Record<string, MapSourceVisibility>;

export function defaultSourceVisibility(): MapSourceVisibility {
  return {
    enabled: true,
    sublayers: {
      drivable_areas: true,
      lane_dividers: true,
      crosswalks: true,
      stop_lines: true,
      centerlines: false, // dense; off by default for the HD layer
    },
  };
}

/** Merge visibility defaults for any sources present in the frame but not yet in state. */
export function ensureVisibilityFor(sources: string[], vis: MapVisibility): MapVisibility {
  let out = vis;
  for (const s of sources) {
    if (!out[s]) out = { ...out, [s]: defaultSourceVisibility() };
  }
  return out;
}

export function isModelSource(source: string): boolean {
  return source.startsWith('model:');
}

// ── style resolution ─────────────────────────────────────────────────────────

export interface LineStyle {
  color: string;
  opacity: number;
  dashed: boolean;
  widthPx: number; // reference width; views scale as appropriate
}

export interface FillStyle {
  color: string;
  opacity: number;
}

/** Confidence fade: null (ground truth) renders at full strength. */
function confidenceScale(confidence: number | null): number {
  if (confidence === null) return 1;
  return 0.35 + 0.65 * Math.max(0, Math.min(1, confidence));
}

export function drivableStyle(layer: MapLayer, confidence: number | null): FillStyle {
  if (isModelSource(layer.source)) {
    return { color: THEME.mapModelPrimary, opacity: 0.10 * confidenceScale(confidence) };
  }
  return { color: THEME.mapHdDrivable, opacity: 0.9 };
}

export function crosswalkStyle(layer: MapLayer, confidence: number | null): FillStyle {
  if (isModelSource(layer.source)) {
    return { color: THEME.mapModelPrimary, opacity: 0.25 * confidenceScale(confidence) };
  }
  return { color: THEME.mapHdCrosswalk, opacity: 0.18 };
}

export function dividerStyle(
  layer: MapLayer,
  kind: string | null,
  confidence: number | null,
): LineStyle {
  if (isModelSource(layer.source)) {
    return {
      color: THEME.mapModelPrimary,
      opacity: 0.95 * confidenceScale(confidence),
      dashed: kind === 'dashed',
      widthPx: 2.5,
    };
  }
  switch (kind) {
    case 'road_edge':
      return { color: THEME.mapHdRoadEdge, opacity: 0.5, dashed: false, widthPx: 2 };
    case 'solid':
      return { color: THEME.mapHdDivider, opacity: 0.4, dashed: false, widthPx: 1.5 };
    case 'dashed':
    default:
      return { color: THEME.mapHdDivider, opacity: 0.32, dashed: true, widthPx: 1.5 };
  }
}

export function stopLineStyle(layer: MapLayer, confidence: number | null): LineStyle {
  if (isModelSource(layer.source)) {
    return {
      color: THEME.mapModelPrimary,
      opacity: 0.9 * confidenceScale(confidence),
      dashed: false,
      widthPx: 2.5,
    };
  }
  return { color: THEME.mapHdStopLine, opacity: 0.4, dashed: false, widthPx: 2 };
}

export function centerlineStyle(layer: MapLayer, confidence: number | null): LineStyle {
  if (isModelSource(layer.source)) {
    return {
      color: THEME.mapModelPrimary,
      opacity: 0.85 * confidenceScale(confidence),
      dashed: true,
      widthPx: 2,
    };
  }
  return { color: THEME.mapHdCenterline, opacity: 0.35, dashed: true, widthPx: 1 };
}

/** Accent color for HUD chips, keyed by source. */
export function sourceAccent(source: string): string {
  return isModelSource(source) ? THEME.mapModelPrimary : THEME.mapHdDivider;
}
