import { getEgoSpec } from '../visuals/registry';

// Ego sits at the world origin with forward = world -Z (yaw = 0 in the
// renderer's convention). This component currently renders a bespoke procedural
// vehicle that's slightly more detailed than the generic vehicle fallback
// (darker cabin, front light strip). A future ticket replaces the geometry
// with a GLB asset declared on the registry's `ego` entry.
export function EgoActor() {
  const spec = getEgoSpec();
  return (
    <group>
      {/* lower body: 2.0m wide × 1.35m tall × 4.8m long, bottom at y=0 */}
      <mesh position={[0, 0.675, 0]} castShadow>
        <boxGeometry args={[2.0, 1.35, 4.8]} />
        <meshStandardMaterial color={spec.color} roughness={0.4} metalness={0.25} />
      </mesh>
      {/* cabin — sits on top of body, shifted slightly toward the front */}
      <mesh position={[0, 1.71, -0.15]} castShadow>
        <boxGeometry args={[1.72, 0.72, 2.4]} />
        <meshStandardMaterial color="#1c3060" roughness={0.5} metalness={0.15} transparent opacity={0.92} />
      </mesh>
      {/* front light strip at front face */}
      <mesh position={[0, 0.5, -2.38]}>
        <boxGeometry args={[1.8, 0.1, 0.06]} />
        <meshStandardMaterial color="#93c5fd" emissive="#60a5fa" emissiveIntensity={0.2} roughness={0.3} />
      </mesh>
    </group>
  );
}
