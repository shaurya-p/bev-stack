import { useMemo } from 'react';
import * as THREE from 'three';
import { getEgoSpec } from '../visuals/registry';
import { THEME } from '../visuals/theme';
import {
  makeVehicleBodyGeometry,
  makeVehicleGlassGeometry,
  wheelLayout,
} from '../visuals/proceduralGeometry';

// Nominal ego footprint. Rendering-only: SceneFrame carries no ego box, and
// the visualization treats the ego as a standard mid-size vehicle.
const EGO_L = 4.6;
const EGO_W = 1.88;
const EGO_H = 1.5;

// Ego sits at the world origin with forward = world -Z (yaw = 0 in the
// renderer's convention). Rendered as a procedural sedan with metallic paint,
// glass canopy, wheels, accent light strips, and a soft ground halo. A future
// ticket can replace the geometry with a GLB asset declared on the registry's
// `ego` entry without touching placement.
export function EgoActor() {
  const spec = getEgoSpec();

  const bodyGeo  = useMemo(() => makeVehicleBodyGeometry('sedan', EGO_L, EGO_W, EGO_H), []);
  const glassGeo = useMemo(() => makeVehicleGlassGeometry('sedan', EGO_L, EGO_W, EGO_H), []);
  const wheels   = wheelLayout(EGO_L, EGO_W, EGO_H);

  return (
    <group>
      <group position={[0, EGO_H / 2, 0]} rotation={[0, Math.PI, 0]}>
        <mesh geometry={bodyGeo} castShadow>
          <meshStandardMaterial
            color={spec.color}
            roughness={0.25}
            metalness={0.65}
            envMapIntensity={1.0}
          />
        </mesh>
        <mesh geometry={glassGeo}>
          <meshStandardMaterial color={THEME.glass} roughness={0.1} metalness={0.4} envMapIntensity={1.2} />
        </mesh>
        {[
          [ wheels.x,  wheels.z], [-wheels.x,  wheels.z],
          [ wheels.x, -wheels.z], [-wheels.x, -wheels.z],
        ].map(([x, z], i) => (
          <group key={i} position={[x, -EGO_H / 2 + wheels.radius, z]} rotation={[0, 0, Math.PI / 2]}>
            <mesh castShadow>
              <cylinderGeometry args={[wheels.radius, wheels.radius, wheels.width, 20]} />
              <meshStandardMaterial color={THEME.tire} roughness={0.85} />
            </mesh>
            <mesh>
              <cylinderGeometry args={[wheels.radius * 0.45, wheels.radius * 0.45, wheels.width + 0.01, 14]} />
              <meshStandardMaterial color={THEME.wheelHub} roughness={0.35} metalness={0.7} />
            </mesh>
          </group>
        ))}
        {/* accent light strips: cyan front bar, red tail bar */}
        <mesh position={[0, -EGO_H / 2 + 0.45, EGO_L / 2 + 0.06]}>
          <boxGeometry args={[EGO_W * 0.7, 0.08, 0.05]} />
          <meshStandardMaterial
            color={THEME.egoAccent}
            emissive={THEME.egoAccent}
            emissiveIntensity={1.2}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0, -EGO_H / 2 + 0.45, -EGO_L / 2 - 0.06]}>
          <boxGeometry args={[EGO_W * 0.7, 0.08, 0.05]} />
          <meshStandardMaterial
            color={THEME.taillight}
            emissive={THEME.taillight}
            emissiveIntensity={0.8}
            roughness={0.3}
          />
        </mesh>
      </group>
      <EgoHalo />
    </group>
  );
}

// Soft radial glow + thin ring under the ego — anchors the vehicle visually
// and marks the frame origin without debug styling.
function EgoHalo() {
  const haloTexture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, 'rgba(47, 185, 232, 0.45)');
    g.addColorStop(0.45, 'rgba(47, 185, 232, 0.12)');
    g.addColorStop(1.0, 'rgba(47, 185, 232, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshBasicMaterial map={haloTexture} transparent depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.62, 2.7, 64]} />
        <meshBasicMaterial color={THEME.egoHalo} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}
