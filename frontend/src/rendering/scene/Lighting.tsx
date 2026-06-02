export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.75} color="#ffffff" />
      <directionalLight
        position={[15, 45, 10]}
        intensity={1.15}
        color="#f5efe8"
        castShadow
      />
    </>
  );
}
