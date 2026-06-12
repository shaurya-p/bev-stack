import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { SceneFrame } from '../schema/sceneFrame';
import { Lighting } from './scene/Lighting';
import { Stage } from './scene/Stage';
import { EgoActor } from './scene/EgoActor';
import { ObjectLayer } from './scene/ObjectLayer';
import { DebugOverlay } from './scene/DebugOverlay';
import { THEME } from './visuals/theme';

interface BevScene3DProps {
  frame:      SceneFrame;
  showDebug?: boolean;
}

export function BevScene3D({ frame, showDebug = false }: BevScene3DProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [11, 16, 22], fov: 50, near: 0.5, far: 500 }}
      style={{ background: THEME.background }}
    >
      <Lighting />
      <Stage />
      <EgoActor />
      <ObjectLayer frame={frame} />
      {showDebug && <DebugOverlay frame={frame} />}
      <OrbitControls
        target={[0, 0.5, -10]}
        minDistance={8}
        maxDistance={140}
        maxPolarAngle={Math.PI / 2.1}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        makeDefault
      />
    </Canvas>
  );
}
