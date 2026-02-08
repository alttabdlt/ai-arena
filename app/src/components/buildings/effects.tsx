import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export function IndustrialSmoke({ position, intensity = 1 }: { position: [number, number, number]; intensity?: number }) {
  const smokesRef = useRef<THREE.Points>(null);
  const count = Math.floor(20 * intensity);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 0.5;
      arr[i * 3 + 1] = Math.random() * 3;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!smokesRef.current) return;
    const pos = smokesRef.current.geometry.attributes.position.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += 0.02;
      pos[i * 3] += Math.sin(t + i) * 0.005;
      pos[i * 3 + 2] += Math.cos(t * 0.7 + i) * 0.005;
      if (pos[i * 3 + 1] > 5) {
        pos[i * 3 + 1] = 0;
        pos[i * 3] = (Math.random() - 0.5) * 0.5;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
      }
    }
    smokesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={smokesRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#4b5563" size={0.4} transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

export function ConstructionAnimation({ position }: { position: [number, number, number] }) {
  const craneRef = useRef<THREE.Group>(null);
  const hookRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (craneRef.current) {
      craneRef.current.rotation.y = Math.sin(t * 0.3) * 0.4;
    }
    if (hookRef.current) {
      hookRef.current.position.y = 2.5 + Math.sin(t * 1.5) * 0.5;
    }
  });

  return (
    <group position={position}>
      <mesh position={[1.8, 1.5, 1.8]}>
        <boxGeometry args={[0.3, 3, 0.3]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
      <group ref={craneRef} position={[1.8, 3, 1.8]}>
        <mesh position={[-1, 0.15, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.2, 2.5, 0.2]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>
        <mesh ref={hookRef} position={[-2, 2.5, 0]}>
          <boxGeometry args={[0.15, 0.5, 0.15]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <mesh position={[-2, 2.8, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      </group>
    </group>
  );
}
