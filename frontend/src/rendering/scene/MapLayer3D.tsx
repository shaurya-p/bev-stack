import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { MapLayer, MapPolygon, MapPolyline, Vec3 } from '../../schema/sceneFrame';
import { egoHorizToThree } from '../frames';
import {
  centerlineStyle,
  crosswalkStyle,
  dividerStyle,
  drivableStyle,
  isModelSource,
  stopLineStyle,
  type MapVisibility,
} from '../mapStyle';
import { IDENTITY_DELTA, type EgoMapDelta } from '../egoMotion';

// Renders SceneFrame map_layers in the 3D view. Geometry arrives in the ego
// frame (meters, z=0) and is mapped to the three.js world with the same
// convention as object boxes (frames.ts). Heights are tiny per-layer offsets
// to stack fills/lines above the ground plane without z-fighting; model
// layers sit above HD layers so predictions read as an overlay.

const HD_FILL_Y = 0.02;
const HD_LINE_Y = 0.05;
const MODEL_FILL_Y = 0.08;
const MODEL_LINE_Y = 0.11;

function ringToShapePoints(ring: Vec3[]): THREE.Vector2[] {
  // ShapeGeometry lies in the XY plane; we build it in ego x-y and rotate the
  // mesh so shape-(x, y) lands on world ego mapping. Using ego coords directly
  // keeps the shape math frame-agnostic; the group rotation does the mapping.
  return ring.map(p => new THREE.Vector2(p.x, p.y));
}

function polygonGeometry(poly: MapPolygon): THREE.ShapeGeometry | null {
  if (poly.exterior_ego_m.length < 4) return null;
  const shape = new THREE.Shape(ringToShapePoints(poly.exterior_ego_m));
  for (const hole of poly.holes_ego_m) {
    if (hole.length >= 4) shape.holes.push(new THREE.Path(ringToShapePoints(hole)));
  }
  return new THREE.ShapeGeometry(shape);
}

function lineToWorldPoints(pts: Vec3[], y: number): [number, number, number][] {
  return pts.map(p => {
    const [wx, wz] = egoHorizToThree(p.x, p.y);
    return [wx, y, wz] as [number, number, number];
  });
}

