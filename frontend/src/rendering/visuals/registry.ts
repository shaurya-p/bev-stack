// Pure-data map from normalized category (or 'ego') to VisualSpec.
//
// All current entries use procedural fallbacks. Real GLB assets can be added
// by populating the optional `asset` field — the renderer code does not need
// to change when that happens.
//
// Colors are tuned for the dark product scene (see visuals/theme.ts).

import type { RegistryKey, VisualSpec } from './types';
import { normalizeCategory } from '../categories';
import { THEME } from './theme';

const REGISTRY: Record<RegistryKey, VisualSpec> = {
  ego: {
    color:    THEME.egoPaint,
    fallback: { shape: 'vehicle', vehicleKind: 'sedan' },
  },
  car: {
    color:    '#5b8def',
    fallback: { shape: 'vehicle', vehicleKind: 'sedan' },
  },
  truck: {
    color:    '#3fa3c4',
    fallback: { shape: 'vehicle', vehicleKind: 'truck' },
  },
  bus: {
    color:    '#3dbf9a',
    fallback: { shape: 'vehicle', vehicleKind: 'bus' },
  },
  motorcycle: {
    color:    '#8d7be0',
    fallback: { shape: 'two_wheel' },
  },
  bicycle: {
    color:    '#5fbf77',
    fallback: { shape: 'two_wheel' },
  },
  construction_vehicle: {
    color:    '#c9a13f',
    fallback: { shape: 'vehicle', vehicleKind: 'truck' },
  },
  pedestrian: {
    color:    '#f5a13c',
    fallback: { shape: 'pedestrian' },
  },
  barrier: {
    color:    '#76808f',
    fallback: { shape: 'barrier' },
  },
  traffic_cone: {
    color:    '#f26d21',
    fallback: { shape: 'cone' },
  },
  movable_object: {
    color:    '#8a8f99',
    fallback: { shape: 'box' },
  },
  unknown: {
    color:    '#69707d',
    fallback: { shape: 'box' },
  },
};

export function getVisualSpec(rawCategory: string): VisualSpec {
  return REGISTRY[normalizeCategory(rawCategory)];
}

export function getEgoSpec(): VisualSpec {
  return REGISTRY.ego;
}

// Accent color for UI elements (panel dots, legends) so the UI matches the
// 3D product palette.
export function categoryColor(rawCategory: string): string {
  return getVisualSpec(rawCategory).color;
}
