// Single source of truth for SceneFrame category dispatch.
//
// Source-agnostic by design: raw `category` strings from any backend adapter
// (nuScenes, custom detectors, fusion outputs) collapse into a stable
// NormalizedCategory union that the visual registry and UI panels consume.
//
// Match order matters — earlier matchers win. Ordering is chosen so that
// nuScenes label space resolves correctly without accidental cross-matches.

export type NormalizedCategory =
  | 'car'
  | 'truck'
  | 'bus'
  | 'motorcycle'
  | 'bicycle'
  | 'construction_vehicle'
  | 'pedestrian'
  | 'barrier'
  | 'traffic_cone'
  | 'movable_object'
  | 'unknown';

const RAW_MATCHERS: ReadonlyArray<readonly [NormalizedCategory, readonly string[]]> = [
  ['traffic_cone',         ['cone']],
  ['barrier',              ['barrier']],
  ['pedestrian',           ['pedestrian', 'human']],
  ['motorcycle',           ['motorcycle']],
  ['bicycle',              ['bicycle']],
  ['bus',                  ['bus']],
  ['truck',                ['truck']],
  ['construction_vehicle', ['construction']],
  ['movable_object',       ['movable_object']],
  ['car',                  ['car']],
];

export function normalizeCategory(raw: string): NormalizedCategory {
  const lower = raw.toLowerCase();
  for (const [normalized, needles] of RAW_MATCHERS) {
    if (needles.some(n => lower.includes(n))) return normalized;
  }
  return 'unknown';
}

const DISPLAY_NAMES: Record<NormalizedCategory, string> = {
  car:                  'car',
  truck:                'truck',
  bus:                  'bus',
  motorcycle:           'motorcycle',
  bicycle:              'bicycle',
  construction_vehicle: 'construction',
  pedestrian:           'pedestrian',
  barrier:              'barrier',
  traffic_cone:         'traffic cone',
  movable_object:       'movable object',
  unknown:              'unknown',
};

export function displayName(raw: string): string {
  const cat = normalizeCategory(raw);
  if (cat !== 'unknown') return DISPLAY_NAMES[cat];
  const last = raw.split('.').pop() ?? raw;
  return last.replace(/_/g, ' ');
}
