import { useMemo } from 'react';
import { Line } from '@react-three/drei';

// Background color and fog tone are matched to the Canvas clear color in
// BevScene3D so the scene fades seamlessly into the page background.
const BACKGROUND_COLOR = '#eef1f5';

export function Stage() {
  return (
    <>
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <fog attach="fog" args={[BACKGROUND_COLOR, 70, 150]} />
      <GroundPlane />
      <RoadCorridor />
      <RangeRings />
    </>
  );
}

function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial color="#eaecf0" roughness={0.95} metalness={0} />
    </mesh>
  );
}

// Darker strip representing the driveable surface — runs from 10m behind ego
// to 80m ahead (world z: +10 to −80, centered at z=−35). 8m wide.
// y=0.001 avoids z-fighting with the ground plane.
function RoadCorridor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, -35]}>
      <planeGeometry args={[8, 90]} />
      <meshStandardMaterial color="#d4d9e3" roughness={0.97} metalness={0} />
    </mesh>
  );
}

function RangeRings() {
  const rings = useMemo(() => {
    return [20, 40, 60].map(r => {
      const pts: [number, number, number][] = [];
      const segments = 96;
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push([Math.cos(a) * r, 0.02, Math.sin(a) * r]);
      }
      return { r, pts };
    });
  }, []);

  return (
    <>
      {rings.map(({ r, pts }) => (
        <Line
          key={r}
          points={pts}
          color="#9baabb"
          lineWidth={1}
          dashed
          dashSize={1.5}
          gapSize={3.5}
        />
      ))}
    </>
  );
}
