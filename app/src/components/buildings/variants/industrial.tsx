import * as THREE from 'three';
import { type BuildingVariantProps } from '../shared';
import { IndustrialSmoke } from '../effects';

// Variant 0: Factory (box + smokestack + smoke) — original
function Factory({ plot, h, main, accent, selected }: BuildingVariantProps) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[-0.3, h / 2, 0]}>
        <boxGeometry args={[3.4, h, 3.2]} />
        <meshStandardMaterial color={main} emissive={selected ? accent.clone().multiplyScalar(0.25) : undefined} />
      </mesh>
      {/* Smokestack */}
      <mesh castShadow position={[1.4, h * 0.62, -0.6]}>
        <cylinderGeometry args={[0.32, 0.4, h * 0.9, 10]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      <mesh castShadow position={[1.4, h * 1.05, -0.6]}>
        <sphereGeometry args={[0.35, 10, 10]} />
        <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.2)} />
      </mesh>
      <IndustrialSmoke position={[1.4, h * 1.2, -0.6]} intensity={1.2} />
    </group>
  );
}

// Variant 1: Warehouse (wide low box + barrel roof + side pipe)
function Warehouse({ plot, h, main, accent, selected }: BuildingVariantProps) {
  const emissive = selected ? accent.clone().multiplyScalar(0.25) : undefined;
  const warehouseH = h * 0.7;
  return (
    <group>
      {/* Wide low body */}
      <mesh castShadow receiveShadow position={[0, warehouseH / 2, 0]}>
        <boxGeometry args={[4.0, warehouseH, 3.0]} />
        <meshStandardMaterial color={main} emissive={emissive} />
      </mesh>
      {/* Barrel roof (half-cylinder) */}
      <mesh castShadow position={[0, warehouseH, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[2.0, 2.0, 3.0, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={main.clone().multiplyScalar(0.8)} emissive={emissive} side={THREE.DoubleSide} />
      </mesh>
      {/* Side pipe */}
      <mesh position={[2.1, warehouseH * 0.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 1.2, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} />
      </mesh>
      {/* Pipe elbow */}
      <mesh position={[2.1, warehouseH * 0.4 + 0.6, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.8, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} />
      </mesh>
      {/* Loading bay door */}
      <mesh position={[0, 0.6, 1.51]}>
        <boxGeometry args={[1.8, 1.2, 0.04]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <IndustrialSmoke position={[2.1, warehouseH + 0.5, 0]} intensity={0.6} />
    </group>
  );
}

// Variant 2: Silo complex (2 cylinders + walkway + small stack)
function SiloComplex({ plot, h, main, accent, selected }: BuildingVariantProps) {
  const emissive = selected ? accent.clone().multiplyScalar(0.25) : undefined;
  const siloH = h * 1.2;
  return (
    <group>
      {/* Primary silo */}
      <mesh castShadow receiveShadow position={[-0.7, siloH / 2, 0]}>
        <cylinderGeometry args={[1.1, 1.1, siloH, 16]} />
        <meshStandardMaterial color={main} emissive={emissive} />
      </mesh>
      {/* Silo top cone */}
      <mesh castShadow position={[-0.7, siloH + 0.35, 0]}>
        <coneGeometry args={[1.15, 0.7, 16]} />
        <meshStandardMaterial color={main.clone().multiplyScalar(0.8)} />
      </mesh>
      {/* Secondary silo (shorter) */}
      <mesh castShadow receiveShadow position={[0.9, siloH * 0.4, 0]}>
        <cylinderGeometry args={[0.8, 0.8, siloH * 0.8, 16]} />
        <meshStandardMaterial color={main.clone().multiplyScalar(0.9)} emissive={emissive} />
      </mesh>
      <mesh castShadow position={[0.9, siloH * 0.8 + 0.25, 0]}>
        <coneGeometry args={[0.85, 0.5, 16]} />
        <meshStandardMaterial color={main.clone().multiplyScalar(0.75)} />
      </mesh>
      {/* Walkway connecting silos */}
      <mesh position={[0.1, siloH * 0.65, 0]}>
        <boxGeometry args={[1.8, 0.08, 0.5]} />
        <meshStandardMaterial color="#64748b" metalness={0.4} />
      </mesh>
      {/* Walkway railing */}
      <mesh position={[0.1, siloH * 0.65 + 0.15, 0.28]}>
        <boxGeometry args={[1.8, 0.06, 0.03]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.5} />
      </mesh>
      {/* Small exhaust stack */}
      <mesh position={[0.9, siloH * 0.8 + 0.6, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.6, 6]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <IndustrialSmoke position={[0.9, siloH * 0.8 + 0.9, 0]} intensity={0.4} />
    </group>
  );
}

export function IndustrialBuilding(props: BuildingVariantProps) {
  switch (props.variant) {
    case 1: return <Warehouse {...props} />;
    case 2: return <SiloComplex {...props} />;
    default: return <Factory {...props} />;
  }
}
