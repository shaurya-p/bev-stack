// Mapping between the SceneFrame ego frame and the three.js world frame.
//
// SceneFrame ego frame:  x = forward,  y = left,  z = up
// three.js world frame:  X = right,    Y = up,    Z = backward
//
//   three_x = -ego_y   (ego-left  → three +X right inverted: ego-left is three -X)
//   three_z = -ego_x   (ego-forward → three -Z)
//
// Yaw convention for box-local +Z = forward:
//   rotation.y = π + yaw_ego_rad
//   yaw=0   → θ=π   → local +Z maps to world (0,0,-1) = ego-forward ✓
//   yaw=π/2 → θ=3π/2 → local +Z maps to world (-1,0,0) = ego-left   ✓

export function egoHorizToThree(egoX: number, egoY: number): [number, number] {
  return [-egoY, -egoX];
}

export function yawToRotY(yawEgoRad: number): number {
  return Math.PI + yawEgoRad;
}

// Rendering-only clamp: ensures the visual box bottom stays at y ≥ 0 if the
// source z-origin sits slightly below the ground plane. SceneFrame data is
// never modified.
export function groundedCenterY(rawCenterZ: number, heightM: number): number {
  return Math.max(rawCenterZ, heightM / 2);
}
