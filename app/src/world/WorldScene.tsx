/**
 * WorldScene.tsx — Top-level multi-town world renderer.
 *
 * Fetches all towns, positions them using worldLayout, manages LOD,
 * renders highways, wilderness, town gates, and traveling agents.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { layoutTowns, townGatePositions, getLODTier, TOWN_GAP, type WorldTown, type LODTier } from './worldLayout';
import { assignAgentsToTowns, tickTravel } from './agentAssignment';
import { HighwaySegment } from './HighwaySegment';
import { TownGateLandmark } from './TownGateLandmark';
import { WildernessProps } from './WildernessProps';

interface WorldTownSummary {
  id: string;
  name: string;
  level: number;
  status: string;
  plotCount?: number;
}

interface WorldSceneProps {
  /** All town summaries from backend. */
  townSummaries: WorldTownSummary[];
  /** Agent IDs for multi-town distribution. */
  agentIds: string[];
  /** Currently selected/focused town ID. */
  focusTownId: string | null;
  /** Callback when a town gate is clicked. */
  onTownSelect?: (townId: string) => void;
}

/**
 * WorldScene renders the multi-town open world: highways, gates, wilderness.
 * It wraps AROUND the existing TownScene (which renders one town at full detail).
 * The TownScene is still rendered by Town3D.tsx — WorldScene provides the world context.
 */
