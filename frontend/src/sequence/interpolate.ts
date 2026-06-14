// Pure render-state interpolation between two sparse SceneFrames.
//
// This is a frontend-only smoothing layer. It does NOT change the SceneFrame
// contract: it synthesizes an in-between SceneFrame for rendering while playback
// sits between two source keyframes. Source JSON is never modified.
//
// Object matching is by object_id:
//   - present in both        -> interpolate pose (center, yaw, size)
//   - present in current only -> held at its current pose until the next keyframe
//   - present in next only    -> appears at the next keyframe (no mid-segment pop-in)
//
// Holding/appearing at keyframe boundaries keeps the object set stable across a
// segment, which avoids flicker without needing per-object opacity in the viewer.

import type { Object3D, SceneFrame, Vec3 } from '../schema/sceneFrame';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

/** Shortest-path angle interpolation (handles ±π wrap). */
export function lerpAngle(a: number, b: number, t: number): number {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * t;
}

function interpolateObject(cur: Object3D, next: Object3D, t: number): Object3D {
  return {
    ...cur,
    box: {
      center_ego_m: lerpVec3(cur.box.center_ego_m, next.box.center_ego_m, t),
      size_lwh_m: lerpVec3(cur.box.size_lwh_m, next.box.size_lwh_m, t),
      yaw_ego_rad: lerpAngle(cur.box.yaw_ego_rad, next.box.yaw_ego_rad, t),
    },
  };
}

/**
 * Build a render-only SceneFrame interpolated between `cur` and `next` at t∈[0,1].
 * Returns `cur` unchanged when there is no next frame or t collapses to an endpoint.
 * Non-geometric fields (ego, cameras, lidar, metadata, diagnostics) come from `cur`.
 */
export function interpolateFrame(
  cur: SceneFrame,
  next: SceneFrame | null,
  t: number,
): SceneFrame {
  if (!next || t <= 0) return cur;
  if (t >= 1) return next;

  const nextById = new Map(next.objects.map(o => [o.object_id, o]));
  const objects = cur.objects.map(obj => {
    const match = nextById.get(obj.object_id);
    return match ? interpolateObject(obj, match, t) : obj;
  });

  return {
    ...cur,
    timestamp_us: lerp(cur.timestamp_us, next.timestamp_us, t),
    objects,
  };
}
