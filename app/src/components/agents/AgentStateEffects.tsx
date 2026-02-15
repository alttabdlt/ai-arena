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

type ActionAuraConfig = {
  color: string;
  accent: string;
  radius: number;
  speed: number;
  opacity: number;
  orbiters: number;
  spikes: number;
  pulseDepth: number;
  lift: number;
};

const ACTION_AURA_CONFIG: Partial<Record<AgentState, ActionAuraConfig>> = {
  CLAIMING: {
    color: '#facc15',
    accent: '#fde047',
    radius: 0.68,
    speed: 5.2,
    opacity: 0.4,
    orbiters: 2,
    spikes: 3,
    pulseDepth: 0.5,
    lift: 0.04,
  },
  BUILDING: {
    color: '#f97316',
    accent: '#fb923c',
    radius: 0.74,
    speed: 7.8,
    opacity: 0.38,
    orbiters: 3,
    spikes: 4,
    pulseDepth: 0.75,
    lift: 0.05,
  },
  WORKING: {
    color: '#fb923c',
    accent: '#fdba74',
    radius: 0.72,
    speed: 8.9,
    opacity: 0.38,
    orbiters: 3,
    spikes: 4,
    pulseDepth: 0.72,
    lift: 0.05,
  },
  TRADING: {
    color: '#22d3ee',
    accent: '#67e8f9',
    radius: 0.78,
    speed: 6.5,
    opacity: 0.36,
    orbiters: 4,
    spikes: 3,
    pulseDepth: 0.58,
    lift: 0.03,
  },
  FIGHTING: {
    color: '#fb7185',
    accent: '#fda4af',
    radius: 0.82,
    speed: 10.6,
    opacity: 0.45,
    orbiters: 5,
    spikes: 6,
    pulseDepth: 0.95,
    lift: 0.08,
  },
};

