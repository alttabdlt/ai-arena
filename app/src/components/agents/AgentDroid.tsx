import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { type Agent, type AgentSim, type AgentEconomicState, getEconomicState } from './types';
import { ARCHETYPE_GLYPH, getBodyConfig } from './agentVisuals';
import { ArchetypeAccessories } from './AgentAccessories';
import { EconomicStateEffect, ChatAura } from './AgentStateEffects';

// Reuse BillboardLabel from Town3D (will be passed via import in Town3D)
// We accept it as a render prop to avoid circular deps
interface AgentDroidProps {
  agent: Agent;
  color: string;
  selected: boolean;
  onClick: () => void;
  simsRef: React.MutableRefObject<Map<string, AgentSim>>;
  economicState: AgentEconomicState;
  BillboardLabel: React.ComponentType<{ text: string; position: [number, number, number]; color?: string }>;
}

export function AgentDroid({
  agent,
  color,
  selected,
  onClick,
  simsRef,
  economicState,
  BillboardLabel,
}: AgentDroidProps) {
  const body = useRef<THREE.Mesh>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  const innerGroup = useRef<THREE.Group>(null);

  const cfg = getBodyConfig(agent.archetype);
  const isDead = false;

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
    const sim = simsRef.current.get(agent.id);
    const activity = sim?.state || 'WALKING';

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
          const breath = 1 + Math.sin(t * 1.5) * 0.015;
          body.current.scale.set(breath, breath, breath);
          body.current.position.y = 1.05;
        }
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
      case 'CHATTING': {
        // Arms gesture asymmetrically
        if (armL.current) armL.current.rotation.x = Math.sin(t * 3) * 0.4;
        if (armR.current) armR.current.rotation.x = Math.sin(t * 2.5 + 1) * 0.5;
        if (legL.current) legL.current.rotation.x = 0;
        if (legR.current) legR.current.rotation.x = 0;
        if (body.current) body.current.position.y = 1.05;
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
        }
        if (armL.current) armL.current.rotation.x = 0.3; // arm behind
        if (armR.current) armR.current.rotation.x = Math.sin(t * 1.5) * 0.2; // subtle gesture
        if (legL.current) legL.current.rotation.x = 0;
        if (legR.current) legR.current.rotation.x = 0;
        if (body.current) body.current.position.y = 1.05;
        break;
      }
      default: {
        // WALKING / SHOPPING / PLAYING — default walk cycle
        let freq = cfg.walkFreq;
        let amp = cfg.walkAmplitude;
        let bob = cfg.bobAmplitude;

        // DEGEN walk jitter
        if (agent.archetype === 'DEGEN') {
          freq += Math.sin(t * 13) * 1.5;
          bob *= 2;
        }

        const swing = Math.sin(t * freq) * amp;
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
          body.current.position.y = 1.05 + Math.sin(t * freq) * bob;
          body.current.scale.set(1, 1, 1);
        }

        // Reset inner group rotation from mining lean
        if (innerGroup.current) {
          innerGroup.current.rotation.x = THREE.MathUtils.lerp(innerGroup.current.rotation.x, 0, 0.1);
        }

        // CHAMELEON lateral sway
        if (agent.archetype === 'CHAMELEON' && innerGroup.current) {
          innerGroup.current.position.x = Math.sin(t * 2) * 0.05;
        }
        break;
      }
    }
  });

  const glyph = ARCHETYPE_GLYPH[agent.archetype] || '●';
  const label = isDead ? `💀${agent.name.slice(0, 5)}` : `${glyph}${agent.name.slice(0, 6)}`;
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
        <mesh ref={legL} castShadow position={[-0.25, cfg.legHeight / 2, 0]}>
          <boxGeometry args={[cfg.legWidth, cfg.legHeight, cfg.legWidth]} />
          <meshStandardMaterial color="#0b1220" />
        </mesh>
        <mesh ref={legR} castShadow position={[0.25, cfg.legHeight / 2, 0]}>
          <boxGeometry args={[cfg.legWidth, cfg.legHeight, cfg.legWidth]} />
          <meshStandardMaterial color="#0b1220" />
        </mesh>

        {/* Arms */}
        <mesh ref={armL} castShadow position={[-(cfg.bodyRadius + 0.05), 1.05, 0]}>
          <boxGeometry args={[cfg.armWidth, cfg.armLength, cfg.armWidth]} />
          <meshStandardMaterial
            color="#1f2937"
            emissive={activity === 'BUILDING' ? '#f97316' : '#000000'}
            emissiveIntensity={activity === 'BUILDING' ? 0.3 : 0}
          />
        </mesh>
        <mesh ref={armR} castShadow position={[cfg.bodyRadius + 0.05, 1.05, 0]}>
          <boxGeometry args={[cfg.armWidth, cfg.armLength, cfg.armWidth]} />
          <meshStandardMaterial
            color="#1f2937"
            emissive={activity === 'BUILDING' ? '#f97316' : '#000000'}
            emissiveIntensity={activity === 'BUILDING' ? 0.3 : 0}
          />
        </mesh>

        {/* Body */}
        <mesh ref={body} castShadow position={[0, 1.05, 0]}>
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
        <mesh castShadow position={[0, 1.9, 0.05]}>
          <sphereGeometry args={[cfg.headRadius, 16, 16]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.15} />
        </mesh>
        {/* Eyes */}
        <mesh position={[-0.14, 1.95, 0.36]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#0b1220" emissive={eyeEmissive} />
        </mesh>
        <mesh position={[0.14, 1.95, 0.36]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#0b1220" emissive={eyeEmissive} />
        </mesh>

        {/* Archetype-specific accessories */}
        <ArchetypeAccessories archetype={agent.archetype} color={color} />

        {/* Activity-specific effects */}
        {activity === 'CHATTING' && <ChatAura />}

        {/* Economic state effects */}
        <EconomicStateEffect state={economicState} />
      </group>

      <BillboardLabel text={label} position={[0, 2.4, 0]} color={labelColor} />
    </group>
  );
}
