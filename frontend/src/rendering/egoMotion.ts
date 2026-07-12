// Rigid 2D ego-motion delta for smooth map scrolling between sparse keyframes.
//
// Map geometry is baked in the *current* keyframe's ego frame. While playback
// sits at alpha ∈ [0,1] between `cur` and `next`, the rendered ego frame is the
// interpolated pose. This module computes the rigid transform that re-expresses
// cur-ego geometry in that interpolated frame:
//
//   p_interp = R(−Δyaw) · p_cur + R_i⁻¹ · (t_c − t_i)
//
// where (t_c, yaw_c) is cur's global ego pose, (t_i, yaw_i) the interpolated
// pose (lerped translation, shortest-path lerped yaw), Δyaw = yaw_i − yaw_c.
// Identity at alpha=0; matches next's ego frame exactly at alpha=1, so motion
// is continuous across keyframe boundaries.
//
// Pure math, no rendering imports — the ego→world axis mapping stays in the
// consumers (frames.ts convention).

import type { Pose3D } from '../schema/sceneFrame';
import { lerp, lerpAngle } from '../sequence/interpolate';

export interface EgoMapDelta {
  /** Offset of baked geometry, expressed in the interpolated ego frame, meters. */
  offsetEgoX: number;
  offsetEgoY: number;
  /** Rotation to apply to baked geometry about ego z (up), radians. */
  dyawRad: number;
}

export const IDENTITY_DELTA: EgoMapDelta = { offsetEgoX: 0, offsetEgoY: 0, dyawRad: 0 };

/** Yaw (rotation about z) of a wxyz quaternion, radians. */
export function yawFromQuaternionWXYZ(q: {
  w: number;
  x: number;
  y: number;
  z: number;
}): number {
  return Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
}

/**
 * Rigid transform taking cur-ego-frame map geometry into the alpha-interpolated
 * ego frame. Returns identity when poses are unavailable (sources without
 * pose_global degrade to today's per-keyframe snap) or alpha collapses to 0.
 */
export function egoMapDelta(
  curPose: Pose3D | null,
  nextPose: Pose3D | null,
  alpha: number,
): EgoMapDelta {
  if (!curPose || !nextPose || alpha <= 0) return IDENTITY_DELTA;

  const tc = curPose.translation_m;
  const tn = nextPose.translation_m;
  const yawC = yawFromQuaternionWXYZ(curPose.rotation_quat_wxyz);
  const yawN = yawFromQuaternionWXYZ(nextPose.rotation_quat_wxyz);

  const yawI = lerpAngle(yawC, yawN, alpha);
  const tix = lerp(tc.x, tn.x, alpha);
  const tiy = lerp(tc.y, tn.y, alpha);

  // Global offset of cur origin relative to interpolated origin, rotated into
  // the interpolated ego frame: R_i⁻¹ · (t_c − t_i).
  const dxg = tc.x - tix;
  const dyg = tc.y - tiy;
  const cos = Math.cos(-yawI);
  const sin = Math.sin(-yawI);

  return {
    offsetEgoX: cos * dxg - sin * dyg,
    offsetEgoY: sin * dxg + cos * dyg,
    dyawRad: -(yawI - yawC), // R(−Δyaw)
  };
}
