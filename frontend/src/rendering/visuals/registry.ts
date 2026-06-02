// Pure-data map from normalized category (or 'ego') to VisualSpec.
//
// All current entries use procedural fallbacks. Real GLB assets will be added
// in a follow-up ticket by populating the optional `asset` field — the
// renderer code does not need to change when that happens.

import type { RegistryKey, VisualSpec } from './types';
import { normalizeCategory } from '../categories';

const REGISTRY: Record<RegistryKey, VisualSpec> = {
  ego: {
    color:    '#3451a8',
    fallback: { shape: 'vehicle' },
  },
  car: {
    color:    '#1d4ed8',
    fallback: { shape: 'vehicle' },
  },
  truck: {
    color:    '#0369a1',
    fallback: { shape: 'vehicle' },
  },
  bus: {
    color:    '#0369a1',
    fallback: { shape: 'vehicle' },
  },
  motorcycle: {
    color:    '#4f46e5',
    fallback: { shape: 'two_wheel' },
  },
  bicycle: {
    color:    '#15803d',
    fallback: { shape: 'two_wheel' },
  },
  construction_vehicle: {
    color:    '#4b5563',
    fallback: { shape: 'vehicle' },
  },
  pedestrian: {
    color:    '#b45309',
    fallback: { shape: 'pedestrian' },
  },
  barrier: {
    color:    '#475569',
    fallback: { shape: 'barrier' },
  },
  traffic_cone: {
    color:    '#c2410c',
    fallback: { shape: 'cone' },
  },
  movable_object: {
    color:    '#4b5563',
    fallback: { shape: 'barrier' },
  },
  unknown: {
    color:    '#4b5563',
    fallback: { shape: 'vehicle' },
  },
};

export function getVisualSpec(rawCategory: string): VisualSpec {
  return REGISTRY[normalizeCategory(rawCategory)];
}

export function getEgoSpec(): VisualSpec {
  return REGISTRY.ego;
}
