import { useMemo } from 'react';
import * as THREE from 'three';
import type { Object3D as SceneObject } from '../../schema/sceneFrame';
import { egoHorizToThree, groundedCenterY, yawToRotY } from '../frames';
import { getVisualSpec } from '../visuals/registry';
import { ProceduralVisual, effectiveHeightM } from '../visuals/ProceduralVisual';

const VELOCITY_MIN_MPS = 0.5;

interface VisualObjectProps {
  obj: SceneObject;
}

// Single rendering entry point for any SceneFrame Object3D. Looks up the
// VisualSpec from the registry, places and orients the object in world space,
// then delegates geometry to the procedural fallback. When `spec.asset` is
// populated, this is where the asset mesh would be rendered instead — with
// the same placement.
export function VisualObject({ obj }: VisualObjectProps) {
  const spec = getVisualSpec(obj.category);
  const { center_ego_m, size_lwh_m, yaw_ego_rad } = obj.box;

  const [tx, tz] = egoHorizToThree(center_ego_m.x, center_ego_m.y);
  const h    = effectiveHeightM(spec.fallback.shape, size_lwh_m);
  const posY = groundedCenterY(center_ego_m.z, h);
  const rotY = yawToRotY(yaw_ego_rad);

  return (
    <>
      <group position={[tx, posY, tz]} rotation={[0, rotY, 0]}>
        <ProceduralVisual fallback={spec.fallback} sizeLwh={size_lwh_m} color={spec.color} />
      </group>
      {obj.velocity_ego_mps && (
        <VelocityChevron
          tx={tx}
          tz={tz}
          velocityEgo={obj.velocity_ego_mps}
          clearanceM={Math.max(size_lwh_m.x, size_lwh_m.y) / 2}
          color={spec.color}
        />
      )}
    </>
  );
}

// Flat ground-level arrow ahead of a moving object, pointing along its
// velocity vector (which is given in the ego frame, independent of box yaw).
// Product styling, not a diagnostic: shown only above a small speed threshold.
function VelocityChevron({ tx, tz, velocityEgo, clearanceM, color }: {
  tx: number;
  tz: number;
  velocityEgo: { x: number; y: number; z: number };
  clearanceM: number;
  color: string;
}) {
  const speed = Math.hypot(velocityEgo.x, velocityEgo.y);
  const lengthM = THREE.MathUtils.clamp(speed * 0.5, 0.8, 4.5);

  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, lengthM);        // tip
    shape.lineTo(0.34, 0);           // base right
    shape.lineTo(0, lengthM * 0.3);  // notch
    shape.lineTo(-0.34, 0);          // base left
    shape.closePath();
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(Math.PI / 2); // lay flat on the ground, shape +Y → world +Z
    return g;
  }, [lengthM]);

  if (speed < VELOCITY_MIN_MPS) return null;

  const [dx, dz] = egoHorizToThree(velocityEgo.x, velocityEgo.y);
  const heading  = Math.atan2(dx, dz);
  const offset   = clearanceM + 0.4;

  return (
    <group position={[tx, 0.04, tz]} rotation={[0, heading, 0]}>
      <mesh geometry={geo} position={[0, 0, offset]}>
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
