import { useRef, useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  type Plot,
  buildHeight,
  getTargetProgress,
  getVariant,
  getColors,
} from './shared';
import { ConstructionRenderer } from './constructionStages';
import { GLBBuilding } from './GLBBuilding';
import { IndustrialSmoke } from './effects';

// Fallback for when GLB hasn't loaded yet — simple glowing box
function BuildingFallback({
  h,
  main,
  accent,
  selected,
}: {
  h: number;
  main: THREE.Color;
  accent: THREE.Color;
  selected: boolean;
}) {
  return (
    <mesh position={[0, h / 2, 0]}>
      <boxGeometry args={[8, h, 8]} />
      <meshStandardMaterial
        color={main}
        emissive={selected ? accent.clone().multiplyScalar(0.25) : undefined}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}

// Zone-specific effects overlay (smoke, glow, spinning elements)
function ZoneEffects({ plot, h }: { plot: Plot; h: number }) {
  const neonBandRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const holoRingRef = useRef<THREE.Mesh>(null);
  const civicBeaconRef = useRef<THREE.Mesh>(null);
  const residentialGlowRef = useRef<THREE.Mesh>(null);
  const motionPhase = useMemo(() => {
    let hash = 2166136261;
    for (let index = 0; index < plot.id.length; index++) {
      hash ^= plot.id.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) * 0.000001;
  }, [plot.id]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime + motionPhase;

    if (neonBandRef.current) {
      neonBandRef.current.rotation.y += dt * 0.2;
      const material = neonBandRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.45 + Math.sin(t * 3.2) * 0.18;
      material.opacity = 0.62 + Math.sin(t * 2.4) * 0.2;
    }

    if (haloRef.current) {
      haloRef.current.rotation.y += dt * 0.7;
      haloRef.current.position.y = h * 0.72 + Math.sin(t * 2.2) * 0.12;
      const pulse = 1 + Math.sin(t * 2.1) * 0.08;
      haloRef.current.scale.set(pulse, 1, pulse);
      const material = haloRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = 0.28 + Math.sin(t * 2.8) * 0.1;
      material.emissiveIntensity = 0.55 + Math.sin(t * 2.8) * 0.2;
    }

    if (holoRingRef.current) {
      holoRingRef.current.rotation.y -= dt * 0.8;
      holoRingRef.current.position.y = h * 0.64 + Math.sin(t * 2) * 0.09;
      const pulse = 1 + Math.sin(t * 1.9) * 0.06;
      holoRingRef.current.scale.set(pulse, 1, pulse);
      const material = holoRingRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = 0.22 + Math.sin(t * 2.5) * 0.1;
      material.emissiveIntensity = 0.4 + Math.sin(t * 2.5) * 0.15;
    }

    if (civicBeaconRef.current) {
      civicBeaconRef.current.rotation.y += dt * 0.45;
      civicBeaconRef.current.position.y = h * 0.7 + Math.sin(t * 1.7) * 0.08;
      const material = civicBeaconRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = 0.2 + Math.sin(t * 2.1) * 0.08;
      material.emissiveIntensity = 0.38 + Math.sin(t * 2.1) * 0.12;
    }

    if (residentialGlowRef.current) {
      residentialGlowRef.current.rotation.y += dt * 0.35;
      const material = residentialGlowRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = 0.18 + Math.sin(t * 1.6) * 0.06;
      material.emissiveIntensity = 0.22 + Math.sin(t * 1.6) * 0.08;
    }
  });

  if (plot.zone === 'INDUSTRIAL') {
    return (
      <group>
        <IndustrialSmoke position={[3.5, h * 1.1, -1.5]} intensity={1.0} />
        <mesh ref={civicBeaconRef} position={[0, h * 0.72, 0]}>
          <cylinderGeometry args={[0.45, 0.85, 0.12, 18]} />
          <meshStandardMaterial
            color="#f97316"
            emissive="#f97316"
            emissiveIntensity={0.35}
            transparent
            opacity={0.18}
          />
        </mesh>
      </group>
    );
  }
  if (plot.zone === 'COMMERCIAL') {
    return (
      <group>
        <mesh ref={holoRingRef} position={[0, h * 0.64, 0]}>
          <torusGeometry args={[6.1, 0.08, 8, 42]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#38bdf8"
            emissiveIntensity={0.4}
            transparent
            opacity={0.25}
          />
        </mesh>
      </group>
    );
  }
  if (plot.zone === 'CIVIC') {
    return (
      <group>
        <mesh ref={civicBeaconRef} position={[0, h * 0.7, 0]}>
          <cylinderGeometry args={[0.5, 0.9, 0.12, 24]} />
          <meshStandardMaterial
            color="#f8fafc"
            emissive="#e2e8f0"
            emissiveIntensity={0.38}
            transparent
            opacity={0.2}
          />
        </mesh>
      </group>
    );
  }
  if (plot.zone === 'RESIDENTIAL') {
    return (
      <group>
        <mesh ref={residentialGlowRef} position={[0, h * 0.56, 0]}>
          <ringGeometry args={[4.8, 5.4, 26]} />
          <meshStandardMaterial
            color="#fb7185"
            emissive="#fb7185"
            emissiveIntensity={0.22}
            transparent
            opacity={0.16}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    );
  }
  if (plot.zone === 'ENTERTAINMENT') {
    return (
      <group>
        {/* Neon glow band */}
        <mesh ref={neonBandRef} position={[0, h * 0.5, 0]}>
          <boxGeometry args={[10, 0.2, 10]} />
          <meshStandardMaterial
            color={'#ff4fd8'}
            emissive={'#ff4fd8'}
            emissiveIntensity={0.5}
            transparent
            opacity={0.7}
          />
        </mesh>
        <mesh ref={haloRef} position={[0, h * 0.72, 0]}>
          <torusGeometry args={[6.2, 0.1, 8, 40]} />
          <meshStandardMaterial
            color="#f472b6"
            emissive="#f472b6"
            emissiveIntensity={0.55}
            transparent
            opacity={0.28}
          />
        </mesh>
      </group>
    );
  }
  return null;
}

export function BuildingMesh({
  plot,
  position,
  selected,
}: {
  plot: Plot;
  position: [number, number, number];
  selected: boolean;
}) {
  const h = buildHeight(plot);
  const variant = getVariant(plot.id);
  // Memoize colors so THREE.Color refs are stable across re-renders
  const { tint, main, accent } = useMemo(() => getColors(plot, selected), [plot, selected]);

  const target = getTargetProgress(plot);
  const progressRef = useRef(target);
  const prevStageRef = useRef(Math.floor(target));
  const groupRef = useRef<THREE.Group>(null);
  const pulseRef = useRef(0);

  useFrame((_, delta) => {
    const current = progressRef.current;
    const targetNow = getTargetProgress(plot);

    if (Math.abs(current - targetNow) > 0.001) {
      progressRef.current = current + (targetNow - current) * Math.min(1, delta * 2.0);
    } else {
      progressRef.current = targetNow;
    }

    const currentStage = Math.floor(progressRef.current);
    if (currentStage > prevStageRef.current) {
      pulseRef.current = 0.4;
    }
    prevStageRef.current = currentStage;

    if (groupRef.current) {
      if (pulseRef.current > 0) {
        pulseRef.current = Math.max(0, pulseRef.current - delta);
        const t = 1 - pulseRef.current / 0.4;
        const pulse = 1 + 0.06 * Math.sin(t * Math.PI);
        groupRef.current.scale.setScalar(pulse);
      } else {
        groupRef.current.scale.setScalar(1);
      }
    }
  });

  const isComplete = plot.status === 'BUILT' && progressRef.current >= 3.99;

  if (isComplete) {
    return (
      <group ref={groupRef} position={position}>
        <Suspense fallback={<BuildingFallback h={h} main={main} accent={accent} selected={selected} />}>
          <GLBBuilding
            zone={plot.zone}
            variant={variant}
            plotId={plot.id}
            targetHeight={h}
            main={main}
            accent={accent}
            selected={selected}
          />
        </Suspense>
        <ZoneEffects plot={plot} h={h} />
      </group>
    );
  }

  // Under construction — procedural construction stages
  return (
    <group ref={groupRef} position={position}>
      <ConstructionRenderer
        plot={plot}
        h={h}
        tint={tint}
        accent={accent}
        selected={selected}
        progressRef={progressRef}
      />
    </group>
  );
}
