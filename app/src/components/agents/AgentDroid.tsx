import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { type Agent, type AgentSim, type AgentEconomicState } from './types';
import { ARCHETYPE_GLYPH, getBodyConfig } from './agentVisuals';
import { ArchetypeAccessories } from './AgentAccessories';
import { EconomicStateEffect, ChatAura, ActionAura, ArenaOutcomeAura, type ArenaOutcomeResult } from './AgentStateEffects';

const DUEL_MOTION_WINDUP_MS = 220;
const DUEL_MOTION_IMPACT_MS = 140;
const DUEL_MOTION_RECOVER_MS = 560;
const DUEL_MOTION_LIFE_MS = DUEL_MOTION_WINDUP_MS + DUEL_MOTION_IMPACT_MS + DUEL_MOTION_RECOVER_MS;

function getDuelMotionEnvelope(ageMs: number) {
  if (ageMs < 0 || ageMs > DUEL_MOTION_LIFE_MS) {
    return { windup: 0, impact: 0, recover: 0 };
  }
  if (ageMs <= DUEL_MOTION_WINDUP_MS) {
    return {
      windup: THREE.MathUtils.clamp(ageMs / DUEL_MOTION_WINDUP_MS, 0, 1),
      impact: 0,
      recover: 0,
    };
  }
  const impactAge = ageMs - DUEL_MOTION_WINDUP_MS;
  if (impactAge <= DUEL_MOTION_IMPACT_MS) {
    return {
      windup: THREE.MathUtils.clamp(1 - (impactAge / DUEL_MOTION_IMPACT_MS), 0, 1),
      impact: THREE.MathUtils.clamp(impactAge / DUEL_MOTION_IMPACT_MS, 0, 1),
      recover: 0,
    };
  }
  const recoverAge = impactAge - DUEL_MOTION_IMPACT_MS;
  return {
    windup: 0,
    impact: THREE.MathUtils.clamp(1 - (recoverAge / DUEL_MOTION_RECOVER_MS), 0, 1),
    recover: THREE.MathUtils.clamp(recoverAge / DUEL_MOTION_RECOVER_MS, 0, 1),
  };
}

// Reuse BillboardLabel from Town3D (will be passed via import in Town3D)
// We accept it as a render prop to avoid circular deps
interface AgentDroidProps {
  agent: Agent;
  color: string;
  selected: boolean;
  onClick: () => void;
  simsRef: React.MutableRefObject<Map<string, AgentSim>>;
  economicState: AgentEconomicState;
  arenaOutcome?: {
    result: ArenaOutcomeResult;
    delta: number;
    at: string;
  } | null;
  duelMomentum?: number;
  BillboardLabel: React.ComponentType<{ text: string; position: [number, number, number]; color?: string }>;
}

