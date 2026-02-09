/**
 * GLBBuilding — Loads Kenney GLB models with cyberpunk re-skinning.
 *
 * Since the FBX→GLB conversion lost the original color palette, we use
 * normal-based material assignment: roof faces (Y-up) get accent color,
 * wall faces (sideways) get main zone color, creating natural-looking
 * multi-colored buildings from monochrome geometry.
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

// ── Normal-based face splitting ────────────────────────────────────

/**
 * Splits a single-material geometry into groups by face normal direction:
 *   0 = walls (mostly horizontal normals)
 *   1 = roof  (normals pointing up, Y > threshold)
 *   2 = floor (normals pointing down, Y < -threshold)
 */
function splitByNormals(geometry: THREE.BufferGeometry) {
  const index = geometry.index;
  const normal = geometry.attributes.normal;
  if (!normal || !index) return;

  // Clear existing groups
  geometry.clearGroups();

  const faceCount = index.count / 3;
  const faceNY = new Float32Array(faceCount);

  // Compute average normal Y for each face
  for (let f = 0; f < faceCount; f++) {
    const i0 = index.getX(f * 3);
    const i1 = index.getX(f * 3 + 1);
    const i2 = index.getX(f * 3 + 2);
    faceNY[f] = (normal.getY(i0) + normal.getY(i1) + normal.getY(i2)) / 3;
  }

  // Sort faces into groups by normal direction
  // Rebuild the index buffer sorted by group
  const wallFaces: number[] = [];
  const roofFaces: number[] = [];
  const floorFaces: number[] = [];

  for (let f = 0; f < faceCount; f++) {
    const ny = faceNY[f];
    const indices = [
      index.getX(f * 3),
      index.getX(f * 3 + 1),
      index.getX(f * 3 + 2),
    ];
    if (ny > 0.5) {
      roofFaces.push(...indices);
    } else if (ny < -0.5) {
      floorFaces.push(...indices);
    } else {
      wallFaces.push(...indices);
    }
  }

  // Rebuild index: walls first, then roof, then floor
  const newIndices = new Uint32Array(wallFaces.length + roofFaces.length + floorFaces.length);
  newIndices.set(wallFaces, 0);
  newIndices.set(roofFaces, wallFaces.length);
  newIndices.set(floorFaces, wallFaces.length + roofFaces.length);

  geometry.setIndex(new THREE.BufferAttribute(newIndices, 1));
  geometry.addGroup(0, wallFaces.length, 0);                              // walls
  geometry.addGroup(wallFaces.length, roofFaces.length, 1);               // roof
  geometry.addGroup(wallFaces.length + roofFaces.length, floorFaces.length, 2); // floor
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
  // so we must deep-clone geometries to avoid mutating shared buffers
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry = mesh.geometry.clone();
        // Split normals once at clone time (geometry is now unique per instance)
        splitByNormals(mesh.geometry);
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

  // Stable hex strings for useEffect deps (Color objects change ref every render)
  const mainHex = useMemo(() => '#' + main.getHexString(), [main]);
  const accentHex_ = useMemo(() => '#' + accent.getHexString(), [accent]);

  // Apply normal-based multi-material coloring
  // Use seeded random for per-building wall color variation
  const wallTint = useMemo(() => {
    const rng = seededRandom(plotId, ':wallcolor');
    // Natural wall palettes: warm neutrals, concretes, bricks — NOT the zone color
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
    // Slightly tint toward zone color for cohesion (15% blend)
    base.lerp(main, 0.15);
    return base;
  }, [plotId, mainHex]);

  useEffect(() => {
    const mainC = new THREE.Color(mainHex);
    const accentC = new THREE.Color(accentHex_);

    // Wall material — natural building tones, NOT zone color
    const wallMat = new THREE.MeshStandardMaterial({
      color: wallTint.clone().multiplyScalar(0.7),
      roughness: 0.82,
      metalness: 0.05,
      emissive: selected ? accentC.clone().multiplyScalar(0.08) : new THREE.Color('#000000'),
    });

    // Roof material — vivid zone accent color (this carries the zone identity)
    const roofMat = new THREE.MeshStandardMaterial({
      color: accentC.clone().multiplyScalar(0.85),
      roughness: 0.55,
      metalness: 0.2,
      emissive: accentC.clone().multiplyScalar(selected ? 0.3 : 0.1),
    });

    // Floor/foundation — dark neutral
    const floorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3a3530'),
      roughness: 0.95,
      metalness: 0.02,
    });

    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        // Geometry already split at clone time — just apply materials
        mesh.material = [wallMat, roofMat, floorMat];
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return () => {
      wallMat.dispose();
      roofMat.dispose();
      floorMat.dispose();
    };
  }, [clonedScene, mainHex, accentHex_, selected, wallTint]);

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
        <ringGeometry args={[5.5, 6.0, 32]} />
        <meshStandardMaterial
          color={accentHex_}
          emissive={accentHex_}
          emissiveIntensity={selected ? 0.5 : 0.12}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rooftop accent light */}
      <pointLight
        position={[0, targetHeight + 1.0, 0]}
        color={accentHex_}
        intensity={selected ? 2.0 : 0.5}
        distance={20}
        decay={2}
      />
    </group>
  );
}
