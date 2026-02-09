/**
 * TownGateLandmark.tsx — Town entrance archway/sign at highway junctions.
 * Shows town name and completion status. Visually prominent as a landmark.
 */
import { useMemo } from 'react';
import * as THREE from 'three';

interface TownGateLandmarkProps {
  position: [number, number, number];
  townName: string;
  status: string;
  /** Faces north (true) or south (false) along the highway. */
  facingNorth?: boolean;
}

function drawGateTexture(name: string, status: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  // Background
  ctx.fillStyle = 'rgba(10, 15, 30, 0.92)';
  ctx.fillRect(0, 0, 256, 64);

  // Border
  ctx.strokeStyle = status === 'COMPLETE' ? '#fbbf24' : '#3b82f6';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 252, 60);

  // Town name
  ctx.fillStyle = '#e5e7eb';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 16), 128, 24);

  // Status
  ctx.fillStyle = status === 'COMPLETE' ? '#fbbf24' : '#94a3b8';
  ctx.font = '12px monospace';
  ctx.fillText(status, 128, 48);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function TownGateLandmark({ position, townName, status, facingNorth = true }: TownGateLandmarkProps) {
  const texture = useMemo(() => drawGateTexture(townName, status), [townName, status]);
  const rotation = facingNorth ? 0 : Math.PI;

  const accentColor = status === 'COMPLETE' ? '#fbbf24' : '#3b82f6';

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Left pillar */}
      <mesh castShadow position={[-3.5, 2.5, 0]}>
        <boxGeometry args={[0.6, 5, 0.6]} />
        <meshStandardMaterial color="#0f172a" roughness={0.85} metalness={0.2} />
      </mesh>

      {/* Right pillar */}
      <mesh castShadow position={[3.5, 2.5, 0]}>
        <boxGeometry args={[0.6, 5, 0.6]} />
        <meshStandardMaterial color="#0f172a" roughness={0.85} metalness={0.2} />
      </mesh>

      {/* Top beam (archway) */}
      <mesh castShadow position={[0, 5.2, 0]}>
        <boxGeometry args={[7.6, 0.5, 0.6]} />
        <meshStandardMaterial color="#0f172a" roughness={0.85} metalness={0.2} />
      </mesh>

      {/* Accent trim on top */}
      <mesh position={[0, 5.5, 0]}>
        <boxGeometry args={[8, 0.1, 0.7]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* Sign board with town name */}
      <mesh position={[0, 4.2, 0.35]}>
        <planeGeometry args={[5, 1.25]} />
        <meshStandardMaterial map={texture} transparent />
      </mesh>

      {/* Beacon light on top */}
      <pointLight
        position={[0, 6, 0]}
        color={accentColor}
        intensity={0.8}
        distance={25}
        decay={2}
      />
      <mesh position={[0, 5.8, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={1.2}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}
