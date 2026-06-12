import { useMemo } from 'react';
import { Grid, Line } from '@react-three/drei';
import { THEME } from '../visuals/theme';

// Scene dressing for the product view: dark asphalt ground, a generic road
// corridor along the ego axis with lane markings, a fading reference grid,
// and faint range rings. Everything here is static composition — no
// SceneFrame data flows into the stage.

const ROAD_WIDTH_M    = 8;
const ROAD_BACK_M     = 25;   // behind ego (world +Z)
const ROAD_AHEAD_M    = 95;   // ahead of ego (world −Z)

export function Stage() {
  return (
    <>
      <color attach="background" args={[THEME.background]} />
      <fog attach="fog" args={[THEME.background, THEME.fogNear, THEME.fogFar]} />
      <GroundPlane />
      <ReferenceGrid />
      <RoadCorridor />
      <RangeRings />
    </>
  );
}

function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <circleGeometry args={[240, 64]} />
      <meshStandardMaterial color={THEME.ground} roughness={1} metalness={0} envMapIntensity={0.15} />
    </mesh>
  );
}

function ReferenceGrid() {
  return (
    <Grid
      position={[0, 0.01, 0]}
      cellSize={2}
      cellThickness={0.5}
      cellColor={THEME.gridCell}
      sectionSize={10}
      sectionThickness={1}
      sectionColor={THEME.gridSection}
      fadeDistance={110}
      fadeStrength={2}
      infiniteGrid
    />
  );
}

// Generic driveable corridor along the ego axis: asphalt strip, solid edge
// lines, dashed center line. Scene dressing only — not derived from map data.
function RoadCorridor() {
  const length  = ROAD_BACK_M + ROAD_AHEAD_M;
  const centerZ = (ROAD_BACK_M - ROAD_AHEAD_M) / 2;

  const dashes = useMemo(() => {
    const out: number[] = [];
    const dashLen = 2.5;
    const period  = 6.5;
    for (let z = ROAD_BACK_M - 3; z - dashLen > -ROAD_AHEAD_M; z -= period) {
      out.push(z - dashLen / 2);
    }
    return out;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, centerZ]} receiveShadow>
        <planeGeometry args={[ROAD_WIDTH_M, length]} />
        <meshStandardMaterial color={THEME.road} roughness={1} metalness={0} envMapIntensity={0.1} />
      </mesh>
      {/* edge lines */}
      {[-1, 1].map(side => (
        <mesh
          key={side}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[side * (ROAD_WIDTH_M / 2 - 0.25), 0.03, centerZ]}
        >
          <planeGeometry args={[0.12, length - 2]} />
          <meshBasicMaterial color={THEME.laneLine} transparent opacity={0.3} />
        </mesh>
      ))}
      {/* dashed center line */}
      {dashes.map(z => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, z]}>
          <planeGeometry args={[0.15, 2.5]} />
          <meshBasicMaterial color={THEME.laneLine} transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function RangeRings() {
  const rings = useMemo(() => {
    return [20, 40, 60].map(r => {
      const pts: [number, number, number][] = [];
      const segments = 96;
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push([Math.cos(a) * r, 0.04, Math.sin(a) * r]);
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
          color={THEME.rangeRing}
          lineWidth={1}
          dashed
          dashSize={1.5}
          gapSize={3.5}
          transparent
          opacity={0.8}
        />
      ))}
    </>
  );
}
