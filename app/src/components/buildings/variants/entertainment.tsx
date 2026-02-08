import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { type BuildingVariantProps, BuildingWindows } from '../shared';

// Variant 0: Ringed arena (box + torus) — original
function RingedArena({ plot, h, main, accent, selected }: BuildingVariantProps) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[3.6, h, 3.0]} />
        <meshStandardMaterial color={main} emissive={selected ? accent.clone().multiplyScalar(0.3) : undefined} />
      </mesh>
      <mesh castShadow position={[0, h + 0.35, 0]}>
        <torusGeometry args={[1.4, 0.18, 12, 28]} />
        <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.35)} />
      </mesh>
      <BuildingWindows height={h} zone={plot.zone} plotId={plot.id} />
    </group>
  );
}

// Variant 1: Theater (box + marquee awning + star)
function Theater({ plot, h, main, accent, selected }: BuildingVariantProps) {
  const emissive = selected ? accent.clone().multiplyScalar(0.3) : undefined;
  const starRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (starRef.current) {
      starRef.current.rotation.y = state.clock.elapsedTime * 0.8;
    }
  });

  return (
    <group>
      {/* Main body */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[3.6, h, 3.2]} />
        <meshStandardMaterial color={main} emissive={emissive} />
      </mesh>
      {/* Marquee (angled awning) */}
      <mesh position={[0, h * 0.55, 1.8]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[3.2, 0.08, 1.2]} />
        <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.3)} />
      </mesh>
      {/* Marquee edge lights (simplified as a glowing strip) */}
      <mesh position={[0, h * 0.5, 2.2]}>
        <boxGeometry args={[3.0, 0.12, 0.05]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} />
      </mesh>
      {/* Rotating star on top */}
      <mesh ref={starRef} castShadow position={[0, h + 0.7, 0]}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.5)} />
      </mesh>
      {/* Double doors */}
      <mesh position={[-0.35, 0.6, 1.61]}>
        <boxGeometry args={[0.6, 1.2, 0.04]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0.35, 0.6, 1.61]}>
        <boxGeometry args={[0.6, 1.2, 0.04]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <BuildingWindows height={h} zone={plot.zone} plotId={plot.id} />
    </group>
  );
}

// Variant 2: Casino/club (box + neon crown + glow band)
function Casino({ plot, h, main, accent, selected }: BuildingVariantProps) {
  const emissive = selected ? accent.clone().multiplyScalar(0.3) : undefined;
  const crownRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (crownRef.current) {
      crownRef.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <group>
      {/* Main body */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[3.4, h, 3.4]} />
        <meshStandardMaterial color={main} emissive={emissive} />
      </mesh>
      {/* Glow band around mid-section */}
      <mesh position={[0, h * 0.5, 0]}>
        <boxGeometry args={[3.5, 0.15, 3.5]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.7}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Second glow band */}
      <mesh position={[0, h * 0.75, 0]}>
        <boxGeometry args={[3.5, 0.1, 3.5]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.5}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Neon crown (3 points) */}
      <group ref={crownRef} position={[0, h + 0.2, 0]}>
        {[0, 1, 2, 3, 4].map((i) => {
          const angle = (i / 5) * Math.PI * 2;
          const pointH = i % 2 === 0 ? 0.7 : 0.4;
          return (
            <mesh key={i} position={[Math.cos(angle) * 1.0, pointH / 2, Math.sin(angle) * 1.0]}>
              <boxGeometry args={[0.15, pointH, 0.15]} />
              <meshStandardMaterial
                color={accent}
                emissive={accent}
                emissiveIntensity={0.8}
              />
            </mesh>
          );
        })}
        {/* Crown connecting ring */}
        <mesh position={[0, 0.05, 0]}>
          <torusGeometry args={[1.0, 0.06, 8, 20]} />
          <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.5)} />
        </mesh>
      </group>
      <BuildingWindows height={h} zone={plot.zone} plotId={plot.id} />
    </group>
  );
}

export function EntertainmentBuilding(props: BuildingVariantProps) {
  switch (props.variant) {
    case 1: return <Theater {...props} />;
    case 2: return <Casino {...props} />;
    default: return <RingedArena {...props} />;
  }
}
