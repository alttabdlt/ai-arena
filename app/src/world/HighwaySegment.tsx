/**
 * HighwaySegment.tsx — Wide highway road mesh connecting two towns.
 * Darker, wider material than town roads with lane markings.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { HIGHWAY_WIDTH } from './worldLayout';

interface HighwaySegmentProps {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
}

export function HighwaySegment({ fromX, fromZ, toX, toZ }: HighwaySegmentProps) {
  const { position, rotation, length } = useMemo(() => {
    const cx = (fromX + toX) / 2;
    const cz = (fromZ + toZ) / 2;
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const len = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dx, dz);
    return {
      position: [cx, 0.005, cz] as [number, number, number],
      rotation: [0, -angle, 0] as [number, number, number],
      length: len,
    };
  }, [fromX, fromZ, toX, toZ]);

  // Lane stripe positions (center dashed line)
  const stripes = useMemo(() => {
    const count = Math.floor(length / 6);
    const items: Array<{ offset: number }> = [];
    for (let i = 0; i < count; i++) {
      items.push({ offset: (i - count / 2 + 0.5) * 6 });
    }
    return items;
  }, [length]);

  return (
    <group position={position} rotation={new THREE.Euler(...rotation)}>
      {/* Road surface */}
      <mesh receiveShadow>
        <boxGeometry args={[HIGHWAY_WIDTH, 0.06, length]} />
        <meshStandardMaterial color="#060b15" roughness={0.95} />
      </mesh>

      {/* Center dashed line */}
      {stripes.map((s, i) => (
        <mesh key={i} position={[0, 0.04, s.offset]}>
          <boxGeometry args={[0.15, 0.02, 3]} />
          <meshStandardMaterial color="#1e293b" emissive="#1e293b" emissiveIntensity={0.3} roughness={0.8} />
        </mesh>
      ))}

      {/* Edge lines */}
      <mesh position={[HIGHWAY_WIDTH / 2 - 0.2, 0.04, 0]}>
        <boxGeometry args={[0.1, 0.02, length]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
      <mesh position={[-HIGHWAY_WIDTH / 2 + 0.2, 0.04, 0]}>
        <boxGeometry args={[0.1, 0.02, length]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
    </group>
  );
}
