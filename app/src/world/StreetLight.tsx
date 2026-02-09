/**
 * StreetLight.tsx — Instanced street lighting along roads.
 * Pole + lamp placed every ~20 units along roads.
 * Warm PointLight at night (tied into day/night cycle via ambient light level).
 */
import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface StreetLightProps {
  /** World positions [x, z] for each light. */
  positions: Array<[number, number]>;
}

const POLE_HEIGHT = 6.0;
const LAMP_RADIUS = 0.35;
const LIGHT_COLOR = '#ffb347';
const LIGHT_INTENSITY_NIGHT = 1.2;
const MAX_LIGHTS_WITH_POINTLIGHT = 16; // Performance cap

export function StreetLights({ positions }: StreetLightProps) {
  const poleMeshRef = useRef<THREE.InstancedMesh>(null);
  const lampMeshRef = useRef<THREE.InstancedMesh>(null);
  const pointLightRefs = useRef<THREE.PointLight[]>([]);
  const lightIntensityRef = useRef(0);

  const count = positions.length;

  // Precompute matrices
  const { poleMatrices, lampMatrices } = useMemo(() => {
    const dummy = new THREE.Object3D();
    const poles: THREE.Matrix4[] = [];
    const lamps: THREE.Matrix4[] = [];

    for (const [x, z] of positions) {
      dummy.position.set(x, POLE_HEIGHT / 2, z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.push(dummy.matrix.clone());

      dummy.position.set(x, POLE_HEIGHT + LAMP_RADIUS, z);
      dummy.updateMatrix();
      lamps.push(dummy.matrix.clone());
    }

    return { poleMatrices: poles, lampMatrices: lamps };
  }, [positions]);

  // Apply matrices after mount
  useEffect(() => {
    if (poleMeshRef.current) {
      for (let i = 0; i < poleMatrices.length; i++) {
        poleMeshRef.current.setMatrixAt(i, poleMatrices[i]);
      }
      poleMeshRef.current.instanceMatrix.needsUpdate = true;
    }
    if (lampMeshRef.current) {
      for (let i = 0; i < lampMatrices.length; i++) {
        lampMeshRef.current.setMatrixAt(i, lampMatrices[i]);
      }
      lampMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [poleMatrices, lampMatrices]);

  // Detect night by ambient light level and update lights imperatively
  useFrame(({ scene }) => {
    const ambientLights = scene.children.filter(
      (c): c is THREE.AmbientLight => c instanceof THREE.AmbientLight,
    );
    const ambientIntensity = ambientLights[0]?.intensity ?? 0.4;
    const target = ambientIntensity < 0.35 ? LIGHT_INTENSITY_NIGHT : 0;
    lightIntensityRef.current += (target - lightIntensityRef.current) * 0.05;

    // Update lamp emissive
    if (lampMeshRef.current) {
      const mat = lampMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = lightIntensityRef.current;
    }

    // Update point light intensities imperatively
    for (const light of pointLightRefs.current) {
      if (light) light.intensity = lightIntensityRef.current;
    }
  });

  if (count === 0) return null;

  const pointLightPositions = positions.slice(0, MAX_LIGHTS_WITH_POINTLIGHT);

  return (
    <group>
      {/* Poles */}
      <instancedMesh ref={poleMeshRef} args={[undefined, undefined, count]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, POLE_HEIGHT, 6]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} metalness={0.3} />
      </instancedMesh>

      {/* Lamps */}
      <instancedMesh ref={lampMeshRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[LAMP_RADIUS, 8, 8]} />
        <meshStandardMaterial
          color={LIGHT_COLOR}
          emissive={LIGHT_COLOR}
          emissiveIntensity={0}
          roughness={0.3}
          transparent
          opacity={0.9}
        />
      </instancedMesh>

      {/* PointLights for nearby lights (intensity updated imperatively) */}
      {pointLightPositions.map(([x, z], i) => (
        <pointLight
          key={i}
          ref={(el) => { if (el) pointLightRefs.current[i] = el; }}
          position={[x, POLE_HEIGHT + 0.5, z]}
          color={LIGHT_COLOR}
          intensity={0}
          distance={20}
          decay={2}
        />
      ))}
    </group>
  );
}

/**
 * Generate street light positions along road segments, every ~20 units.
 */
export function generateLightPositions(
  roadSegments: Array<{ kind: 'V' | 'H'; x: number; z: number; len: number }>,
  spacing = 20,
): Array<[number, number]> {
  const positions: Array<[number, number]> = [];
  const seen = new Set<string>();

  for (const seg of roadSegments) {
    const count = Math.max(1, Math.floor(seg.len / spacing));
    for (let i = 0; i <= count; i++) {
      const t = count > 0 ? i / count : 0.5;
      let x: number, z: number;
      if (seg.kind === 'H') {
        x = seg.x - seg.len / 2 + seg.len * t;
        z = seg.z;
      } else {
        x = seg.x;
        z = seg.z - seg.len / 2 + seg.len * t;
      }
      // Offset to side of road
      const sideOffset = 3.0;
      const px = seg.kind === 'H' ? x : x + sideOffset;
      const pz = seg.kind === 'V' ? z : z + sideOffset;
      const key = `${Math.round(px)}:${Math.round(pz)}`;
      if (!seen.has(key)) {
        seen.add(key);
        positions.push([px, pz]);
      }
    }
  }

  return positions;
}
