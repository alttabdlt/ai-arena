import * as THREE from 'three';
import { type BuildingVariantProps, BuildingWindows } from '../shared';

// Variant 0: Shopfront (box + sign) — original
function Shopfront({ plot, h, main, accent, selected }: BuildingVariantProps) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[3.4, h, 3.4]} />
        <meshStandardMaterial color={main} emissive={selected ? accent.clone().multiplyScalar(0.25) : undefined} />
      </mesh>
      {/* Shop sign */}
      <mesh castShadow position={[0, h * 0.65, 1.8]}>
        <boxGeometry args={[2.2, 0.5, 0.15]} />
        <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.35)} />
      </mesh>
    </group>
  );
}

// Variant 1: Corner store (L-shaped + awning)
function CornerStore({ plot, h, main, accent, selected }: BuildingVariantProps) {
  const emissive = selected ? accent.clone().multiplyScalar(0.25) : undefined;
  return (
    <group>
      {/* Main wing */}
      <mesh castShadow receiveShadow position={[-0.5, h / 2, 0]}>
        <boxGeometry args={[2.6, h, 3.4]} />
        <meshStandardMaterial color={main} emissive={emissive} />
      </mesh>
      {/* Side wing (L-shape) */}
      <mesh castShadow receiveShadow position={[0.8, h * 0.4, -0.8]}>
        <boxGeometry args={[2.0, h * 0.8, 1.8]} />
        <meshStandardMaterial color={main.clone().multiplyScalar(0.9)} emissive={emissive} />
      </mesh>
      {/* Awning over entrance */}
      <mesh position={[-0.5, h * 0.45, 1.85]}>
        <boxGeometry args={[2.8, 0.06, 0.9]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      {/* Awning front edge (angled) */}
      <mesh position={[-0.5, h * 0.42, 2.25]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[2.8, 0.04, 0.15]} />
        <meshStandardMaterial color={accent.clone().multiplyScalar(0.7)} />
      </mesh>
      {/* Door */}
      <mesh position={[-0.5, 0.55, 1.71]}>
        <boxGeometry args={[0.7, 1.1, 0.04]} />
        <meshStandardMaterial color="#1e293b" emissive={accent.clone().multiplyScalar(0.15)} />
      </mesh>
      <BuildingWindows height={h} zone={plot.zone} plotId={plot.id} />
    </group>
  );
}

// Variant 2: Office block (wide box + rooftop antenna + loading dock)
function OfficeBlock({ plot, h, main, accent, selected }: BuildingVariantProps) {
  const emissive = selected ? accent.clone().multiplyScalar(0.25) : undefined;
  return (
    <group>
      {/* Wide main body */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[3.8, h, 3.0]} />
        <meshStandardMaterial color={main} emissive={emissive} />
      </mesh>
      {/* Rooftop antenna */}
      <mesh position={[1.2, h + 0.8, -0.8]}>
        <cylinderGeometry args={[0.04, 0.04, 1.6, 6]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} />
      </mesh>
      {/* Antenna tip */}
      <mesh position={[1.2, h + 1.65, -0.8]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} />
      </mesh>
      {/* Loading dock (back) */}
      <mesh position={[0, 0.3, -1.7]}>
        <boxGeometry args={[2.0, 0.6, 0.5]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* Dock door */}
      <mesh position={[0, 0.55, -1.5]}>
        <boxGeometry args={[1.4, 0.9, 0.04]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <BuildingWindows height={h} zone={plot.zone} plotId={plot.id} />
    </group>
  );
}

export function CommercialBuilding(props: BuildingVariantProps) {
  switch (props.variant) {
    case 1: return <CornerStore {...props} />;
    case 2: return <OfficeBlock {...props} />;
    default: return <Shopfront {...props} />;
  }
}