export function WorldScene({
  townSummaries,
  agentIds,
  focusTownId,
  onTownSelect,
}: WorldSceneProps) {
  const { camera } = useThree();

  // Layout all towns
  const worldTowns = useMemo(() => layoutTowns(townSummaries), [townSummaries]);
  const focusTown = useMemo(() => worldTowns.find((t) => t.id === focusTownId) ?? null, [worldTowns, focusTownId]);

  // Agent assignments (multi-town distribution)
  const assignmentsRef = useRef<Map<string, AgentTownAssignment>>(new Map());
  useEffect(() => {
    assignmentsRef.current = assignAgentsToTowns(agentIds, worldTowns);
  }, [agentIds, worldTowns]);

  // Tick travel each frame
  useFrame((_, dt) => {
    tickTravel(assignmentsRef.current, worldTowns, dt);
  });

  // LOD per town (computed per frame for camera-distance)
  const [lodMap, setLodMap] = useState<Map<string, LODTier>>(new Map());
  useFrame(() => {
    const camPos = camera.position;
    const next = new Map<string, LODTier>();
    for (const t of worldTowns) {
      const dx = camPos.x - t.worldX;
      const dz = camPos.z - t.worldZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      next.set(t.id, getLODTier(dist));
    }
    setLodMap(next);
  });

  // Highway segments between consecutive towns
  const highwayPairs = useMemo(() => {
    const pairs: Array<{ from: WorldTown; to: WorldTown; key: string }> = [];
    for (let i = 0; i < worldTowns.length - 1; i++) {
      pairs.push({
        from: worldTowns[i],
        to: worldTowns[i + 1],
        key: `hw-${worldTowns[i].id}-${worldTowns[i + 1].id}`,
      });
    }
    return pairs;
  }, [worldTowns]);

  // Offset all world elements relative to focused town
  // The focused town is rendered at origin by TownScene; other towns are offset from there.
  const focusOffset = useMemo(() => {
    if (!focusTown) return { x: 0, z: 0 };
    return { x: -focusTown.worldX, z: -focusTown.worldZ };
  }, [focusTown]);

  // Traveling agents rendered as simple markers on the highway
  const travelingAgents = useMemo(() => {
    const travelers: Array<{ id: string; x: number; z: number }> = [];
    for (const [id, a] of assignmentsRef.current) {
      if (a.state === 'TRAVELING') {
        travelers.push({ id, x: a.travelX + focusOffset.x, z: a.travelZ + focusOffset.z });
      }
    }
    return travelers;
  }, [focusOffset]);

  return (
    <group>
      {/* Expanded ground plane for the world */}
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[focusOffset.x, -0.01, focusOffset.z + (worldTowns.length - 1) * TOWN_GAP / 2]}>
        <planeGeometry args={[800, (worldTowns.length + 1) * TOWN_GAP]} />
        <meshStandardMaterial color="#050a12" roughness={1} />
      </mesh>

      {/* Highway segments */}
      {highwayPairs.map(({ from, to, key }) => (
        <HighwaySegment
          key={key}
          fromX={from.worldX + focusOffset.x}
          fromZ={from.worldZ + focusOffset.z}
          toX={to.worldX + focusOffset.x}
          toZ={to.worldZ + focusOffset.z}
        />
      ))}

      {/* Town gate landmarks */}
      {worldTowns.map((t) => {
        const gates = townGatePositions(t);
        const lod = lodMap.get(t.id) ?? 'low';
        // Only render gates for visible towns (not too far)
        if (lod === 'low' && t.id !== focusTownId) return null;
        return (
          <group key={`gates-${t.id}`}>
            <TownGateLandmark
              position={[gates.south[0] + focusOffset.x, gates.south[1], gates.south[2] + focusOffset.z]}
              townName={t.name}
              status={t.status}
              facingNorth={false}
            />
            <TownGateLandmark
              position={[gates.north[0] + focusOffset.x, gates.north[1], gates.north[2] + focusOffset.z]}
              townName={t.name}
              status={t.status}
              facingNorth={true}
            />
          </group>
        );
      })}

      {/* Wilderness between towns */}
      {highwayPairs.map(({ from, to, key }) => (
        <WildernessProps
          key={`wild-${key}`}
          fromZ={from.worldZ + focusOffset.z + 40}
          toZ={to.worldZ + focusOffset.z - 40}
          centerX={(from.worldX + to.worldX) / 2 + focusOffset.x}
          seed={key}
        />
      ))}

      {/* Distant town silhouettes (low LOD) */}
      {worldTowns.map((t) => {
        if (t.id === focusTownId) return null;
        const lod = lodMap.get(t.id) ?? 'low';
        const ox = t.worldX + focusOffset.x;
        const oz = t.worldZ + focusOffset.z;

        if (lod === 'low') {
          // Single colored block silhouette
          return (
            <group key={`silhouette-${t.id}`} position={[ox, 0, oz]}>
              <mesh position={[0, 3, 0]}>
                <boxGeometry args={[30, 6, 30]} />
                <meshStandardMaterial
                  color="#0a1628"
                  emissive="#0a1628"
                  emissiveIntensity={0.15}
                  roughness={1}
                  transparent
                  opacity={0.6}
                />
              </mesh>
              {/* Town name label */}
              <mesh position={[0, 8, 0]}>
                <sphereGeometry args={[0.5, 8, 8]} />
                <meshStandardMaterial
                  color={t.status === 'COMPLETE' ? '#fbbf24' : '#3b82f6'}
                  emissive={t.status === 'COMPLETE' ? '#fbbf24' : '#3b82f6'}
                  emissiveIntensity={0.8}
                />
              </mesh>
            </group>
          );
        }

        if (lod === 'medium') {
          // Simplified building outlines
          return (
            <group key={`medium-${t.id}`} position={[ox, 0, oz]}>
              {Array.from({ length: 9 }, (_, i) => {
                const row = Math.floor(i / 3) - 1;
                const col = (i % 3) - 1;
                const h = 2 + Math.abs(row + col) * 1.5;
                return (
                  <mesh key={i} position={[col * 8, h / 2, row * 8]} castShadow>
                    <boxGeometry args={[5, h, 5]} />
                    <meshStandardMaterial color="#0d1526" roughness={0.95} />
                  </mesh>
                );
              })}
            </group>
          );
        }

        return null;
      })}

      {/* Traveling agents on highway */}
      {travelingAgents.map((t) => (
        <group key={`traveler-${t.id}`} position={[t.x, 0.5, t.z]}>
          <mesh>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
