import { useMemo } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '../../schema/sceneFrame';
import type { FallbackShape, FallbackSpec } from './types';
import { THEME } from './theme';
import {
  makeBarrierGeometry,
  makeVehicleBodyGeometry,
  makeVehicleGlassGeometry,
  wheelLayout,
  type VehicleKind,
} from './proceduralGeometry';

// Minimum visual dimensions: source boxes for these classes can be smaller
// than the legibility threshold for the BEV viewer at typical zoom.
const PEDESTRIAN_MIN_HEIGHT_M = 1.5;
const CONE_MIN_HEIGHT_M       = 0.45;
const BARRIER_MIN_HEIGHT_M    = 0.5;

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

interface ProceduralVisualProps {
  fallback: FallbackSpec;
  sizeLwh:  Vec3;
  color:    string;
}

// Renders a procedural shape at the local origin in its parent's frame.
// The parent (VisualObject) is responsible for translation and yaw rotation.
// Local +Z = forward, ground plane at local y = -height/2.
export function ProceduralVisual({ fallback, sizeLwh, color }: ProceduralVisualProps) {
  switch (fallback.shape) {
    case 'vehicle':
      return <VehicleShape sizeLwh={sizeLwh} color={color} kind={fallback.vehicleKind ?? 'sedan'} />;
    case 'two_wheel':  return <TwoWheelShape sizeLwh={sizeLwh} color={color} />;
    case 'pedestrian': return <PedestrianShape sizeLwh={sizeLwh} color={color} />;
    case 'cone':       return <ConeShape sizeLwh={sizeLwh} color={color} />;
    case 'barrier':    return <BarrierShape sizeLwh={sizeLwh} color={color} />;
    case 'box':
    default:           return <BoxShape sizeLwh={sizeLwh} color={color} />;
  }
}

// ─── shared sub-parts ────────────────────────────────────────────────────────

function Wheel({ x, y, z, radius, width }: { x: number; y: number; z: number; radius: number; width: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[radius, radius, width, 18]} />
        <meshStandardMaterial color={THEME.tire} roughness={0.85} metalness={0} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[radius * 0.45, radius * 0.45, width + 0.01, 12]} />
        <meshStandardMaterial color={THEME.wheelHub} roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

function LightStrip({ z, y, width, color, intensity }: { z: number; y: number; width: number; color: string; intensity: number }) {
  return (
    <mesh position={[0, y, z]}>
      <boxGeometry args={[width, 0.07, 0.05]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} roughness={0.3} />
    </mesh>
  );
}

// ─── shape components ────────────────────────────────────────────────────────

interface ShapeProps { sizeLwh: Vec3; color: string }

function VehicleShape({ sizeLwh, color, kind }: ShapeProps & { kind: VehicleKind }) {
  const l = sizeLwh.x;
  const w = sizeLwh.y;
  const h = sizeLwh.z;

  const bodyGeo  = useMemo(() => makeVehicleBodyGeometry(kind, l, w, h),  [kind, l, w, h]);
  const glassGeo = useMemo(() => makeVehicleGlassGeometry(kind, l, w, h), [kind, l, w, h]);
  const wheels   = wheelLayout(l, w, h);
  const wheelY   = -h / 2 + wheels.radius;
  const lightY   = -h / 2 + h * 0.3;

  return (
    <>
      <mesh geometry={bodyGeo} castShadow>
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.25} envMapIntensity={0.7} />
      </mesh>
      <mesh geometry={glassGeo}>
        <meshStandardMaterial color={THEME.glass} roughness={0.12} metalness={0.4} envMapIntensity={1.0} />
      </mesh>
      <Wheel x={ wheels.x} y={wheelY} z={ wheels.z} radius={wheels.radius} width={wheels.width} />
      <Wheel x={-wheels.x} y={wheelY} z={ wheels.z} radius={wheels.radius} width={wheels.width} />
      <Wheel x={ wheels.x} y={wheelY} z={-wheels.z} radius={wheels.radius} width={wheels.width} />
      <Wheel x={-wheels.x} y={wheelY} z={-wheels.z} radius={wheels.radius} width={wheels.width} />
      {/* +0.06 clears the extrusion bevel so the strips sit on the faces */}
      <LightStrip z={ l / 2 + 0.06} y={lightY} width={w * 0.62} color={THEME.headlight} intensity={0.7} />
      <LightStrip z={-l / 2 - 0.06} y={lightY} width={w * 0.62} color={THEME.taillight} intensity={0.45} />
    </>
  );
}

