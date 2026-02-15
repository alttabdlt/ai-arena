import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import type { ResolvedVisualQuality, VisualProfile } from './townVisualTuning';

type Weather = 'clear' | 'rain' | 'storm';
type Sentiment = 'bull' | 'bear' | 'neutral';

type CoinBurstItem = { id: string; position: [number, number, number]; isBuy: boolean };
type DeathEffectItem = { id: string; position: [number, number, number] };
type SpawnEffectItem = { id: string; position: [number, number, number]; color: string };

interface WorldFxLayerProps {
  weather: Weather;
  economicState: { pollution: number; prosperity: number; sentiment: Sentiment };
  visualProfile: VisualProfile;
  visualQuality: ResolvedVisualQuality;
  postFxEnabled: boolean;
  coinBursts: CoinBurstItem[];
  deathEffects: DeathEffectItem[];
  spawnEffects: SpawnEffectItem[];
  onCoinBurstComplete: (id: string) => void;
  onDeathEffectComplete: (id: string) => void;
  onSpawnEffectComplete: (id: string) => void;
}

function AmbientParticles({ count = 50 }: { count?: number }) {
  const particlesRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      arr[index * 3] = (Math.random() - 0.5) * 200;
      arr[index * 3 + 1] = Math.random() * 30 + 3;
      arr[index * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!particlesRef.current) return;
    const particlePositions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    const elapsed = state.clock.elapsedTime;
    for (let index = 0; index < count; index++) {
      particlePositions[index * 3 + 1] += Math.sin(elapsed + index) * 0.002;
      particlePositions[index * 3] += Math.cos(elapsed * 0.5 + index) * 0.001;
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points key={`ambient-${count}`} ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          key={`ambient-attr-${count}`}
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#94a3b8" size={0.15} transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

function DayNightCycle({ timeScale = 0.02 }: { timeScale?: number }) {
  const sunRef = useRef<THREE.DirectionalLight>(null);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime * timeScale;
    const angle = elapsed % (Math.PI * 2);

    const x = Math.cos(angle) * 100;
    const y = Math.sin(angle) * 80 + 20;
    const z = Math.sin(angle * 0.5) * 60;

    if (sunRef.current) {
      sunRef.current.position.set(x, Math.max(y, 5), z);
      const dayFactor = Math.max(0, Math.min(1, (y + 10) / 50));
      sunRef.current.intensity = 0.3 + dayFactor * 0.9;
    }
  });

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[1, 1, 0]}
        turbidity={10}
        rayleigh={1.8}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      <directionalLight
        ref={sunRef}
        position={[1, 1, 0]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
      />
    </>
  );
}