// Rotation mapping shape-space (ego x-y plane) into the world ground plane:
// shape +x (ego forward) → world −Z, shape +y (ego left) → world −X, normal → +Y.
// Achieved by rotating −90° about X (lays XY plane flat, y → −z) then 90°
// about Y is not needed if we instead swap axes via a matrix; simplest robust
// approach: rotate about X by −π/2 gives (x, y, 0) → (x, 0, y); we need
// (x, y) → (−y, −x), so additionally rotate about Y by −π/2 and mirror.
// To avoid mirror-matrix subtleties we transform vertices directly instead.
function polygonWorldGeometry(poly: MapPolygon, y: number): THREE.BufferGeometry | null {
  const geo = polygonGeometry(poly);
  if (!geo) return null;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < pos.count; i++) {
    const ex = arr[i * 3];     // ego x
    const ey = arr[i * 3 + 1]; // ego y
    const [wx, wz] = egoHorizToThree(ex, ey);
    arr[i * 3] = wx;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = wz;
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

interface PolygonFillProps {
  polygons: MapPolygon[];
  y: number;
  color: string;
  opacityFor: (p: MapPolygon) => number;
}

function PolygonFills({ polygons, y, color, opacityFor }: PolygonFillProps) {
  const items = useMemo(
    () =>
      polygons
        .map(p => ({ p, geo: polygonWorldGeometry(p, y) }))
        .filter((it): it is { p: MapPolygon; geo: THREE.BufferGeometry } => it.geo !== null),
    [polygons, y],
  );
  return (
    <>
      {items.map(({ p, geo }) => (
        <mesh key={p.element_id} geometry={geo}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={opacityFor(p)}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

interface PolylineSetProps {
  lines: MapPolyline[];
  y: number;
  styleFor: (l: MapPolyline) => { color: string; opacity: number; dashed: boolean; widthPx: number };
}

function PolylineSet({ lines, y, styleFor }: PolylineSetProps) {
  // Memoize world-space points so drei <Line> receives stable references and
  // does not regenerate geometry on unrelated re-renders (mirrors PolygonFills).
  const items = useMemo(
    () =>
      lines
        .filter(l => l.points_ego_m.length >= 2)
        .map(l => ({ l, points: lineToWorldPoints(l.points_ego_m, y) })),
    [lines, y],
  );
  return (
    <>
      {items.map(({ l, points }) => {
        const s = styleFor(l);
        return (
          <Line
            key={l.element_id}
            points={points}
            color={s.color}
            lineWidth={s.widthPx}
            dashed={s.dashed}
            dashSize={1.2}
            gapSize={1.6}
            transparent
            opacity={s.opacity}
            depthWrite={false}
            // three's LineMaterial ships with fog=false; without this, map
            // lines stay full-brightness at distance while the fogged scene
            // fades around them, making the map "light up".
            fog
          />
        );
      })}
    </>
  );
}

interface MapLayersContentProps {
  layers: MapLayer[];
  visibility: MapVisibility;
}

// Baked geometry subtree. React.memo keeps per-tick alpha updates (which only
// touch the outer motion group's transform) from re-rendering or
// re-triangulating any of this.
const MapLayersContent = memo(function MapLayersContent({
  layers,
  visibility,
}: MapLayersContentProps) {
  return (
    <>
      {layers.map(layer => {
        const vis = visibility[layer.source];
        if (vis && !vis.enabled) return null;
        const sub = vis?.sublayers;
        const model = isModelSource(layer.source);
        const fillY = model ? MODEL_FILL_Y : HD_FILL_Y;
        const lineY = model ? MODEL_LINE_Y : HD_LINE_Y;
        return (
          <group key={layer.source}>
            {(sub?.drivable_areas ?? true) && (
              <PolygonFills
                polygons={layer.drivable_areas}
                y={fillY}
                color={drivableStyle(layer, null).color}
                opacityFor={p => drivableStyle(layer, p.confidence).opacity}
              />
            )}
            {(sub?.crosswalks ?? true) && (
              <PolygonFills
                polygons={layer.crosswalks}
                y={fillY + 0.01}
                color={crosswalkStyle(layer, null).color}
                opacityFor={p => crosswalkStyle(layer, p.confidence).opacity}
              />
            )}
            {(sub?.lane_dividers ?? true) && (
              <PolylineSet
                lines={layer.lane_dividers}
                y={lineY}
                styleFor={l => dividerStyle(layer, l.kind, l.confidence)}
              />
            )}
            {(sub?.stop_lines ?? true) && (
              <PolylineSet
                lines={layer.stop_lines}
                y={lineY}
                styleFor={l => stopLineStyle(layer, l.confidence)}
              />
            )}
            {(sub?.centerlines ?? false) && (
              <PolylineSet
                lines={layer.centerlines}
                y={lineY - 0.01}
                styleFor={l => centerlineStyle(layer, l.confidence)}
              />
            )}
          </group>
        );
      })}
    </>
  );
});

interface MapLayer3DProps {
  layers: MapLayer[];
  visibility: MapVisibility;
  /** Rigid ego-motion delta for smooth scrolling between keyframes (egoMotion.ts). */
  motion?: EgoMapDelta;
}

export function MapLayer3D({ layers, visibility, motion = IDENTITY_DELTA }: MapLayer3DProps) {
  // Ego-frame delta → world: offset through the standard axis mapping; a
  // rotation about ego z (up) maps to the same-angle rotation about world Y.
  const [wx, wz] = egoHorizToThree(motion.offsetEgoX, motion.offsetEgoY);
  return (
    <group position={[wx, 0, wz]} rotation-y={motion.dyawRad}>
      <MapLayersContent layers={layers} visibility={visibility} />
    </group>
  );
}

/** True when any layer contributes renderable geometry (drives the procedural fallback). */
export function hasMapGeometry(layers: MapLayer[]): boolean {
  return layers.some(
    l =>
      l.drivable_areas.length > 0 ||
      l.lane_dividers.length > 0 ||
      l.crosswalks.length > 0 ||
      l.stop_lines.length > 0 ||
      l.centerlines.length > 0,
  );
}
