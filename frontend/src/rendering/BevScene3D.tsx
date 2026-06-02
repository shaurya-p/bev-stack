import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { SceneFrame } from '../schema/sceneFrame';
import { Lighting } from './scene/Lighting';
import { Stage } from './scene/Stage';
import { EgoActor } from './scene/EgoActor';
import { ObjectLayer } from './scene/ObjectLayer';
import { DebugOverlay } from './scene/DebugOverlay';

interface BevScene3DProps {
  frame:      SceneFrame;
  showDebug?: boolean;
}

export function BevScene3D({ frame, showDebug = false }: BevScene3DProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 45, 22], fov: 50, near: 0.5, far: 600 }}
      style={{ background: '#eef1f5' }}
    >
      <Lighting />
      <Stage />
      <EgoActor />
      <ObjectLayer frame={frame} />
      {showDebug && <DebugOverlay frame={frame} />}
      <OrbitControls
        target={[0, 0, -15]}
        minDistance={15}
        maxDistance={120}
        maxPolarAngle={Math.PI / 2.15}
        enablePan={false}
      />
    </Canvas>
  );
}