export function ActionAura({ state }: { state: AgentState }) {
  const config = ACTION_AURA_CONFIG[state];
  const ringRef = useRef<THREE.Mesh>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const orbiterRefs = useRef<Array<THREE.Mesh | null>>([]);
  const spikeRefs = useRef<Array<THREE.Mesh | null>>([]);
  const phaseOffsetRef = useRef(Math.random() * Math.PI * 2);

  useFrame((frameState) => {
    if (!config) return;
    const t = frameState.clock.elapsedTime;
    const phase = t * config.speed + phaseOffsetRef.current;
    const pulse = Math.sin(phase);
    if (ringRef.current) {
      ringRef.current.rotation.z = t * (0.35 + config.speed * 0.06);
      const scale = 1 + pulse * 0.12;
      ringRef.current.scale.set(scale, scale, 1);
      const material = ringRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = config.opacity + Math.sin(phase * 0.85) * 0.08;
      material.emissiveIntensity = 0.42 + Math.sin(phase * 0.9) * 0.26;
    }
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = -t * (0.28 + config.speed * 0.04);
      const outerScale = 1.02 + (Math.sin(phase * 0.7) + 1) * 0.05;
      outerRingRef.current.scale.set(outerScale, outerScale, 1);
      const outerMat = outerRingRef.current.material as THREE.MeshStandardMaterial;
      outerMat.opacity = config.opacity * 0.65 + Math.sin(phase * 0.6) * 0.06;
      outerMat.emissiveIntensity = 0.28 + (Math.sin(phase * 0.7) + 1) * 0.18;
    }
    if (pulseRef.current) {
      const burst = 0.64 + (Math.sin(phase * 0.5) + 1) * 0.2;
      pulseRef.current.scale.set(burst, burst, 1);
      const pulseMat = pulseRef.current.material as THREE.MeshBasicMaterial;
      pulseMat.opacity = 0.12 + (Math.sin(phase * 0.7) + 1) * 0.06;
    }
    if (flashRef.current) {
      const flash = Math.max(0, Math.sin(phase * 0.9));
      const flashScale = 0.78 + flash * 0.28;
      flashRef.current.scale.set(flashScale, flashScale, 1);
      const flashMat = flashRef.current.material as THREE.MeshBasicMaterial;
      flashMat.opacity = 0.08 + flash * 0.16;
    }

    for (let index = 0; index < config.orbiters; index++) {
      const orbiter = orbiterRefs.current[index];
      if (!orbiter) continue;
      const theta = phase * 0.72 + (index / config.orbiters) * Math.PI * 2;
      const orbitPulse = 1.02 + (Math.sin(phase * 0.8 + index * 0.9) + 1) * 0.05;
      const orbitRadius = config.radius * orbitPulse;
      orbiter.position.set(
        Math.cos(theta) * orbitRadius,
        0.1 + config.lift + Math.sin(phase * 1.25 + index) * 0.05,
        Math.sin(theta) * orbitRadius,
      );
      const orbiterMat = orbiter.material as THREE.MeshStandardMaterial;
      orbiterMat.opacity = 0.25 + (Math.sin(phase * 1.8 + index * 1.4) + 1) * 0.18;
      orbiterMat.emissiveIntensity = 0.25 + (Math.sin(phase * 1.45 + index) + 1) * 0.25;
    }

    for (let index = 0; index < config.spikes; index++) {
      const spike = spikeRefs.current[index];
      if (!spike) continue;
      const theta = (index / config.spikes) * Math.PI * 2 + phase * 0.15;
      const spikePulse = (Math.sin(phase * 1.35 + index * 0.95) + 1) * 0.5;
      const radial = config.radius * (0.84 + spikePulse * 0.15);
      spike.position.set(
        Math.cos(theta) * radial,
        0.2 + config.lift + spikePulse * 0.22,
        Math.sin(theta) * radial,
      );
      spike.rotation.y = -theta;
      spike.scale.y = 0.45 + spikePulse * config.pulseDepth;
      const spikeMat = spike.material as THREE.MeshStandardMaterial;
      spikeMat.opacity = 0.2 + spikePulse * 0.32;
      spikeMat.emissiveIntensity = 0.32 + spikePulse * 0.45;
    }
  });

  if (!config) return null;

  return (
    <group>
      <mesh ref={flashRef} position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[config.radius * 0.34, config.radius * 1.16, 40]} />
        <meshBasicMaterial color={config.accent} transparent opacity={0.1} depthWrite={false} />
      </mesh>
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
      <mesh ref={outerRingRef} position={[0, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[config.radius * 1.12, 0.018, 8, 42]} />
        <meshStandardMaterial
          color={config.accent}
          emissive={config.accent}
          emissiveIntensity={0.34}
          transparent
          opacity={config.opacity * 0.62}
          roughness={0.32}
          metalness={0.12}
          depthWrite={false}
        />
      </mesh>
      {Array.from({ length: config.orbiters }).map((_, index) => (
        <mesh
          key={`orbiter-${index}`}
          ref={(node) => {
            orbiterRefs.current[index] = node;
          }}
          position={[0, 0.1, 0]}
        >
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial
            color={config.accent}
            emissive={config.accent}
            emissiveIntensity={0.4}
            transparent
            opacity={0.32}
            roughness={0.2}
            metalness={0.18}
            depthWrite={false}
          />
        </mesh>
      ))}
      {Array.from({ length: config.spikes }).map((_, index) => (
        <mesh
          key={`spike-${index}`}
          ref={(node) => {
            spikeRefs.current[index] = node;
          }}
          position={[0, 0.2, 0]}
        >
          <boxGeometry args={[0.04, 0.32, 0.04]} />
          <meshStandardMaterial
            color={config.color}
            emissive={config.accent}
            emissiveIntensity={0.4}
            transparent
            opacity={0.3}
            roughness={0.3}
            metalness={0.12}
            depthWrite={false}
          />
        </mesh>
      ))}
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
  momentum = 1,
}: {
  outcome: ArenaOutcomeResult | null;
  triggeredAtMs: number | null;
  momentum?: number;
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
    const momentumBoost = THREE.MathUtils.clamp(1 + Math.max(0, momentum - 1) * 0.15, 1, 1.8);
    const pulse = 1 + life * (2.2 + (momentumBoost - 1) * 1.1) + Math.sin(t * 12.5) * (0.08 * momentumBoost);
    const lift = cfg.lift + Math.sin(t * 9.2) * 0.03 * momentumBoost;

    ringRef.current.position.y = 0.06 + lift;
    haloRef.current.position.y = 0.04 + lift * 0.7;
    ringRef.current.scale.set(pulse, pulse, 1);
    haloRef.current.scale.set(pulse * 0.88, pulse * 0.88, 1);

    const ringMat = ringRef.current.material as THREE.MeshStandardMaterial;
    ringMat.opacity = cfg.baseOpacity * fade;
    ringMat.emissiveIntensity = cfg.emissive * fade * momentumBoost;

    const haloMat = haloRef.current.material as THREE.MeshBasicMaterial;
    haloMat.opacity = (cfg.baseOpacity * 0.5) * fade * Math.min(1.25, momentumBoost);
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
