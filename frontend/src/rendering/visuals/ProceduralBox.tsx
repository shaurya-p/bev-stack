import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { Vec3 } from '../../schema/sceneFrame';
import type { FallbackShape, FallbackSpec } from './types';

// Minimum visual dimensions: source boxes for these classes can be smaller
// than the legibility threshold for the BEV viewer at typical zoom.
const PEDESTRIAN_MAX_RADIUS_M = 0.25;
const PEDESTRIAN_MIN_HEIGHT_M = 1.5;
const CONE_MAX_RADIUS_M       = 0.20;
const CONE_MIN_HEIGHT_M       = 0.4;
const BARRIER_MIN_HEIGHT_M    = 0.3;

// Effective rendered height for grounding purposes. VisualObject uses this to
// compute the world-Y at which to seat the geometry so its bottom rests at y=0.
export function effectiveHeightM(shape: FallbackShape, sizeLwh: Vec3): number {
  switch (shape) {
    case 'pedestrian': return Math.max(sizeLwh.z, PEDESTRIAN_MIN_HEIGHT_M);
    case 'cone':       return Math.max(sizeLwh.z, CONE_MIN_HEIGHT_M);
    case 'barrier':    return Math.max(sizeLwh.z, BARRIER_MIN_HEIGHT_M);
    case 'vehicle':
    case 'two_wheel':
    case 'box':
    default:           return sizeLwh.z;
  }
}

interface ProceduralBoxProps {
  fallback: FallbackSpec;
  sizeLwh:  Vec3;
  color:    string;
}

// Renders a procedural shape at the local origin in its parent's frame.
// The parent (VisualObject) is responsible for translation and yaw rotation.
// Local +Z = forward.
export function ProceduralBox({ fallback, sizeLwh, color }: ProceduralBoxProps) {
  switch (fallback.shape) {
    case 'vehicle':    return <VehicleShape sizeLwh={sizeLwh} color={color} withCabin />;
    case 'two_wheel':  return <VehicleShape sizeLwh={sizeLwh} color={color} withCabin={false} />;
    case 'pedestrian': return <PedestrianShape sizeLwh={sizeLwh} color={color} />;
    case 'cone':       return <ConeShape sizeLwh={sizeLwh} color={color} />;
    case 'barrier':    return <BarrierShape sizeLwh={sizeLwh} color={color} />;
    case 'box':
    default:           return <BoxShape sizeLwh={sizeLwh} color={color} />;
  }
}

// ─── shape components ────────────────────────────────────────────────────────

interface ShapeProps { sizeLwh: Vec3; color: string }

function VehicleShape({ sizeLwh, color, withCabin }: ShapeProps & { withCabin: boolean }) {
  const l = sizeLwh.x;
  const w = sizeLwh.y;
  const h = sizeLwh.z;

  // Body occupies the lower 55% of the annotation box height, seated at the box bottom.
  const bodyH      = h * 0.55;
  const bodyLocalY = -h / 2 + bodyH / 2;

  // Cabin sits on top of body, slightly shifted toward the front (+Z in local frame).
  const cabinH      = h * 0.40;
  const cabinW      = w * 0.84;
  const cabinL      = l * 0.52;
  const cabinLocalY = -h / 2 + bodyH + cabinH / 2;
  const cabinLocalZ = l * 0.05;

  const bodyGeo  = useMemo(() => new THREE.BoxGeometry(w, bodyH, l), [w, bodyH, l]);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(bodyGeo), [bodyGeo]);
  const cabinGeo = useMemo(() => new THREE.BoxGeometry(cabinW, cabinH, cabinL), [cabinW, cabinH, cabinL]);

  const headingPts: [number, number, number][] = [[0, 0, 0], [0, 0, l / 2]];

  return (
    <>
      <mesh geometry={bodyGeo} position={[0, bodyLocalY, 0]} castShadow>
        <meshStandardMaterial
          color={new THREE.Color(color)}
          roughness={0.55}
          metalness={0.08}
          transparent
          opacity={0.92}
        />
      </mesh>

      <lineSegments geometry={edgesGeo} position={[0, bodyLocalY, 0]}>
        <lineBasicMaterial color="#1a2030" />
      </lineSegments>

      {withCabin && (
        <mesh geometry={cabinGeo} position={[0, cabinLocalY, cabinLocalZ]} castShadow>
          <meshStandardMaterial
            color={new THREE.Color(color)}
            roughness={0.65}
            metalness={0.05}
            transparent
            opacity={0.75}
          />
        </mesh>
      )}

      <Line points={headingPts} color={color} lineWidth={2} />
    </>
  );
}

function PedestrianShape({ sizeLwh, color }: ShapeProps) {
  const r = Math.min(sizeLwh.y / 2, PEDESTRIAN_MAX_RADIUS_M);
  const h = Math.max(sizeLwh.z, PEDESTRIAN_MIN_HEIGHT_M);
  return (
    <mesh castShadow>
      <cylinderGeometry args={[r, r, h, 10]} />
      <meshStandardMaterial color={color} roughness={0.6} transparent opacity={0.90} />
    </mesh>
  );
}

function ConeShape({ sizeLwh, color }: ShapeProps) {
  const r = Math.min(sizeLwh.y / 2, CONE_MAX_RADIUS_M);
  const h = Math.max(sizeLwh.z, CONE_MIN_HEIGHT_M);
  return (
    <mesh castShadow>
      <coneGeometry args={[r, h, 8]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  );
}

function BarrierShape({ sizeLwh, color }: ShapeProps) {
  const l = sizeLwh.x;
  const w = sizeLwh.y;
  const h = Math.max(sizeLwh.z, BARRIER_MIN_HEIGHT_M);

  const boxGeo   = useMemo(() => new THREE.BoxGeometry(w, h, l), [w, h, l]);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(boxGeo), [boxGeo]);

  return (
    <>
      <mesh geometry={boxGeo} castShadow>
        <meshStandardMaterial
          color={new THREE.Color(color)}
          transparent
          opacity={0.60}
          roughness={0.9}
        />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color="#2a3040" />
      </lineSegments>
    </>
  );
}

function BoxShape({ sizeLwh, color }: ShapeProps) {
  const l = sizeLwh.x;
  const w = sizeLwh.y;
  const h = sizeLwh.z;
  const boxGeo   = useMemo(() => new THREE.BoxGeometry(w, h, l), [w, h, l]);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(boxGeo), [boxGeo]);
  return (
    <>
      <mesh geometry={boxGeo} castShadow>
        <meshStandardMaterial
          color={new THREE.Color(color)}
          roughness={0.7}
          transparent
          opacity={0.85}
        />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color="#1a2030" />
      </lineSegments>
    </>
  );
}
