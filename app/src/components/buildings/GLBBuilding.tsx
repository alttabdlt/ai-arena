/**
 * GLBBuilding — Loads Kenney GLB models with cyberpunk re-skinning.
 *
 * Since the FBX→GLB conversion lost the original color palette, we apply
 * a stable single-material tone with subtle zone tinting per building.
 * This avoids runtime geometry/index mutation paths that can destabilize
 * WebGL on some devices.
 */
import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { type PlotZone, seededRandom } from './shared';

// ── Model path mapping ─────────────────────────────────────────────

const MODEL_BASE = '/models/buildings';

function getModelPath(zone: PlotZone, variant: number): string {
  const zoneLower = zone.toLowerCase();
  const v = Math.abs(variant) % 3;
  return `${MODEL_BASE}/${zoneLower}-${v}.glb`;
}

const ALL_MODEL_PATHS = (['RESIDENTIAL', 'COMMERCIAL', 'CIVIC', 'INDUSTRIAL', 'ENTERTAINMENT'] as PlotZone[])
  .flatMap(zone => [0, 1, 2].map(v => getModelPath(zone, v)));

export function preloadBuildingModels() {
  ALL_MODEL_PATHS.forEach(path => useGLTF.preload(path));
}

// ── Component ──────────────────────────────────────────────────────

interface GLBBuildingProps {
  zone: PlotZone;
  variant: number;
  plotId: string;
  targetHeight: number;
  main: THREE.Color;
  accent: THREE.Color;
  selected: boolean;
}

export function GLBBuilding({
  zone,
  variant,
  plotId,
  targetHeight,
  main,
  accent,
  selected,
}: GLBBuildingProps) {
  const modelPath = getModelPath(zone, variant);
  const { scene } = useGLTF(modelPath);

  // Deep-clone scene per instance: clone(true) only shallow-clones geometry
  // so we deep-clone geometries to avoid mutating shared buffers.
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry = mesh.geometry.clone();
      }
    });
    return clone;
  }, [scene]);

  // Seeded rotation (0/90/180/270°)
  const rotationY = useMemo(() => {
    const rng = seededRandom(plotId, ':glb');
    return Math.floor(rng() * 4) * (Math.PI / 2);
  }, [plotId]);

  // Compute scale to fill lot
  const { scaleVec, yOffset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Buildings should fill most of the 16-unit lot
    const targetFootprint = 12.0;
    const scaleXZ = targetFootprint / Math.max(size.x, size.z, 0.01);

    // Min height = 8.0 (4x agent height ~2.2) for real metaverse scale
    const minHeight = Math.max(targetHeight, 8.0);
    const scaleY = minHeight / Math.max(size.y, 0.01);

    return {
      scaleVec: new THREE.Vector3(scaleXZ, scaleY, scaleXZ),
      yOffset: -box.min.y,
    };
  }, [clonedScene, targetHeight]);

  // Stable hex string for useEffect deps (Color objects change ref every render)
  const accentHex_ = useMemo(() => '#' + accent.getHexString(), [accent]);

  // Apply stable single-material coloring.
  // Use seeded random for per-building tone variation.
  const wallTint = useMemo(() => {
    const rng = seededRandom(plotId, ':wallcolor');
    // Natural wall palettes: warm neutrals, concretes, bricks.
    const wallPalettes = [
      '#d4c5a9', // warm sandstone
      '#c9b89a', // beige
      '#b8a88a', // clay
      '#a8a098', // warm gray
      '#c4b8a0', // cream
      '#bca88c', // tan
      '#9e9488', // concrete
      '#c8b090', // adobe
      '#b0a898', // stone
      '#d0c0a8', // limestone
    ];
    const base = new THREE.Color(wallPalettes[Math.floor(rng() * wallPalettes.length)]);
    // Slightly tint toward zone color for cohesion.
    base.lerp(main, 0.15);
    return base;
  }, [plotId, main]);

  useEffect(() => {
    const accentC = new THREE.Color(accentHex_);

    const buildingMat = new THREE.MeshStandardMaterial({
      color: wallTint.clone().multiplyScalar(0.7),
      roughness: 0.78,
      metalness: 0.08,
      emissive: selected ? accentC.clone().multiplyScalar(0.08) : new THREE.Color('#000000'),
      emissiveIntensity: selected ? 1.0 : 0.4,
    });

    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = buildingMat;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });

    return () => {
      buildingMat.dispose();
    };
  }, [clonedScene, accentHex_, selected, wallTint]);

  return (
    <group>
      <group
        scale={[scaleVec.x, scaleVec.y, scaleVec.z]}
        rotation={[0, rotationY, 0]}
        position={[0, yOffset * scaleVec.y, 0]}
      >
        <primitive object={clonedScene} />
      </group>

      {/* Base glow ring */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.5, 6.0, 16]} />
        <meshStandardMaterial
          color={accentHex_}
          emissive={accentHex_}
          emissiveIntensity={selected ? 0.5 : 0.12}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rooftop accent light — only for selected building (saves ~30 PointLights) */}
      {selected && (
        <pointLight
          position={[0, targetHeight + 1.0, 0]}
          color={accentHex_}
          intensity={2.0}
          distance={20}
          decay={2}
        />
      )}
    </group>
  );
}
