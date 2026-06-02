import { Html, Line } from '@react-three/drei';
import type { Object3D as SceneObject, SceneFrame } from '../../schema/sceneFrame';
import { egoHorizToThree, yawToRotY } from '../frames';
import { normalizeCategory } from '../categories';

// Diagnostic overlay — OFF by default. Renders flat 2D primitives at ground
// level for every object: a magenta footprint outline, a center dot, a short
// heading line, and a small HTML label with category and ego-XY distance.
//
// The overlay is intentionally independent of the procedural box geometry so
// that misalignment between an object's box and its overlay signals a bug in
// the renderer, not in the SceneFrame data.

const OVERLAY_COLOR  = '#ff10a0';
const OVERLAY_HEIGHT = 0.06;  // sits just above the ground plane

interface DebugOverlayProps {
  frame: SceneFrame;
}

export function DebugOverlay({ frame }: DebugOverlayProps) {
  return (
    <>
      {frame.objects.map(obj => (
        <ObjectMarker key={obj.object_id} obj={obj} />
      ))}
    </>
  );
}

function ObjectMarker({ obj }: { obj: SceneObject }) {
  const { center_ego_m, size_lwh_m, yaw_ego_rad } = obj.box;
  const [tx, tz] = egoHorizToThree(center_ego_m.x, center_ego_m.y);
  const rotY = yawToRotY(yaw_ego_rad);

  const l = size_lwh_m.x;
  const w = size_lwh_m.y;

  // Footprint outline in local coords (+Z forward, +X left after world remap).
  // Closed loop, drawn as one Line.
  const footprint: [number, number, number][] = [
    [-w / 2, 0,  l / 2],
    [ w / 2, 0,  l / 2],
    [ w / 2, 0, -l / 2],
    [-w / 2, 0, -l / 2],
    [-w / 2, 0,  l / 2],
  ];

  // Heading: from center to 70% of the way to the front face.
  const heading: [number, number, number][] = [
    [0, 0, 0],
    [0, 0, l * 0.7],
  ];

  const distance = Math.sqrt(center_ego_m.x ** 2 + center_ego_m.y ** 2);

  return (
    <group position={[tx, OVERLAY_HEIGHT, tz]} rotation={[0, rotY, 0]}>
      <Line points={footprint} color={OVERLAY_COLOR} lineWidth={1.5} />
      <Line points={heading}   color={OVERLAY_COLOR} lineWidth={1.5} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.30, 16]} />
        <meshBasicMaterial color={OVERLAY_COLOR} />
      </mesh>
      <Html
        position={[0, 0, 0]}
        center
        distanceFactor={20}
        style={{ pointerEvents: 'none' }}
      >
        <div className="debug-label">
          {normalizeCategory(obj.category)} · {distance.toFixed(1)}m
        </div>
      </Html>
    </group>
  );
}
