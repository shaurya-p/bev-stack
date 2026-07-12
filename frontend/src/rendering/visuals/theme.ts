// Central visual theme for the 3D product view.
//
// All scene-dressing and material colors live here so the product look can be
// tuned in one place. Category accent colors live in the visual registry
// (registry.ts); this file holds everything that is not per-category.

export const THEME = {
  // Scene / atmosphere
  background:   '#0b0e14',
  fogNear:      65,
  fogFar:       170,

  // Ground composition. Values look light for a dark theme because dark sRGB
  // albedos collapse to near-black after linear conversion + ACES tone mapping.
  ground:       '#2b313d',
  road:         '#3a4250',
  laneLine:     '#b6c1d2',
  gridCell:     '#414b5c',
  gridSection:  '#566377',
  rangeRing:    '#5d6b82',

  // HD-map layer (muted, recedes behind objects)
  mapHdDrivable:   '#333b48',
  mapHdDivider:    '#8f9aac',
  mapHdRoadEdge:   '#6b7688',
  mapHdCrosswalk:  '#7d8798',
  mapHdStopLine:   '#79849a',
  mapHdCenterline: '#4d5a70',

  // Model map layers (vivid, reads as prediction overlay)
  mapModelPrimary: '#35d0a5',

  // Shared object materials
  tire:         '#0b0d11',
  wheelHub:     '#3a4250',
  glass:        '#101720',
  headlight:    '#cfe6ff',
  taillight:    '#ff5040',

  // Ego presentation
  egoPaint:     '#dfe5ee',
  egoAccent:    '#38c8f0',
  egoHalo:      '#2fb9e8',
} as const;
