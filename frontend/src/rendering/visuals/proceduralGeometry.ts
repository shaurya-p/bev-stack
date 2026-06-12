// Procedural geometry builders for the visual fallbacks.
//
// All builders return geometry in the renderer's box-local frame:
//   local +Z = forward, +Y = up, +X = width axis, origin at the box center.
// Profiles are authored in a side view (x = forward fraction of length,
// y = height fraction 0..1 of the box height) and extruded across the width.

import * as THREE from 'three';

export type VehicleKind = 'sedan' | 'truck' | 'bus';

// [forwardFraction (-0.5..0.5), heightFraction (0..1)]
type ProfilePoint = readonly [number, number];

// Body silhouettes. Closed counter-clockwise, starting at the front-bottom.
// Bottom edges sit well above the wheel centers so the wheels read clearly
// below the body.
const BODY_PROFILES: Record<VehicleKind, readonly ProfilePoint[]> = {
  sedan: [
    [ 0.50, 0.24], [ 0.50, 0.42], [ 0.44, 0.50], [ 0.20, 0.55],
    [ 0.06, 0.93], [-0.20, 0.93], [-0.32, 0.55], [-0.46, 0.50],
    [-0.50, 0.42], [-0.50, 0.24],
  ],
  truck: [
    [ 0.50, 0.22], [ 0.50, 0.46], [ 0.44, 0.50], [ 0.34, 0.50],
    [ 0.27, 0.80], [ 0.21, 0.82], [ 0.19, 1.00], [-0.50, 1.00],
    [-0.50, 0.22],
  ],
  bus: [
    [ 0.50, 0.18], [ 0.50, 0.82], [ 0.44, 1.00], [-0.46, 1.00],
    [-0.50, 0.82], [-0.50, 0.18],
  ],
};

// Greenhouse (glass) silhouettes, slightly inset from the body profile.
const GLASS_PROFILES: Record<VehicleKind, readonly ProfilePoint[]> = {
  sedan: [
    [ 0.17, 0.56], [ 0.04, 0.90], [-0.18, 0.90], [-0.29, 0.56],
  ],
  truck: [
    [ 0.32, 0.52], [ 0.26, 0.78], [ 0.20, 0.78], [ 0.24, 0.52],
  ],
  bus: [
    [ 0.42, 0.58], [ 0.42, 0.86], [-0.42, 0.86], [-0.42, 0.58],
  ],
};

// Extrudes a side profile across the width and reorients it so that
// length runs along local +Z and width along local X.
function extrudeProfile(
  profile: readonly ProfilePoint[],
  lengthM: number,
  widthM: number,
  heightM: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  profile.forEach(([fx, fy], i) => {
    const x = fx * lengthM;
    const y = fy * heightM - heightM / 2;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  const bevel = Math.min(0.06, widthM * 0.06);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: widthM - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geo.translate(0, 0, -(widthM - bevel * 2) / 2);
  // Authored frame: +X forward, extruded along Z (width).
  // rotateY(-π/2): +X → +Z (forward), extrusion axis → width along X.
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function makeVehicleBodyGeometry(
  kind: VehicleKind, lengthM: number, widthM: number, heightM: number,
): THREE.BufferGeometry {
  return extrudeProfile(BODY_PROFILES[kind], lengthM, widthM, heightM);
}

export function makeVehicleGlassGeometry(
  kind: VehicleKind, lengthM: number, widthM: number, heightM: number,
): THREE.BufferGeometry {
  // Slightly wider than the inset body so glass reads through the bevel.
  return extrudeProfile(GLASS_PROFILES[kind], lengthM, widthM * 0.92, heightM);
}

// Jersey-barrier cross-section (width × height), extruded along the length.
export function makeBarrierGeometry(
  lengthM: number, widthM: number, heightM: number,
): THREE.BufferGeometry {
  const w = widthM / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-w, 0);
  shape.lineTo( w, 0);
  shape.lineTo( w, heightM * 0.22);
  shape.lineTo( w * 0.45, heightM * 0.55);
  shape.lineTo( w * 0.38, heightM);
  shape.lineTo(-w * 0.38, heightM);
  shape.lineTo(-w * 0.45, heightM * 0.55);
  shape.lineTo(-w, heightM * 0.22);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: lengthM,
    bevelEnabled: false,
    curveSegments: 2,
  });
  // Authored: cross-section in XY (x = width, y = up from 0), extruded along +Z.
  geo.translate(0, -heightM / 2, -lengthM / 2);
  geo.computeVertexNormals();
  return geo;
}

// Wheel dimensions shared by all vehicle shapes.
export function wheelLayout(lengthM: number, widthM: number, heightM: number) {
  const radius = Math.min(0.5, heightM * 0.24, lengthM * 0.12);
  const width  = Math.min(0.26, widthM * 0.16);
  return {
    radius,
    width,
    // Wheel centers: ±x across the width (slightly proud of the body so they
    // stay readable below the side skirt), ±z along the length.
    x: widthM / 2 - width / 2 + 0.03,
    z: lengthM * 0.31,
  };
}
