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
    <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
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
  if (plot.zone === 'INDUSTRIAL') {
    return <IndustrialSmoke position={[3.5, h * 1.1, -1.5]} intensity={1.0} />;
  }
  if (plot.zone === 'ENTERTAINMENT') {
    return (
      <group>
        {/* Neon glow band */}
        <mesh position={[0, h * 0.5, 0]}>
          <boxGeometry args={[10, 0.2, 10]} />
          <meshStandardMaterial
            color={'#ff4fd8'}
            emissive={'#ff4fd8'}
            emissiveIntensity={0.5}
            transparent
            opacity={0.7}
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
  const { tint, main, accent } = useMemo(() => getColors(plot, selected), [plot.zone, selected]);

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
