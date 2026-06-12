import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function Lighting() {
  return (
    <>
      <StudioEnvironment />
      <hemisphereLight args={['#33445f', '#0a0d12', 0.5]} />
      {/* key light — cool daylight, casts the scene's shadows */}
      <directionalLight
        position={[20, 32, 14]}
        intensity={4.5}
        color="#e8f0ff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-near={5}
        shadow-camera-far={120}
        shadow-bias={-0.0005}
      />
      {/* rim light — separates dark object silhouettes from the dark ground */}
      <directionalLight position={[-25, 16, -18]} intensity={0.35} color="#6f87c0" />
    </>
  );
}

// Image-based lighting from three's procedural RoomEnvironment (no network
// assets). Gives metallic/glossy materials believable reflections; per-
// material envMapIntensity keeps the dark ground from washing out.
function StudioEnvironment() {
  const gl    = useThree(s => s.gl);
  const scene = useThree(s => s.scene);

  useEffect(() => {
    const pmrem  = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    return () => {
      scene.environment = null;
      envTex.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return null;
}
