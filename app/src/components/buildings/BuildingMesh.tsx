import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  type Plot,
  buildHeight,
  getTargetProgress,
  getVariant,
  getColors,
} from './shared';
import { ConstructionRenderer } from './constructionStages';
import { ResidentialBuilding } from './variants/residential';
import { CommercialBuilding } from './variants/commercial';
import { CivicBuilding } from './variants/civic';
import { IndustrialBuilding } from './variants/industrial';
import { EntertainmentBuilding } from './variants/entertainment';

export function BuildingMesh({
  plot,
  position,
  selected,
}: {
  plot: Plot;
  position: [number, number, number];
  selected: boolean;
}) {
  const h = buildHeight(plot);
  const variant = getVariant(plot.id);
  const { tint, main, accent } = getColors(plot, selected);

  const target = getTargetProgress(plot);
  const progressRef = useRef(target);
  const prevStageRef = useRef(Math.floor(target));
  const groupRef = useRef<THREE.Group>(null);
  const pulseRef = useRef(0); // 0 = no pulse, >0 = remaining pulse time

  useFrame((_, delta) => {
    const current = progressRef.current;
    const targetNow = getTargetProgress(plot);

    // Lerp progress toward target at dt * 2.0 rate (~1.5s to reach)
    if (Math.abs(current - targetNow) > 0.001) {
      progressRef.current = current + (targetNow - current) * Math.min(1, delta * 2.0);
    } else {
      progressRef.current = targetNow;
    }

    // Detect stage-up (floor of progress increases) → trigger scale pulse
    const currentStage = Math.floor(progressRef.current);
    if (currentStage > prevStageRef.current) {
      pulseRef.current = 0.4; // 0.4s pulse
    }
    prevStageRef.current = currentStage;

    // Animate scale pulse on the group
    if (groupRef.current) {
      if (pulseRef.current > 0) {
        pulseRef.current = Math.max(0, pulseRef.current - delta);
        // Bell curve: 0.4 → 0.2 is ramp up, 0.2 → 0 is ramp down
        const t = 1 - pulseRef.current / 0.4; // 0 → 1
        const pulse = 1 + 0.06 * Math.sin(t * Math.PI); // peaks at 1.06 midway
        groupRef.current.scale.setScalar(pulse);
      } else {
        groupRef.current.scale.setScalar(1);
      }
    }
  });

  const isComplete = plot.status === 'BUILT' && progressRef.current >= 3.99;

  if (isComplete) {
    // Stage 4: Complete — render zone-specific variant
    const variantProps = { plot, h, main, accent, selected, variant };
    return (
      <group ref={groupRef} position={position}>
        {plot.zone === 'RESIDENTIAL' && <ResidentialBuilding {...variantProps} />}
        {plot.zone === 'COMMERCIAL' && <CommercialBuilding {...variantProps} />}
        {plot.zone === 'CIVIC' && <CivicBuilding {...variantProps} />}
        {plot.zone === 'INDUSTRIAL' && <IndustrialBuilding {...variantProps} />}
        {plot.zone === 'ENTERTAINMENT' && <EntertainmentBuilding {...variantProps} />}
      </group>
    );
  }

  // Under construction — continuous renderer
  return (
    <group ref={groupRef} position={position}>
      <ConstructionRenderer
        plot={plot}
        h={h}
        tint={tint}
        accent={accent}
        selected={selected}
        progressRef={progressRef}
      />
    </group>
  );
}
