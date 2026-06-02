import type { Object3D as SceneObject } from '../../schema/sceneFrame';
import { egoHorizToThree, groundedCenterY, yawToRotY } from '../frames';
import { getVisualSpec } from '../visuals/registry';
import { ProceduralBox, effectiveHeightM } from '../visuals/ProceduralBox';

interface VisualObjectProps {
  obj: SceneObject;
}

// Single rendering entry point for any SceneFrame Object3D. Looks up the
// VisualSpec from the registry, places and orients the object in world space,
// then delegates geometry to the procedural fallback. When `spec.asset` is
// populated in a future ticket, this is where the asset mesh would be
// rendered instead — with the same placement.
export function VisualObject({ obj }: VisualObjectProps) {
  const spec = getVisualSpec(obj.category);
  const { center_ego_m, size_lwh_m, yaw_ego_rad } = obj.box;

  const [tx, tz] = egoHorizToThree(center_ego_m.x, center_ego_m.y);
  const h    = effectiveHeightM(spec.fallback.shape, size_lwh_m);
  const posY = groundedCenterY(center_ego_m.z, h);
  const rotY = yawToRotY(yaw_ego_rad);

  return (
    <group position={[tx, posY, tz]} rotation={[0, rotY, 0]}>
      <ProceduralBox fallback={spec.fallback} sizeLwh={size_lwh_m} color={spec.color} />
    </group>
  );
}
