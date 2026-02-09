import { useRef, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { type Plot, ZONE_COLORS, clamp01, BuildingWindows } from './shared';

/**
 * Continuous construction renderer — takes a float progress (0–4) via ref
 * and animates all geometry imperatively each frame. No React re-renders at 60fps.
 */
export function ConstructionRenderer({
  plot,
  h,
  tint,
  accent,
  selected,
  progressRef,
}: {
  plot: Plot;
  h: number;
  tint: THREE.Color;
  accent: THREE.Color;
  selected: boolean;
  progressRef: MutableRefObject<number>;
}) {
  const zoneColor = ZONE_COLORS[plot.zone];

  // ── Refs for imperative animation ──
  const slabRef = useRef<THREE.Mesh>(null);
  const crossARef = useRef<THREE.Mesh>(null);
  const crossBRef = useRef<THREE.Mesh>(null);
  const stakeRefs = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ];
  const beamRefs = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ];
  const floorPlateRefs = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ];
  const wireframeRef = useRef<THREE.Mesh>(null);
  const craneGroupRef = useRef<THREE.Group>(null);
  const craneArmRef = useRef<THREE.Group>(null);
  const hookRef = useRef<THREE.Mesh>(null);
  const scaffoldRefs = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ];
  const wallRef = useRef<THREE.Mesh>(null);
  const wallMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const windowGroupRef = useRef<THREE.Group>(null);
  const accentRef = useRef<THREE.Mesh>(null);
  const accentMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const progressBarFillRef = useRef<THREE.Mesh>(null);
  const progressBarGroupRef = useRef<THREE.Group>(null);

  // Pre-compute beam base height
  const baseBeamH = 0.12;
  const beamCorners: [number, number][] = [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]];
  const scaffoldCorners: [number, number][] = [[-5.2, 5.2], [5.2, 5.2], [-5.2, -5.2], [5.2, -5.2]];
  const stakeCorners: [number, number][] = [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]];

  // Emissive color for walls
  const wallEmissive = useMemo(() => {
    return tint.clone().multiplyScalar(selected ? 0.3 : 0.08);
  }, [tint, selected]);

  useFrame((state) => {
    const p = progressRef.current;
    const t = state.clock.elapsedTime;

    // ── Foundation slab: appears 0.0, full at 0.5 ──
    if (slabRef.current) {
      const foundationT = clamp01(p / 0.5);
      slabRef.current.scale.set(foundationT, 1, foundationT);
      slabRef.current.visible = foundationT > 0.001;
    }

    // ── Zone cross marker: appears 0.0, full at 0.5, fades at 3.5 ──
    const crossOpacity = clamp01(p / 0.5) * (1 - clamp01((p - 3.5) / 0.5));
    if (crossARef.current) {
      (crossARef.current.material as THREE.MeshStandardMaterial).opacity = crossOpacity * 0.6;
      crossARef.current.visible = crossOpacity > 0.01;
    }
    if (crossBRef.current) {
      (crossBRef.current.material as THREE.MeshStandardMaterial).opacity = crossOpacity * 0.6;
      crossBRef.current.visible = crossOpacity > 0.01;
    }

    // ── Corner stakes: grow 0.0–0.8, fade at 2.5 ──
    const stakeGrow = clamp01(p / 0.8);
    const stakeFade = 1 - clamp01((p - 2.5) / 0.5);
    for (let i = 0; i < 4; i++) {
      const stake = stakeRefs[i].current;
      if (stake) {
        stake.scale.y = stakeGrow;
        stake.position.y = 0.4 * stakeGrow;
        stake.visible = stakeGrow * stakeFade > 0.01;
        (stake.material as THREE.MeshStandardMaterial).opacity = stakeFade;
      }
    }

    // ── Frame beams: appear 0.8, full height at 1.5 ──
    const beamT = clamp01((p - 0.8) / 0.7);
    const frameHeight = h * 0.5 * beamT;
    for (let i = 0; i < 4; i++) {
      const beam = beamRefs[i].current;
      if (beam) {
        beam.visible = beamT > 0.01;
        beam.scale.y = Math.max(0.001, frameHeight / baseBeamH);
        beam.position.y = frameHeight / 2;
        (beam.material as THREE.MeshStandardMaterial).opacity = beamT;
      }
    }

    // ── Floor plates: appear 1.0, full at 1.5 ──
    const floorT = clamp01((p - 1.0) / 0.5);
    for (let i = 0; i < 2; i++) {
      const plate = floorPlateRefs[i].current;
      if (plate) {
        plate.visible = floorT > 0.01;
        (plate.material as THREE.MeshStandardMaterial).opacity = floorT * 0.7;
        plate.scale.set(floorT, 1, floorT);
      }
    }

    // ── Wireframe ghost: appears 0.5, fades at 3.8 ──
    if (wireframeRef.current) {
      const wireIn = clamp01((p - 0.5) / 0.5);
      const wireOut = 1 - clamp01((p - 3.5) / 0.3);
      const wireOp = wireIn * wireOut * 0.06;
      wireframeRef.current.visible = wireOp > 0.002;
      (wireframeRef.current.material as THREE.MeshStandardMaterial).opacity = wireOp;
    }

    // ── Crane: appears 0.8, full at 1.2, fades at 3.0 ──
    const craneIn = clamp01((p - 0.8) / 0.4);
    const craneOut = 1 - clamp01((p - 3.0) / 0.5);
    const craneOpacity = craneIn * craneOut;
    if (craneGroupRef.current) {
      craneGroupRef.current.visible = craneOpacity > 0.01;
      craneGroupRef.current.scale.setScalar(craneOpacity);
    }
    if (craneArmRef.current) {
      craneArmRef.current.rotation.y = Math.sin(t * 0.3) * 0.4;
    }
    if (hookRef.current) {
      hookRef.current.position.y = 2.5 + Math.sin(t * 1.5) * 0.5;
    }

    // ── Scaffolding: appears 1.5, full at 2.0, fades at 3.2 ──
    const scaffoldIn = clamp01((p - 1.5) / 0.5);
    const scaffoldOut = 1 - clamp01((p - 3.2) / 0.3);
    const scaffoldOpacity = scaffoldIn * scaffoldOut;
    for (let i = 0; i < 4; i++) {
      const scaffold = scaffoldRefs[i].current;
      if (scaffold) {
        scaffold.visible = scaffoldOpacity > 0.01;
        (scaffold.material as THREE.MeshStandardMaterial).opacity = scaffoldOpacity;
      }
    }

    // ── Walls (rising): appear 1.8, full height at 3.0 ──
    const wallT = clamp01((p - 1.8) / 1.2);
    const wallHeight = h * wallT;
    if (wallRef.current && wallMatRef.current) {
      wallRef.current.visible = wallT > 0.01;
      wallRef.current.scale.y = Math.max(0.001, wallT);
      wallRef.current.position.y = wallHeight / 2;
      wallMatRef.current.emissive = wallEmissive;
    }

    // ── Windows: visible when wallHeight > 1.5 ──
    if (windowGroupRef.current) {
      windowGroupRef.current.visible = wallHeight > 1.5;
    }

    // ── Zone accent: appears 3.0, full at 3.8 ──
    const accentT = clamp01((p - 3.0) / 0.8);
    if (accentRef.current) {
      accentRef.current.visible = accentT > 0.01;
      accentRef.current.scale.setScalar(accentT);
    }
    if (accentMatRef.current) {
      accentMatRef.current.opacity = accentT * 0.3;
    }

    // ── Progress bar: always visible, fades at 3.9 ──
    const barFade = 1 - clamp01((p - 3.9) / 0.1);
    if (progressBarGroupRef.current) {
      progressBarGroupRef.current.visible = barFade > 0.01;
      progressBarGroupRef.current.position.y = Math.max(h + 0.8, wallHeight + 1.2);
    }
    if (progressBarFillRef.current) {
      const pct = clamp01(p / 4.0);
      progressBarFillRef.current.scale.x = Math.max(0.001, pct);
      progressBarFillRef.current.position.x = (pct - 1) * 4.0;
    }
  });

  return (
    <group>
      {/* Foundation slab */}
      <mesh ref={slabRef} receiveShadow position={[0, 0.06, 0]}>
        <boxGeometry args={[11, 0.2, 11]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>

      {/* Zone cross marker */}
      <mesh ref={crossARef} position={[0, 0.18, 0]}>
        <boxGeometry args={[7, 0.04, 0.6]} />
        <meshStandardMaterial
          color={zoneColor} emissive={zoneColor} emissiveIntensity={0.3}
          transparent opacity={0.6}
        />
      </mesh>
      <mesh ref={crossBRef} position={[0, 0.18, 0]}>
        <boxGeometry args={[0.6, 0.04, 7]} />
        <meshStandardMaterial
          color={zoneColor} emissive={zoneColor} emissiveIntensity={0.3}
          transparent opacity={0.6}
        />
      </mesh>

      {/* Corner stakes */}
      {stakeCorners.map(([x, z], i) => (
        <mesh key={`stake${i}`} ref={stakeRefs[i]} position={[x, 0.6, z]}>
          <cylinderGeometry args={[0.1, 0.15, 1.2, 6]} />
          <meshStandardMaterial color="#fbbf24" transparent />
        </mesh>
      ))}

      {/* Frame beams (vertical) */}
      {beamCorners.map(([x, z], i) => (
        <mesh key={`beam${i}`} ref={beamRefs[i]} position={[x, 0, z]}>
          <boxGeometry args={[0.25, baseBeamH, 0.25]} />
          <meshStandardMaterial color="#64748b" metalness={0.4} roughness={0.6} transparent />
        </mesh>
      ))}

      {/* Floor plates */}
      {[0.5, h * 0.3].map((y, i) => (
        <mesh key={`fp${i}`} ref={floorPlateRefs[i]} position={[0, y, 0]}>
          <boxGeometry args={[9.5, 0.1, 9.5]} />
          <meshStandardMaterial color="#475569" transparent opacity={0.7} />
        </mesh>
      ))}

      {/* Wireframe ghost */}
      <mesh ref={wireframeRef} position={[0, h / 2, 0]}>
        <boxGeometry args={[11, h, 11]} />
        <meshStandardMaterial color="#93c5fd" transparent opacity={0.06} wireframe />
      </mesh>

      {/* Crane */}
      <group ref={craneGroupRef}>
        <mesh position={[4.5, 4, 4.5]}>
          <boxGeometry args={[0.5, 8, 0.5]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>
        <group ref={craneArmRef} position={[4.5, 8, 4.5]}>
          <mesh position={[-2.5, 0.25, 0]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.35, 6, 0.35]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>
          <mesh ref={hookRef} position={[-5, 5, 0]}>
            <boxGeometry args={[0.25, 1.0, 0.25]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
          <mesh position={[-5, 5.8, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1.5, 8]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        </group>
      </group>

      {/* Scaffolding poles */}
      {scaffoldCorners.map(([x, z], i) => (
        <mesh key={`scaff${i}`} ref={scaffoldRefs[i]} position={[x, h / 2, z]}>
          <cylinderGeometry args={[0.15, 0.15, h, 8]} />
          <meshStandardMaterial color="#64748b" transparent />
        </mesh>
      ))}

      {/* Walls (rising) */}
      <mesh ref={wallRef} castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[10, h, 10]} />
        <meshStandardMaterial ref={wallMatRef} color="#8a7e70" />
      </mesh>

      {/* Windows */}
      <group ref={windowGroupRef}>
        <BuildingWindows height={h * 0.7} zone={plot.zone} plotId={plot.id} />
      </group>

      {/* Zone accent */}
      {plot.zone === 'RESIDENTIAL' && (
        <mesh ref={accentRef} position={[0, h + 1.0, 0]}>
          <coneGeometry args={[5.5, 3.0, 4]} />
          <meshStandardMaterial ref={accentMatRef} color={zoneColor} transparent opacity={0.3} />
        </mesh>
      )}
      {plot.zone === 'COMMERCIAL' && (
        <mesh ref={accentRef} position={[0, h * 0.65, 5.2]}>
          <boxGeometry args={[6, 1.2, 0.3]} />
          <meshStandardMaterial
            ref={accentMatRef} color={zoneColor} transparent opacity={0.3}
            emissive={zoneColor} emissiveIntensity={0.15}
          />
        </mesh>
      )}
      {plot.zone === 'CIVIC' && (
        <mesh ref={accentRef} position={[0, h + 0.5, 0]}>
          <sphereGeometry args={[2.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial ref={accentMatRef} color={zoneColor} transparent opacity={0.25} />
        </mesh>
      )}
      {plot.zone === 'INDUSTRIAL' && (
        <mesh ref={accentRef} position={[3.5, h * 0.5, -1.5]}>
          <cylinderGeometry args={[0.8, 1.0, h * 0.8, 10]} />
          <meshStandardMaterial ref={accentMatRef} color="#64748b" transparent opacity={0.4} />
        </mesh>
      )}
      {plot.zone === 'ENTERTAINMENT' && (
        <mesh ref={accentRef} position={[0, h + 0.5, 0]}>
          <torusGeometry args={[3.5, 0.35, 12, 28]} />
          <meshStandardMaterial
            ref={accentMatRef} color={zoneColor} transparent opacity={0.3}
            emissive={zoneColor} emissiveIntensity={0.15}
          />
        </mesh>
      )}

      {/* Progress bar */}
      <group ref={progressBarGroupRef} position={[0, h + 1.5, 0]}>
        <mesh>
          <planeGeometry args={[8, 0.5]} />
          <meshBasicMaterial color="#1e293b" transparent opacity={0.9} />
        </mesh>
        <mesh ref={progressBarFillRef} position={[0, 0, 0.01]}>
          <planeGeometry args={[7.5, 0.35]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      </group>
    </group>
  );
}
