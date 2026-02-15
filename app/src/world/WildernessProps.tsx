/**
 * WildernessProps.tsx — Instanced trees, rocks, and grass between towns.
 * Uses InstancedMesh for performance (hundreds of props, few draw calls).
 * Seeded RNG for deterministic placement.
 */
import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { HIGHWAY_WIDTH } from './worldLayout';

interface WildernessPropsProps {
  /** Z range to fill with wilderness (between two towns). */
  fromZ: number;
  toZ: number;
  /** Average X position of the highway in this segment. */
  centerX: number;
  /** Seed for deterministic placement. */
  seed: string;
}

function hashToSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PropInstance {
  x: number;
  z: number;
  scale: number;
  rotY: number;
}

export function WildernessProps({ fromZ, toZ, centerX, seed }: WildernessPropsProps) {
  const treeTrunkRef = useRef<THREE.InstancedMesh>(null);
  const treeCanopyRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);

  const { trees, rocks, grasses } = useMemo(() => {
    const rng = mulberry32(hashToSeed(seed));
    const zLen = Math.abs(toZ - fromZ);
    const minZ = Math.min(fromZ, toZ);
    const halfRoad = HIGHWAY_WIDTH / 2 + 4; // Keep clear of highway

    const treeList: PropInstance[] = [];
    const rockList: PropInstance[] = [];
    const grassList: PropInstance[] = [];

    // Trees: ~1 per 100 sq units in a band ±60 units from highway
    const treeCount = Math.min(120, Math.floor((zLen * 120) / 200 / 100));
    for (let i = 0; i < treeCount; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const xOff = halfRoad + rng() * 55;
      treeList.push({
        x: centerX + side * xOff,
        z: minZ + rng() * zLen,
        scale: 0.6 + rng() * 1.4,
        rotY: rng() * Math.PI * 2,
      });
    }

    // Rocks: fewer, clustered
    const rockCount = Math.min(60, Math.floor(treeCount * 0.5));
    for (let i = 0; i < rockCount; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const xOff = halfRoad + rng() * 50;
      rockList.push({
        x: centerX + side * xOff,
        z: minZ + rng() * zLen,
        scale: 0.4 + rng() * 1.2,
        rotY: rng() * Math.PI * 2,
      });
    }

    // Grass patches: small planes near highway edges
    const grassCount = Math.min(80, Math.floor(treeCount * 0.6));
    for (let i = 0; i < grassCount; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const xOff = halfRoad - 1 + rng() * 30;
      grassList.push({
        x: centerX + side * xOff,
        z: minZ + rng() * zLen,
        scale: 0.5 + rng() * 1.5,
        rotY: rng() * Math.PI * 2,
      });
    }

    return { trees: treeList, rocks: rockList, grasses: grassList };
  }, [fromZ, toZ, centerX, seed]);

  // Apply instance transforms
  useEffect(() => {
    const dummy = new THREE.Object3D();

    // Tree trunks
    if (treeTrunkRef.current) {
      for (let i = 0; i < trees.length; i++) {
        const t = trees[i];
        dummy.position.set(t.x, t.scale * 1.0, t.z);
        dummy.scale.set(t.scale, t.scale, t.scale);
        dummy.rotation.set(0, t.rotY, 0);
        dummy.updateMatrix();
        treeTrunkRef.current.setMatrixAt(i, dummy.matrix);
      }
      treeTrunkRef.current.instanceMatrix.needsUpdate = true;
    }

    // Tree canopies
    if (treeCanopyRef.current) {
      for (let i = 0; i < trees.length; i++) {
        const t = trees[i];
        dummy.position.set(t.x, t.scale * 2.8, t.z);
        dummy.scale.set(t.scale, t.scale, t.scale);
        dummy.rotation.set(0, t.rotY, 0);
        dummy.updateMatrix();
        treeCanopyRef.current.setMatrixAt(i, dummy.matrix);
      }
      treeCanopyRef.current.instanceMatrix.needsUpdate = true;
    }

    // Rocks
    if (rockRef.current) {
      for (let i = 0; i < rocks.length; i++) {
        const r = rocks[i];
        dummy.position.set(r.x, r.scale * 0.3, r.z);
        dummy.scale.set(r.scale, r.scale * 0.7, r.scale);
        dummy.rotation.set(0, r.rotY, 0);
        dummy.updateMatrix();
        rockRef.current.setMatrixAt(i, dummy.matrix);
      }
      rockRef.current.instanceMatrix.needsUpdate = true;
    }

    // Grass
    if (grassRef.current) {
      for (let i = 0; i < grasses.length; i++) {
        const g = grasses[i];
        dummy.position.set(g.x, 0.05, g.z);
        dummy.scale.set(g.scale, 1, g.scale);
        dummy.rotation.set(-Math.PI / 2, 0, g.rotY);
        dummy.updateMatrix();
        grassRef.current.setMatrixAt(i, dummy.matrix);
      }
      grassRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [trees, rocks, grasses]);

  return (
    <group>
      {/* Tree trunks */}
      {trees.length > 0 && (
        <instancedMesh
          key={`wild-tree-trunk-${trees.length}`}
          ref={treeTrunkRef}
          args={[undefined, undefined, trees.length]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.18, 0.28, 2.0, 6]} />
          <meshStandardMaterial color="#3f2a1c" roughness={0.95} />
        </instancedMesh>
      )}

      {/* Tree canopies */}
      {trees.length > 0 && (
        <instancedMesh
          key={`wild-tree-canopy-${trees.length}`}
          ref={treeCanopyRef}
          args={[undefined, undefined, trees.length]}
          castShadow
          receiveShadow
        >
          <coneGeometry args={[1.1, 2.4, 7]} />
          <meshStandardMaterial color="#06351f" roughness={0.9} />
        </instancedMesh>
      )}

      {/* Rocks */}
      {rocks.length > 0 && (
        <instancedMesh
          key={`wild-rock-${rocks.length}`}
          ref={rockRef}
          args={[undefined, undefined, rocks.length]}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[0.8, 0]} />
          <meshStandardMaterial color="#111827" roughness={0.98} />
        </instancedMesh>
      )}

      {/* Grass patches */}
      {grasses.length > 0 && (
        <instancedMesh key={`wild-grass-${grasses.length}`} ref={grassRef} args={[undefined, undefined, grasses.length]}>
          <circleGeometry args={[1.2, 6]} />
          <meshStandardMaterial color="#0a2818" roughness={1} transparent opacity={0.6} />
        </instancedMesh>
      )}
    </group>
  );
}
