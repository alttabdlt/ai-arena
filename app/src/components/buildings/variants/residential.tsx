import * as THREE from 'three';
import { type BuildingVariantProps, BuildingWindows } from '../shared';

// Variant 0: Gabled house (box + cone roof) — original
function GabledHouse({ plot, h, main, accent, selected }: BuildingVariantProps) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[3.2, h, 2.8]} />
        <meshStandardMaterial color={main} emissive={selected ? accent.clone().multiplyScalar(0.28) : undefined} />
      </mesh>
      <mesh castShadow position={[0, h + 0.55, 0]}>
        <coneGeometry args={[2.2, 1.2, 4]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <BuildingWindows height={h} zone={plot.zone} plotId={plot.id} />
    </group>
  );
}

// Variant 1: Flat-roof apartment (tall box + overhang + balcony rail)
function FlatRoofApartment({ plot, h, main, accent, selected }: BuildingVariantProps) {
  const aptH = h * 1.25;
  return (
    <group>
      {/* Main body — taller and narrower */}
      <mesh castShadow receiveShadow position={[0, aptH / 2, 0]}>
        <boxGeometry args={[2.6, aptH, 3.0]} />
        <meshStandardMaterial color={main} emissive={selected ? accent.clone().multiplyScalar(0.28) : undefined} />
      </mesh>
      {/* Flat roof overhang */}
      <mesh castShadow position={[0, aptH + 0.06, 0]}>
        <boxGeometry args={[3.0, 0.12, 3.4]} />
        <meshStandardMaterial color={accent.clone().multiplyScalar(0.7)} />
      </mesh>
      {/* Balcony rails (front face, 2 levels) */}
      {[aptH * 0.35, aptH * 0.7].map((y, i) => (
        <group key={i}>
          <mesh position={[0, y, 1.6]}>
            <boxGeometry args={[2.2, 0.05, 0.4]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.6} />
          </mesh>
          {/* Railing */}
          <mesh position={[0, y + 0.2, 1.75]}>
            <boxGeometry args={[2.2, 0.06, 0.04]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.5} />
          </mesh>
        </group>
      ))}
      <BuildingWindows height={aptH} zone={plot.zone} plotId={plot.id} />
    </group>
  );
}

// Variant 2: Tower house (narrow tall box + octagonal pyramid + chimney)
function TowerHouse({ plot, h, main, accent, selected }: BuildingVariantProps) {
  const towerH = h * 1.4;
  return (
    <group>
      {/* Narrow tall body */}
      <mesh castShadow receiveShadow position={[0, towerH / 2, 0]}>
        <boxGeometry args={[2.2, towerH, 2.2]} />
        <meshStandardMaterial color={main} emissive={selected ? accent.clone().multiplyScalar(0.28) : undefined} />
      </mesh>
      {/* Octagonal pyramid roof */}
      <mesh castShadow position={[0, towerH + 0.6, 0]}>
        <coneGeometry args={[1.5, 1.2, 8]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      {/* Chimney */}
      <mesh castShadow position={[0.7, towerH + 0.3, -0.6]}>
        <boxGeometry args={[0.35, 0.8, 0.35]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      {/* Chimney cap */}
      <mesh position={[0.7, towerH + 0.75, -0.6]}>
        <boxGeometry args={[0.45, 0.06, 0.45]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <BuildingWindows height={towerH} zone={plot.zone} plotId={plot.id} />
    </group>
  );
}

export function ResidentialBuilding(props: BuildingVariantProps) {
  switch (props.variant) {
    case 1: return <FlatRoofApartment {...props} />;
    case 2: return <TowerHouse {...props} />;
    default: return <GabledHouse {...props} />;
  }
}
