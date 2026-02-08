import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// SHARK: Dorsal fin on head + shoulder pauldrons
export function SharkAccessories({ color }: { color: string }) {
  return (
    <group>
      {/* Dorsal fin on top of head */}
      <mesh position={[0, 2.35, -0.1]} rotation={[0.2, 0, 0]}>
        <coneGeometry args={[0.18, 0.5, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      {/* Left shoulder pauldron */}
      <mesh position={[-0.62, 1.35, 0]}>
        <sphereGeometry args={[0.18, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Right shoulder pauldron */}
      <mesh position={[0.62, 1.35, 0]}>
        <sphereGeometry args={[0.18, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

// ROCK: Flat-top helmet + side shield plate
export function RockAccessories({ color }: { color: string }) {
  return (
    <group>
      {/* Flat-top helmet */}
      <mesh position={[0, 2.15, 0.02]}>
        <cylinderGeometry args={[0.42, 0.44, 0.25, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Helmet rim */}
      <mesh position={[0, 2.05, 0.02]}>
        <cylinderGeometry args={[0.48, 0.48, 0.06, 12]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Side shield */}
      <mesh position={[-0.65, 1.05, 0.15]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.08, 0.6, 0.5]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

// CHAMELEON: Twin antennae with glowing tips
export function ChameleonAccessories({ color }: { color: string }) {
  const tipLRef = useRef<THREE.Mesh>(null);
  const tipRRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (tipLRef.current) {
      (tipLRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + Math.sin(t * 3) * 0.3;
    }
    if (tipRRef.current) {
      (tipRRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + Math.sin(t * 3 + 1.5) * 0.3;
    }
  });

  return (
    <group>
      {/* Left antenna stalk */}
      <mesh position={[-0.15, 2.35, 0.05]} rotation={[0.15, 0, -0.25]}>
        <cylinderGeometry args={[0.025, 0.03, 0.5, 6]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      {/* Left antenna tip */}
      <mesh ref={tipLRef} position={[-0.27, 2.6, 0.08]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      {/* Right antenna stalk */}
      <mesh position={[0.15, 2.35, 0.05]} rotation={[0.15, 0, 0.25]}>
        <cylinderGeometry args={[0.025, 0.03, 0.5, 6]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      {/* Right antenna tip */}
      <mesh ref={tipRRef} position={[0.27, 2.6, 0.08]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// DEGEN: Party hat (cone) + bling necklace (torus)
export function DegenAccessories({ color }: { color: string }) {
  return (
    <group>
      {/* Party hat */}
      <mesh position={[0, 2.35, 0]} rotation={[0, 0, 0.1]}>
        <coneGeometry args={[0.22, 0.55, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      {/* Hat band */}
      <mesh position={[0, 2.2, 0]}>
        <torusGeometry args={[0.2, 0.03, 8, 16]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
      </mesh>
      {/* Bling necklace */}
      <mesh position={[0, 1.45, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.35, 0.04, 8, 20]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

// GRINDER: HUD visor (glowing bar) + backpack box
export function GrinderAccessories({ color }: { color: string }) {
  const visorRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (visorRef.current) {
      const t = state.clock.elapsedTime;
      (visorRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.2;
    }
  });

  return (
    <group>
      {/* HUD visor bar across eyes */}
      <mesh ref={visorRef} position={[0, 1.95, 0.4]}>
        <boxGeometry args={[0.5, 0.1, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
      </mesh>
      {/* Visor side frames */}
      <mesh position={[-0.28, 1.95, 0.35]}>
        <boxGeometry args={[0.04, 0.14, 0.1]} />
        <meshStandardMaterial color="#334155" metalness={0.5} />
      </mesh>
      <mesh position={[0.28, 1.95, 0.35]}>
        <boxGeometry args={[0.04, 0.14, 0.1]} />
        <meshStandardMaterial color="#334155" metalness={0.5} />
      </mesh>
      {/* Backpack */}
      <mesh position={[0, 1.1, -0.45]}>
        <boxGeometry args={[0.5, 0.6, 0.3]} />
        <meshStandardMaterial color="#334155" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Backpack detail */}
      <mesh position={[0, 1.2, -0.62]}>
        <boxGeometry args={[0.25, 0.15, 0.04]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

export function ArchetypeAccessories({ archetype, color }: { archetype: string; color: string }) {
  switch (archetype) {
    case 'SHARK': return <SharkAccessories color={color} />;
    case 'ROCK': return <RockAccessories color={color} />;
    case 'CHAMELEON': return <ChameleonAccessories color={color} />;
    case 'DEGEN': return <DegenAccessories color={color} />;
    case 'GRINDER': return <GrinderAccessories color={color} />;
    default: return null;
  }
}