function RainEffect({ intensity = 200 }: { intensity?: number }) {
  const rainRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(intensity * 3);
    for (let index = 0; index < intensity; index++) {
      arr[index * 3] = (Math.random() - 0.5) * 250;
      arr[index * 3 + 1] = Math.random() * 50 + 10;
      arr[index * 3 + 2] = (Math.random() - 0.5) * 250;
    }
    return arr;
  }, [intensity]);

  useFrame(() => {
    if (!rainRef.current) return;
    const rainPositions = rainRef.current.geometry.attributes.position.array as Float32Array;
    for (let index = 0; index < intensity; index++) {
      rainPositions[index * 3 + 1] -= 0.8;
      if (rainPositions[index * 3 + 1] < 0) {
        rainPositions[index * 3 + 1] = 50 + Math.random() * 15;
        rainPositions[index * 3] = (Math.random() - 0.5) * 250;
        rainPositions[index * 3 + 2] = (Math.random() - 0.5) * 250;
      }
    }
    rainRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points key={`rain-${intensity}`} ref={rainRef}>
      <bufferGeometry>
        <bufferAttribute
          key={`rain-attr-${intensity}`}
          attach="attributes-position"
          array={positions}
          count={intensity}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#a8c8e8"
        size={0.1}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

function CoinBurst({
  position,
  isBuy,
  onComplete,
}: {
  position: [number, number, number];
  isBuy: boolean;
  onComplete?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coinsRef = useRef<{ pos: THREE.Vector3; vel: THREE.Vector3; rot: number }[]>([]);
  const [alive, setAlive] = useState(true);
  const startTime = useRef(Date.now());

  useEffect(() => {
    coinsRef.current = Array.from({ length: 8 }, () => ({
      pos: new THREE.Vector3(0, 0, 0),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 4 + 2,
        (Math.random() - 0.5) * 3,
      ),
      rot: Math.random() * Math.PI * 2,
    }));
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current || !alive) return;

    const elapsed = (Date.now() - startTime.current) / 1000;
    if (elapsed > 1.5) {
      setAlive(false);
      onComplete?.();
      return;
    }

    const children = groupRef.current.children as THREE.Mesh[];
    coinsRef.current.forEach((coin, index) => {
      coin.vel.y -= delta * 10;
      coin.pos.add(coin.vel.clone().multiplyScalar(delta));
      coin.rot += delta * 8;

      if (children[index]) {
        children[index].position.copy(coin.pos);
        children[index].rotation.y = coin.rot;
        const fade = Math.max(0, 1 - elapsed / 1.5);
        (children[index].material as THREE.MeshStandardMaterial).opacity = fade;
      }
    });
  });

  if (!alive) return null;

  return (
    <group ref={groupRef} position={position}>
      {Array.from({ length: 8 }).map((_, index) => (
        <mesh key={index}>
          <cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />
          <meshStandardMaterial
            color={isBuy ? '#fbbf24' : '#ef4444'}
            emissive={isBuy ? '#fbbf24' : '#ef4444'}
            emissiveIntensity={0.5}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function DeathSmoke({ position, onComplete }: { position: [number, number, number]; onComplete?: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const smokesRef = useRef<{ pos: THREE.Vector3; scale: number; opacity: number }[]>([]);
  const [alive, setAlive] = useState(true);
  const startTime = useRef(Date.now());

  useEffect(() => {
    smokesRef.current = Array.from({ length: 6 }, (_, index) => ({
      pos: new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        index * 0.3,
        (Math.random() - 0.5) * 0.5,
      ),
      scale: 0.3 + Math.random() * 0.3,
      opacity: 0.8,
    }));
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current || !alive) return;

    const elapsed = (Date.now() - startTime.current) / 1000;
    if (elapsed > 2) {
      setAlive(false);
      onComplete?.();
      return;
    }

    const children = groupRef.current.children as THREE.Mesh[];
    smokesRef.current.forEach((smoke, index) => {
      smoke.pos.y += delta * 1.5;
      smoke.scale += delta * 0.5;
      smoke.opacity = Math.max(0, 0.8 - elapsed / 2);

      if (children[index]) {
        children[index].position.copy(smoke.pos);
        children[index].scale.setScalar(smoke.scale);
        (children[index].material as THREE.MeshStandardMaterial).opacity = smoke.opacity;
      }
    });
  });

  if (!alive) return null;

  return (
    <group ref={groupRef} position={position}>
      {Array.from({ length: 6 }).map((_, index) => (
        <mesh key={index}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshStandardMaterial color="#4b5563" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function SpawnSparkle({
  position,
  color,
  onComplete,
}: {
  position: [number, number, number];
  color: string;
  onComplete?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [alive, setAlive] = useState(true);
  const startTime = useRef(Date.now());

  useFrame(() => {
    if (!groupRef.current || !alive) return;

    const elapsed = (Date.now() - startTime.current) / 1000;
    if (elapsed > 1) {
      setAlive(false);
      onComplete?.();
      return;
    }

    groupRef.current.scale.setScalar(1 + elapsed * 3);
    groupRef.current.children.forEach((child, index) => {
      const mesh = child as THREE.Mesh;
      (mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - elapsed);
      mesh.rotation.y = elapsed * 5 + index * 0.5;
    });
  });

  if (!alive) return null;

  return (
    <group ref={groupRef} position={position}>
      {Array.from({ length: 8 }).map((_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(angle) * 0.5, 0.5, Math.sin(angle) * 0.5]}>
            <boxGeometry args={[0.1, 0.3, 0.1]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent />
          </mesh>
        );
      })}
    </group>
  );
}

function SmogLayer({ pollution }: { pollution: number }) {
  if (pollution < 0.3) return null;

  const opacity = (pollution - 0.3) * 0.4;

  return (
    <mesh position={[0, 35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[500, 500]} />
      <meshBasicMaterial color="#3d3825" transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  );
}

function SentimentAmbience({ sentiment }: { sentiment: Sentiment }) {
  const color = sentiment === 'bull' ? '#1a2f1a' : sentiment === 'bear' ? '#2f1a1a' : '#1a1a2f';
  const intensity = sentiment === 'neutral' ? 0 : 0.15;

  return (
    <mesh position={[0, 60, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[600, 600]} />
      <meshBasicMaterial color={color} transparent opacity={intensity} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ProsperitySparkles({ prosperity }: { prosperity: number }) {
  const sparklesRef = useRef<THREE.Points>(null);
  const count = Math.floor(prosperity * 30);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      arr[index * 3] = (Math.random() - 0.5) * 150;
      arr[index * 3 + 1] = Math.random() * 20 + 3;
      arr[index * 3 + 2] = (Math.random() - 0.5) * 150;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!sparklesRef.current || count === 0) return;
    sparklesRef.current.rotation.y = state.clock.elapsedTime * 0.05;
  });

  if (count === 0) return null;

  return (
    <points key={`sparkles-${count}`} ref={sparklesRef}>
      <bufferGeometry>
        <bufferAttribute
          key={`sparkles-attr-${count}`}
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#fbbf24" size={0.2} transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

function TownPostProcessing({
  enabled,
  quality,
  profile,
}: {
  enabled: boolean;
  quality: ResolvedVisualQuality;
  profile: VisualProfile;
}) {
  if (!enabled || quality === 'low') return null;

  const accent = quality === 'high' ? '#8ec5ff' : '#79b4f4';
  const hazeOpacity = Math.min(0.18, profile.noiseOpacity + profile.bloomIntensity * 0.12);
  const vignetteOpacity = Math.min(0.2, 0.05 + (0.4 - profile.vignetteOffset) * 0.35);

  return (
    <group>
      <pointLight
        position={[0, 18, 0]}
        intensity={0.35 + profile.bloomIntensity * 0.55}
        distance={90}
        color={accent}
      />
      <mesh position={[0, 42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[740, 740]} />
        <meshBasicMaterial color={accent} transparent opacity={hazeOpacity} />
      </mesh>
      <mesh position={[0, 46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[260, 380, 64]} />
        <meshBasicMaterial color="#030712" transparent opacity={vignetteOpacity} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function WorldFxLayer({
  weather,
  economicState,
  visualProfile,
  visualQuality,
  postFxEnabled,
  coinBursts,
  deathEffects,
  spawnEffects,
  onCoinBurstComplete,
  onDeathEffectComplete,
  onSpawnEffectComplete,
}: WorldFxLayerProps) {
  return (
    <>
      <DayNightCycle timeScale={0.015} />
      <AmbientParticles count={visualProfile.ambientParticleCount} />
      <SmogLayer pollution={economicState.pollution} />
      <SentimentAmbience sentiment={economicState.sentiment} />
      <ProsperitySparkles prosperity={economicState.prosperity} />
      {weather === 'rain' && <RainEffect intensity={Math.floor(80 * visualProfile.rainScale)} />}
      {weather === 'storm' && <RainEffect intensity={Math.floor(200 * visualProfile.rainScale)} />}

      {coinBursts.map((burst) => (
        <CoinBurst
          key={burst.id}
          position={burst.position}
          isBuy={burst.isBuy}
          onComplete={() => onCoinBurstComplete(burst.id)}
        />
      ))}
      {deathEffects.map((effect) => (
        <DeathSmoke
          key={effect.id}
          position={effect.position}
          onComplete={() => onDeathEffectComplete(effect.id)}
        />
      ))}
      {spawnEffects.map((effect) => (
        <SpawnSparkle
          key={effect.id}
          position={effect.position}
          color={effect.color}
          onComplete={() => onSpawnEffectComplete(effect.id)}
        />
      ))}

      <TownPostProcessing enabled={postFxEnabled} quality={visualQuality} profile={visualProfile} />
    </>
  );
}
