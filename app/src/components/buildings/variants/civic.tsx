import * as THREE from 'three';
import { type BuildingVariantProps } from '../shared';

// Variant 0: Columned hall (box + 2 columns) — original
function ColumnedHall({ plot, h, main, accent, selected }: BuildingVariantProps) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[3.8, h, 3.4]} />
        <meshStandardMaterial color={main} emissive={selected ? accent.clone().multiplyScalar(0.25) : undefined} />
      </mesh>
      <mesh castShadow position={[-1.3, h * 0.45, 1.3]}>
        <cylinderGeometry args={[0.2, 0.2, h * 0.9, 10]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <mesh castShadow position={[1.3, h * 0.45, 1.3]}>
        <cylinderGeometry args={[0.2, 0.2, h * 0.9, 10]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
    </group>
  );
}

// Variant 1: Clock tower (main box + central tower + sphere clock)
function ClockTower({ plot, h, main, accent, selected }: BuildingVariantProps) {
  const emissive = selected ? accent.clone().multiplyScalar(0.25) : undefined;
  const towerH = h * 0.8;
  return (
    <group>
      {/* Main building base */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[3.4, h, 3.4]} />
        <meshStandardMaterial color={main} emissive={emissive} />
      </mesh>
      {/* Central tower rising above */}
      <mesh castShadow position={[0, h + towerH / 2, 0]}>
        <boxGeometry args={[1.4, towerH, 1.4]} />
        <meshStandardMaterial color={main.clone().multiplyScalar(0.85)} emissive={emissive} />
      </mesh>
      {/* Tower cap */}
      <mesh position={[0, h + towerH + 0.15, 0]}>
        <boxGeometry args={[1.7, 0.15, 1.7]} />
        <meshStandardMaterial color={accent.clone().multiplyScalar(0.6)} />
      </mesh>
      {/* Clock sphere */}
      <mesh position={[0, h + towerH * 0.6, 0.75]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.4)} />
      </mesh>
      {/* Column accents at front */}
      {[-1.2, 1.2].map((x, i) => (
        <mesh key={i} castShadow position={[x, h * 0.45, 1.5]}>
          <cylinderGeometry args={[0.15, 0.15, h * 0.9, 8]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
      ))}
    </group>
  );
}

// Variant 2: Domed building (box + half-sphere dome + 4 pilasters)
function DomedBuilding({ plot, h, main, accent, selected }: BuildingVariantProps) {
  const emissive = selected ? accent.clone().multiplyScalar(0.25) : undefined;
  return (
    <group>
      {/* Main body */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[3.6, h, 3.6]} />
        <meshStandardMaterial color={main} emissive={emissive} />
      </mesh>
      {/* Dome (half-sphere) */}
      <mesh castShadow position={[0, h, 0]}>
        <sphereGeometry args={[1.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.2)} />
      </mesh>
      {/* 4 pilasters at corners */}
      {[[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]].map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, h * 0.5, z]}>
          <boxGeometry args={[0.3, h, 0.3]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
      ))}
      {/* Dome finial */}
      <mesh position={[0, h + 1.5, 0]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.5)} />
      </mesh>
    </group>
  );
}

export function CivicBuilding(props: BuildingVariantProps) {
  switch (props.variant) {
    case 1: return <ClockTower {...props} />;
    case 2: return <DomedBuilding {...props} />;
    default: return <ColumnedHall {...props} />;
  }
}