function TwoWheelShape({ sizeLwh, color }: ShapeProps) {
  const l = sizeLwh.x;
  const w = sizeLwh.y;
  const h = sizeLwh.z;

  const wheelR  = Math.min(0.34, h * 0.28, l * 0.25);
  const wheelY  = -h / 2 + wheelR;
  const bodyW   = Math.min(w * 0.6, 0.3);
  const bodyH   = h * 0.22;
  const bodyY   = -h / 2 + wheelR + bodyH * 0.4;
  const hasRider = h > 1.2;

  return (
    <>
      {/* frame / body */}
      <mesh position={[0, bodyY, 0]} castShadow>
        <boxGeometry args={[bodyW, bodyH, l * 0.7]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} envMapIntensity={0.6} />
      </mesh>
      <Wheel x={0} y={wheelY} z={ l * 0.32} radius={wheelR} width={bodyW * 0.5} />
      <Wheel x={0} y={wheelY} z={-l * 0.32} radius={wheelR} width={bodyW * 0.5} />
      {hasRider && (
        <>
          <mesh position={[0, -h / 2 + h * 0.55, -l * 0.08]} castShadow>
            <capsuleGeometry args={[Math.min(0.16, w * 0.35), h * 0.3, 4, 10]} />
            <meshStandardMaterial color={color} roughness={0.6} metalness={0.05} envMapIntensity={0.4} />
          </mesh>
          <mesh position={[0, -h / 2 + h * 0.88, -l * 0.08]}>
            <sphereGeometry args={[0.11, 12, 10]} />
            <meshStandardMaterial color={THEME.glass} roughness={0.3} metalness={0.2} />
          </mesh>
        </>
      )}
    </>
  );
}

function PedestrianShape({ sizeLwh, color }: ShapeProps) {
  const h  = Math.max(sizeLwh.z, PEDESTRIAN_MIN_HEIGHT_M);
  const rt = Math.min(0.18, sizeLwh.y * 0.3);

  return (
    <>
      {/* torso */}
      <mesh position={[0, -h / 2 + h * 0.45, 0]} castShadow>
        <capsuleGeometry args={[rt, h * 0.42, 4, 12]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.05} envMapIntensity={0.4} />
      </mesh>
      {/* head */}
      <mesh position={[0, -h / 2 + h * 0.86, 0]} castShadow>
        <sphereGeometry args={[Math.min(0.12, rt * 0.8), 14, 12]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} envMapIntensity={0.4} />
      </mesh>
    </>
  );
}

function ConeShape({ sizeLwh, color }: ShapeProps) {
  const h  = Math.max(sizeLwh.z, CONE_MIN_HEIGHT_M);
  const rb = Math.min(sizeLwh.y * 0.35, 0.18);
  const hb = h - 0.04;
  const y0 = -h / 2 + 0.04; // top of the base plate

  return (
    <>
      {/* base plate */}
      <mesh position={[0, -h / 2 + 0.02, 0]} castShadow>
        <boxGeometry args={[rb * 2.4, 0.04, rb * 2.4]} />
        <meshStandardMaterial color={THEME.tire} roughness={0.9} />
      </mesh>
      {/* lower orange frustum */}
      <mesh position={[0, y0 + hb * 0.225, 0]} castShadow>
        <cylinderGeometry args={[rb * 0.62, rb, hb * 0.45, 14]} />
        <meshStandardMaterial color={color} roughness={0.5} envMapIntensity={0.3} />
      </mesh>
      {/* reflective band */}
      <mesh position={[0, y0 + hb * 0.55, 0]}>
        <cylinderGeometry args={[rb * 0.47, rb * 0.62, hb * 0.2, 14]} />
        <meshStandardMaterial color="#e8ecf2" roughness={0.3} emissive="#ffffff" emissiveIntensity={0.12} />
      </mesh>
      {/* tip */}
      <mesh position={[0, y0 + hb * 0.825, 0]} castShadow>
        <cylinderGeometry args={[rb * 0.12, rb * 0.47, hb * 0.35, 14]} />
        <meshStandardMaterial color={color} roughness={0.5} envMapIntensity={0.3} />
      </mesh>
    </>
  );
}

function BarrierShape({ sizeLwh, color }: ShapeProps) {
  const l = sizeLwh.x;
  const w = sizeLwh.y;
  const h = Math.max(sizeLwh.z, BARRIER_MIN_HEIGHT_M);

  const geo = useMemo(() => makeBarrierGeometry(l, w, h), [l, w, h]);

  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color={color} roughness={0.85} metalness={0} envMapIntensity={0.25} />
    </mesh>
  );
}

// Plain translucent box with edges — used for unknown / generic movable
// objects, where pretending to know the shape would be misleading.
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
          opacity={0.35}
          envMapIntensity={0.3}
        />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color={color} />
      </lineSegments>
    </>
  );
}
