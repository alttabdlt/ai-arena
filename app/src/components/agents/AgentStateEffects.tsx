import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { type AgentEconomicState } from './types';

// Thriving gold ring at feet
export function ThrivingGlow() {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      const t = state.clock.elapsedTime;
      (ringRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + Math.sin(t * 2) * 0.15;
      ringRef.current.rotation.z = t * 0.5;
    }
  });

  return (
    <mesh ref={ringRef} position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.7, 0.04, 8, 24]} />
      <meshStandardMaterial
        color="#fbbf24"
        emissive="#fbbf24"
        emissiveIntensity={0.3}
        transparent
        opacity={0.5}
      />
    </mesh>
  );
}

// Chatting state blue ring at feet
export function ChatAura() {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      const t = state.clock.elapsedTime;
      const scale = 1 + Math.sin(t * 3) * 0.1;
      ringRef.current.scale.set(scale, scale, 1);
      (ringRef.current.material as THREE.MeshStandardMaterial).opacity = 0.3 + Math.sin(t * 2) * 0.1;
    }
  });

  return (
    <mesh ref={ringRef} position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.6, 0.03, 8, 24]} />
      <meshStandardMaterial
        color="#60a5fa"
        emissive="#60a5fa"
        emissiveIntensity={0.4}
        transparent
        opacity={0.35}
      />
    </mesh>
  );
}

export function EconomicStateEffect({ state }: { state: AgentEconomicState }) {
  if (state === 'THRIVING') return <ThrivingGlow />;
  return null;
}