export function AgentDroid({
  agent,
  color,
  selected,
  onClick,
  simsRef,
  economicState,
  arenaOutcome,
  duelMomentum = 1,
  BillboardLabel,
}: AgentDroidProps) {
  const body = useRef<THREE.Mesh>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  const innerGroup = useRef<THREE.Group>(null);
  const head = useRef<THREE.Mesh>(null);
  const eyeL = useRef<THREE.Mesh>(null);
  const eyeR = useRef<THREE.Mesh>(null);
  const selectionRing = useRef<THREE.Mesh>(null);

  const cfg = getBodyConfig(agent.archetype);
  const isDead = false;
  const motionPhase = useMemo(() => {
    let hash = 2166136261;
    for (let index = 0; index < agent.id.length; index++) {
      hash ^= agent.id.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) * 0.000001;
  }, [agent.id]);
  const arenaOutcomeAtMs = useMemo(() => {
    const at = arenaOutcome?.at;
    if (!at) return null;
    const parsed = Date.parse(at);
    return Number.isFinite(parsed) ? parsed : null;
  }, [arenaOutcome?.at]);

  // Economic visual modifiers
  const scaleMod = economicState === 'BROKE' ? 0.92 : economicState === 'HOMELESS' ? 0.85 : 1.0;
  const emissiveMod = economicState === 'THRIVING' ? 1.3 : economicState === 'STRUGGLING' ? 0.5 : economicState === 'BROKE' ? 0.3 : economicState === 'HOMELESS' ? 0.1 : 1.0;

  useFrame((state) => {
    if (!group.current) return;

    if (isDead) {
      if (innerGroup.current) {
        innerGroup.current.rotation.z = THREE.MathUtils.lerp(
          innerGroup.current.rotation.z,
          Math.PI / 2,
          0.05
        );
        innerGroup.current.position.y = THREE.MathUtils.lerp(
          innerGroup.current.position.y,
          -0.8,
          0.05
        );
      }
      return;
    }

    const t = state.clock.elapsedTime;
    const phaseT = t + motionPhase;
    const sim = simsRef.current.get(agent.id);
    const activity = sim?.state || 'WALKING';
    const movementSpeed = sim?.velocity?.length() ?? 0;
    const locomotionBoost = THREE.MathUtils.clamp(movementSpeed / 3.2, 0.35, 1.6);
    const locomotionBlend = sim?.stateBlend ?? (activity === 'WALKING' ? 1 : 0);
    const idleWave = Math.sin(phaseT * 1.6);
    const headWave = Math.sin(phaseT * 0.9);
    const blinkGate = Math.sin(phaseT * 0.78 + motionPhase * 3.1);
    let blinkScale = blinkGate > 0.93 ? 0.16 : 1;
    let duelDirection = 0;
    let duelStrength = 0;
    let duelEnvelope = { windup: 0, impact: 0, recover: 0 };
    if (arenaOutcomeAtMs && arenaOutcome) {
      const age = Date.now() - arenaOutcomeAtMs;
      duelEnvelope = getDuelMotionEnvelope(age);
      const momentumBoost = THREE.MathUtils.clamp(1 + Math.max(0, duelMomentum - 1) * 0.14, 1, 1.9);
      duelStrength = THREE.MathUtils.clamp((Math.abs(arenaOutcome.delta) / 24) * momentumBoost, 0.48, 1.7);
      duelDirection = arenaOutcome.result === 'LOSS'
        ? -1
        : arenaOutcome.result === 'DRAW'
          ? (Math.sin(motionPhase * 9.1) >= 0 ? 1 : -1)
          : 1;
      if (duelEnvelope.impact > 0.62) blinkScale = 0.12;
    }

    // Scale by economic state
    if (innerGroup.current) {
      innerGroup.current.scale.setScalar(THREE.MathUtils.lerp(innerGroup.current.scale.x, scaleMod, 0.05));
    }

    // Activity-specific animations
    switch (activity) {
      case 'IDLE': {
        // Arms hang still, slow breathing scale pulse
        if (legL.current) legL.current.rotation.x = 0;
        if (legR.current) legR.current.rotation.x = 0;
        if (armL.current) armL.current.rotation.x = 0;
        if (armR.current) armR.current.rotation.x = 0;
        // Breathing pulse
        if (body.current) {
          const breath = 1 + Math.sin(phaseT * 1.5) * 0.015;
          body.current.scale.set(breath, breath, breath);
          body.current.position.y = 1.05 + idleWave * 0.012;
        }
        if (innerGroup.current) {
          innerGroup.current.rotation.z = THREE.MathUtils.lerp(innerGroup.current.rotation.z, Math.sin(phaseT * 0.8) * 0.03, 0.08);
        }
        break;
      }
      case 'CLAIMING': {
        // Quick surveying gesture + short stomp
        const pulse = Math.sin(t * 10) * 0.45;
        if (armL.current) armL.current.rotation.x = 0.2 + pulse;
        if (armR.current) armR.current.rotation.x = -0.1 - pulse * 0.35;
        if (legL.current) legL.current.rotation.x = pulse * 0.25;
        if (legR.current) legR.current.rotation.x = -pulse * 0.25;
        if (body.current) body.current.position.y = 1.05 + Math.sin(t * 10) * 0.03;
        break;
      }
      case 'BUILDING': {
        // Both arms hammer sync at 8Hz, orange arm emissive
        const hammer = Math.sin(t * 8) * 0.8;
        if (armL.current) armL.current.rotation.x = hammer;
        if (armR.current) armR.current.rotation.x = hammer;
        if (legL.current) legL.current.rotation.x = 0;
        if (legR.current) legR.current.rotation.x = 0;
        if (body.current) body.current.position.y = 1.05 + Math.sin(t * 8) * 0.04;
        break;
      }
      case 'WORKING': {
        // Alternating heavy labor loop with faster cadence than BUILDING
        const labor = Math.sin(t * 11) * 0.85;
        if (armL.current) armL.current.rotation.x = labor;
        if (armR.current) armR.current.rotation.x = -labor * 0.75;
        if (legL.current) legL.current.rotation.x = labor * 0.2;
        if (legR.current) legR.current.rotation.x = -labor * 0.2;
        if (body.current) body.current.position.y = 1.05 + Math.sin(t * 11) * 0.055;
        if (innerGroup.current) {
          innerGroup.current.rotation.x = THREE.MathUtils.lerp(innerGroup.current.rotation.x, 0.08, 0.12);
        }
        break;
      }
      case 'MINING': {
        // Body leans forward, arms alternate rapidly at 10Hz
        const mine = Math.sin(t * 10) * 0.7;
        if (armL.current) armL.current.rotation.x = mine;
        if (armR.current) armR.current.rotation.x = -mine;
        if (legL.current) legL.current.rotation.x = 0;
        if (legR.current) legR.current.rotation.x = 0;
        if (innerGroup.current) {
          innerGroup.current.rotation.x = THREE.MathUtils.lerp(innerGroup.current.rotation.x, 0.15, 0.1);
        }
        if (body.current) body.current.position.y = 1.05;
        break;
      }
      case 'TRADING': {
        // Fast hand signaling + shoulder sway
        if (armL.current) {
          armL.current.rotation.x = Math.sin(phaseT * 7.2) * 0.55;
          armL.current.rotation.z = Math.sin(phaseT * 3.5) * 0.2;
        }
        if (armR.current) {
          armR.current.rotation.x = Math.sin(phaseT * 8.1 + 0.6) * 0.55;
          armR.current.rotation.z = -Math.sin(phaseT * 3.1) * 0.2;
        }
        if (legL.current) legL.current.rotation.x = 0.08;
        if (legR.current) legR.current.rotation.x = -0.08;
        if (body.current) body.current.position.y = 1.05 + Math.sin(phaseT * 5.2) * 0.025;
        if (innerGroup.current) {
          innerGroup.current.rotation.z = THREE.MathUtils.lerp(innerGroup.current.rotation.z, Math.sin(phaseT * 4.2) * 0.06, 0.14);
        }
        break;
      }
      case 'FIGHTING': {
        // Aggressive duel stance
        const strike = Math.sin(t * 9.5) * 0.7;
        if (armL.current) armL.current.rotation.x = -0.2 + strike;
        if (armR.current) armR.current.rotation.x = 0.3 - strike;
        if (legL.current) legL.current.rotation.x = 0.2;
        if (legR.current) legR.current.rotation.x = -0.2;
        if (body.current) body.current.position.y = 1.05 + Math.sin(t * 7.8) * 0.045;
        if (innerGroup.current) {
          innerGroup.current.rotation.x = THREE.MathUtils.lerp(innerGroup.current.rotation.x, 0.1, 0.16);
          innerGroup.current.rotation.z = THREE.MathUtils.lerp(innerGroup.current.rotation.z, Math.sin(t * 6.5) * 0.08, 0.16);
        }
        break;
      }
      case 'CHATTING': {
        // Arms gesture asymmetrically
        if (armL.current) armL.current.rotation.x = Math.sin(phaseT * 3) * 0.4;
        if (armR.current) armR.current.rotation.x = Math.sin(phaseT * 2.5 + 1) * 0.5;
        if (legL.current) legL.current.rotation.x = 0;
        if (legR.current) legR.current.rotation.x = 0;
        if (body.current) body.current.position.y = 1.05 + idleWave * 0.01;
        break;
      }
      case 'BEGGING': {
        // Arms extended forward/up
        if (armL.current) {
          armL.current.rotation.x = -0.8 + Math.sin(t * 2) * 0.15;
          armL.current.rotation.z = 0.2;
        }
        if (armR.current) {
          armR.current.rotation.x = -0.8 + Math.sin(t * 2 + 0.5) * 0.15;
          armR.current.rotation.z = -0.2;
        }
        if (legL.current) legL.current.rotation.x = 0;
        if (legR.current) legR.current.rotation.x = 0;
        if (body.current) body.current.position.y = 1.05;
        break;
      }
      case 'SCHEMING': {
        // Body hunches, one arm behind back
        if (innerGroup.current) {
          innerGroup.current.scale.y = THREE.MathUtils.lerp(innerGroup.current.scale.y, 0.9 * scaleMod, 0.05);
          innerGroup.current.rotation.z = THREE.MathUtils.lerp(innerGroup.current.rotation.z, Math.sin(phaseT * 1.7) * 0.035, 0.08);
        }
        if (armL.current) armL.current.rotation.x = 0.3; // arm behind
        if (armR.current) armR.current.rotation.x = Math.sin(phaseT * 1.5) * 0.2; // subtle gesture
        if (legL.current) legL.current.rotation.x = 0;
        if (legR.current) legR.current.rotation.x = 0;
        if (body.current) body.current.position.y = 1.05;
        break;
      }
      default: {
        // WALKING / SHOPPING / PLAYING / TRAVELING — default walk cycle
        let freq = cfg.walkFreq * (0.72 + locomotionBoost * 0.55);
        const amp = cfg.walkAmplitude * (0.45 + locomotionBlend * 0.9);
        let bob = cfg.bobAmplitude * (0.5 + locomotionBlend * 0.75);

        // DEGEN walk jitter
        if (agent.archetype === 'DEGEN') {
          freq += Math.sin(t * 13) * 1.5;
          bob *= 2;
        }

        const swing = Math.sin(phaseT * freq) * amp;
        if (legL.current) legL.current.rotation.x = swing;
        if (legR.current) legR.current.rotation.x = -swing;
        if (armL.current) {
          armL.current.rotation.x = -swing * 0.6;
          armL.current.rotation.z = 0;
        }
        if (armR.current) {
          armR.current.rotation.x = swing * 0.6;
          armR.current.rotation.z = 0;
        }
        if (body.current) {
          body.current.position.y = 1.05 + Math.sin(phaseT * freq) * bob;
          body.current.scale.set(1, 1, 1);
        }

        // Reset inner group rotation from mining lean
        if (innerGroup.current) {
          const turnLean = THREE.MathUtils.clamp(-(sim?.turnVelocity ?? 0) * 0.55, -0.22, 0.22);
          innerGroup.current.rotation.x = THREE.MathUtils.lerp(innerGroup.current.rotation.x, 0, 0.1);
          innerGroup.current.rotation.z = THREE.MathUtils.lerp(innerGroup.current.rotation.z, turnLean, 0.12);
        }

        // CHAMELEON lateral sway
        if (agent.archetype === 'CHAMELEON' && innerGroup.current) {
          innerGroup.current.position.x = Math.sin(phaseT * 2) * 0.05;
        } else if (innerGroup.current) {
          innerGroup.current.position.x = THREE.MathUtils.lerp(innerGroup.current.position.x, 0, 0.08);
        }
        break;
      }
    }

    if (
      innerGroup.current
      && activity !== 'WALKING'
      && activity !== 'SHOPPING'
      && activity !== 'PLAYING'
      && activity !== 'TRAVELING'
      && activity !== 'IDLE'
      && activity !== 'SCHEMING'
      && activity !== 'TRADING'
      && activity !== 'FIGHTING'
    ) {
      innerGroup.current.rotation.z = THREE.MathUtils.lerp(innerGroup.current.rotation.z, 0, 0.1);
      innerGroup.current.position.x = THREE.MathUtils.lerp(innerGroup.current.position.x, 0, 0.1);
    }

    if (duelStrength > 0 && innerGroup.current) {
      const windup = duelEnvelope.windup * duelStrength;
      const impact = duelEnvelope.impact * duelStrength;
      const recover = duelEnvelope.recover * duelStrength;
      const xTilt = -0.22 * windup + 0.46 * impact - 0.09 * recover;
      const zTilt = duelDirection * (0.14 * windup - 0.34 * impact + 0.08 * recover);
      innerGroup.current.rotation.x = THREE.MathUtils.clamp(innerGroup.current.rotation.x + xTilt, -0.55, 0.88);
      innerGroup.current.rotation.z = THREE.MathUtils.clamp(innerGroup.current.rotation.z + zTilt, -0.62, 0.62);
      innerGroup.current.position.z = THREE.MathUtils.lerp(
        innerGroup.current.position.z,
        (-0.07 * windup + 0.18 * impact - 0.05 * recover),
        0.34,
      );

      if (armL.current) {
        armL.current.rotation.x += 0.7 * windup - 1.18 * impact + 0.24 * recover;
      }
      if (armR.current) {
        armR.current.rotation.x += 0.92 * windup - 1.34 * impact + 0.28 * recover;
      }
      if (body.current) {
        body.current.position.y += 0.06 * impact;
      }
      if (head.current) {
        head.current.rotation.x += -0.08 * windup + 0.11 * impact;
        head.current.rotation.y += duelDirection * 0.06 * impact;
      }
    } else if (innerGroup.current) {
      innerGroup.current.position.z = THREE.MathUtils.lerp(innerGroup.current.position.z, 0, 0.12);
    }

    if (body.current && selected) {
      body.current.position.y += Math.sin(phaseT * 2.6) * 0.02;
    }

    if (head.current) {
      const targetYaw = activity === 'CHATTING' ? Math.sin(phaseT * 1.5) * 0.16 : headWave * 0.08;
      const targetPitch = 0.02 + Math.cos(phaseT * 1.2) * 0.04;
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, targetYaw, 0.12);
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, targetPitch, 0.12);
    }

    if (eyeL.current) {
      eyeL.current.scale.y = THREE.MathUtils.lerp(eyeL.current.scale.y, blinkScale, 0.28);
    }
    if (eyeR.current) {
      eyeR.current.scale.y = THREE.MathUtils.lerp(eyeR.current.scale.y, blinkScale, 0.28);
    }

    if (selectionRing.current) {
      const pulse = 1 + Math.sin(phaseT * 3.2) * 0.08;
      selectionRing.current.rotation.z = phaseT * 0.75;
      selectionRing.current.scale.set(pulse, pulse, 1);
      const material = selectionRing.current.material as THREE.MeshStandardMaterial;
      material.opacity = 0.28 + Math.sin(phaseT * 3.2) * 0.12;
      material.emissiveIntensity = 0.5 + Math.sin(phaseT * 3.2) * 0.22;
    }
  });

  const glyph = ARCHETYPE_GLYPH[agent.archetype] || '●';
  const label = isDead ? `💀${agent.name.slice(0, 8)}` : `${glyph}${agent.name.slice(0, 10)}`;
  const labelColor = isDead ? '#6b7280' : (selected ? '#e2e8f0' : '#cbd5e1');

  // Eye glow colors: SCHEMING gets indigo, selected gets blue, default dark
  const sim = simsRef.current.get(agent.id);
  const activity = sim?.state || 'WALKING';
  const eyeEmissive = activity === 'SCHEMING'
    ? new THREE.Color('#6366f1')
    : selected ? new THREE.Color('#93c5fd') : undefined;

  return (
    <group ref={group} onPointerDown={(e) => (e.stopPropagation(), onClick())}>
      <group ref={innerGroup}>
        {/* Legs */}
        <mesh ref={legL}  position={[-0.25, cfg.legHeight / 2, 0]}>
          <boxGeometry args={[cfg.legWidth, cfg.legHeight, cfg.legWidth]} />
          <meshStandardMaterial color="#0b1220" />
        </mesh>
        <mesh ref={legR}  position={[0.25, cfg.legHeight / 2, 0]}>
          <boxGeometry args={[cfg.legWidth, cfg.legHeight, cfg.legWidth]} />
          <meshStandardMaterial color="#0b1220" />
        </mesh>

        {/* Arms */}
        <mesh ref={armL}  position={[-(cfg.bodyRadius + 0.05), 1.05, 0]}>
          <boxGeometry args={[cfg.armWidth, cfg.armLength, cfg.armWidth]} />
          <meshStandardMaterial
            color="#1f2937"
            emissive={activity === 'BUILDING' || activity === 'WORKING' ? '#f97316' : activity === 'TRADING' ? '#22d3ee' : activity === 'FIGHTING' ? '#fb7185' : '#000000'}
            emissiveIntensity={activity === 'BUILDING' || activity === 'WORKING' ? 0.3 : activity === 'TRADING' || activity === 'FIGHTING' ? 0.2 : 0}
          />
        </mesh>
        <mesh ref={armR}  position={[cfg.bodyRadius + 0.05, 1.05, 0]}>
          <boxGeometry args={[cfg.armWidth, cfg.armLength, cfg.armWidth]} />
          <meshStandardMaterial
            color="#1f2937"
            emissive={activity === 'BUILDING' || activity === 'WORKING' ? '#f97316' : activity === 'TRADING' ? '#22d3ee' : activity === 'FIGHTING' ? '#fb7185' : '#000000'}
            emissiveIntensity={activity === 'BUILDING' || activity === 'WORKING' ? 0.3 : activity === 'TRADING' || activity === 'FIGHTING' ? 0.2 : 0}
          />
        </mesh>

        {/* Body */}
        <mesh ref={body}  position={[0, 1.05, 0]}>
          <capsuleGeometry args={[cfg.bodyRadius, cfg.bodyHeight, 8, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={selected ? new THREE.Color(color).multiplyScalar(0.4 * emissiveMod) : new THREE.Color('#000')}
            emissiveIntensity={0.9}
            roughness={cfg.roughness}
            metalness={cfg.metalness}
          />
        </mesh>

        {/* Head */}
        <mesh ref={head} position={[0, 1.9, 0.05]}>
          <sphereGeometry args={[cfg.headRadius, 16, 16]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.15} />
        </mesh>
        {/* Eyes */}
        <mesh ref={eyeL} position={[-0.14, 1.95, 0.36]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#0b1220" emissive={eyeEmissive} />
        </mesh>
        <mesh ref={eyeR} position={[0.14, 1.95, 0.36]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#0b1220" emissive={eyeEmissive} />
        </mesh>

        {/* Archetype-specific accessories */}
        <ArchetypeAccessories archetype={agent.archetype} color={color} />

        {/* Activity-specific effects */}
        {activity === 'CHATTING' && <ChatAura />}
        <ActionAura state={activity} />
        <ArenaOutcomeAura outcome={arenaOutcome?.result ?? null} triggeredAtMs={arenaOutcomeAtMs} />

        {/* Economic state effects */}
        <EconomicStateEffect state={economicState} />

        {selected && (
          <mesh ref={selectionRing} position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.86, 0.035, 8, 32]} />
            <meshStandardMaterial
              color="#93c5fd"
              emissive="#93c5fd"
              emissiveIntensity={0.5}
              transparent
              opacity={0.32}
            />
          </mesh>
        )}
      </group>

      <BillboardLabel text={label} position={[0, 2.4, 0]} color={labelColor} />
    </group>
  );
}
