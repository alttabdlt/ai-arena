import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { type AgentEconomicState } from './types';
import type { AgentState } from './types';

export type ArenaOutcomeResult = 'WIN' | 'LOSS' | 'DRAW';

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

const ARENA_OUTCOME_AURA_CONFIG: Record<
  ArenaOutcomeResult,
  { color: string; baseOpacity: number; emissive: number; lift: number }
> = {
  WIN: { color: '#22c55e', baseOpacity: 0.52, emissive: 0.9, lift: 0.34 },
  LOSS: { color: '#ef4444', baseOpacity: 0.48, emissive: 0.8, lift: 0.2 },
  DRAW: { color: '#38bdf8', baseOpacity: 0.42, emissive: 0.65, lift: 0.26 },
};

export function ArenaOutcomeAura({
  outcome,
  triggeredAtMs,
}: {
  outcome: ArenaOutcomeResult | null;
  triggeredAtMs: number | null;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const LIFE_MS = 12000;

  useFrame((frameState) => {
    if (!outcome || !triggeredAtMs || !ringRef.current || !haloRef.current) return;
    const age = Date.now() - triggeredAtMs;
    if (age < 0 || age > LIFE_MS) {
      ringRef.current.visible = false;
      haloRef.current.visible = false;
      return;
    }

    ringRef.current.visible = true;
    haloRef.current.visible = true;

    const cfg = ARENA_OUTCOME_AURA_CONFIG[outcome];
    const life = Math.max(0, Math.min(1, age / LIFE_MS));
    const fade = 1 - life;
    const t = frameState.clock.elapsedTime;
    const pulse = 1 + life * 2.2 + Math.sin(t * 12.5) * 0.08;
    const lift = cfg.lift + Math.sin(t * 9.2) * 0.03;

    ringRef.current.position.y = 0.06 + lift;
    haloRef.current.position.y = 0.04 + lift * 0.7;
    ringRef.current.scale.set(pulse, pulse, 1);
    haloRef.current.scale.set(pulse * 0.88, pulse * 0.88, 1);

    const ringMat = ringRef.current.material as THREE.MeshStandardMaterial;
    ringMat.opacity = cfg.baseOpacity * fade;
    ringMat.emissiveIntensity = cfg.emissive * fade;

    const haloMat = haloRef.current.material as THREE.MeshBasicMaterial;
    haloMat.opacity = (cfg.baseOpacity * 0.5) * fade;
  });

  if (!outcome || !triggeredAtMs) return null;

  const cfg = ARENA_OUTCOME_AURA_CONFIG[outcome];
  return (
    <group>
      <mesh ref={haloRef} position={[0, 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.56, 32]} />
        <meshBasicMaterial color={cfg.color} transparent opacity={cfg.baseOpacity * 0.5} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.64, 0.04, 10, 40]} />
        <meshStandardMaterial
          color={cfg.color}
          emissive={cfg.color}
          emissiveIntensity={cfg.emissive}
          transparent
          opacity={cfg.baseOpacity}
          roughness={0.28}
          metalness={0.25}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function EconomicStateEffect({ state }: { state: AgentEconomicState }) {
  if (state === 'THRIVING') return <ThrivingGlow />;
  return null;
}
