import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { type AgentEconomicState } from './types';
import type { AgentState } from './types';

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

const ACTION_AURA_CONFIG: Partial<
  Record<AgentState, { color: string; radius: number; speed: number; opacity: number }>
> = {
  CLAIMING: { color: '#facc15', radius: 0.68, speed: 5.1, opacity: 0.42 },
  BUILDING: { color: '#f97316', radius: 0.74, speed: 7.6, opacity: 0.38 },
  WORKING: { color: '#fb923c', radius: 0.72, speed: 8.8, opacity: 0.38 },
  TRADING: { color: '#22d3ee', radius: 0.78, speed: 6.3, opacity: 0.36 },
  FIGHTING: { color: '#fb7185', radius: 0.82, speed: 10.2, opacity: 0.45 },
};

export function ActionAura({ state }: { state: AgentState }) {
  const config = ACTION_AURA_CONFIG[state];
  const ringRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);

  useFrame((frameState) => {
    if (!config) return;
    const t = frameState.clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.z = t * (0.45 + config.speed * 0.05);
      const scale = 1 + Math.sin(t * config.speed) * 0.08;
      ringRef.current.scale.set(scale, scale, 1);
      const material = ringRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = config.opacity + Math.sin(t * config.speed * 0.8) * 0.08;
      material.emissiveIntensity = 0.45 + Math.sin(t * config.speed * 0.9) * 0.22;
    }
    if (pulseRef.current) {
      const burst = 0.62 + (Math.sin(t * (config.speed * 0.5)) + 1) * 0.18;
      pulseRef.current.scale.set(burst, burst, 1);
      const pulseMat = pulseRef.current.material as THREE.MeshBasicMaterial;
      pulseMat.opacity = 0.16 + Math.sin(t * config.speed * 0.7) * 0.06;
    }
  });

  if (!config) return null;

  return (
    <group>
      <mesh ref={pulseRef} position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[config.radius * 0.64, config.radius * 0.8, 28]} />
        <meshBasicMaterial color={config.color} transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[config.radius, 0.03, 10, 36]} />
        <meshStandardMaterial
          color={config.color}
          emissive={config.color}
          emissiveIntensity={0.48}
          transparent
          opacity={config.opacity}
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
    </group>
  );
}

export function EconomicStateEffect({ state }: { state: AgentEconomicState }) {
  if (state === 'THRIVING') return <ThrivingGlow />;
  return null;
}
