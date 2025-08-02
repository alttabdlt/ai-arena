import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box, Environment, Float, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { ItemRarity, RARITY_COLORS } from '@/types/lootbox';

interface Lootbox3DProps {
  stage: 'appearing' | 'shaking' | 'opening';
  rarity?: ItemRarity;
}

const LootboxMesh: React.FC<{ stage: Lootbox3DProps['stage']; rarity?: ItemRarity }> = ({ stage, rarity }) => {
  const boxRef = useRef<THREE.Mesh>(null);
  const lidRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  
  // Rarity-based color
  const glowColor = useMemo(() => {
    if (!rarity) return '#FFF';
    return RARITY_COLORS[rarity];
  }, [rarity]);
  
  // Animation logic
  useFrame((state) => {
    if (!boxRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    if (stage === 'appearing') {
      // Gentle rotation during appearance
      boxRef.current.rotation.y = Math.sin(time * 0.5) * 0.1;
    } else if (stage === 'shaking') {
      // Intense shaking
      boxRef.current.rotation.x = Math.sin(time * 20) * 0.05;
      boxRef.current.rotation.z = Math.cos(time * 20) * 0.05;
      boxRef.current.position.x = Math.sin(time * 30) * 0.02;
      
      // Light pulsing
      if (lightRef.current) {
        lightRef.current.intensity = 2 + Math.sin(time * 10) * 0.5;
      }
    } else if (stage === 'opening' && lidRef.current) {
      // Lid flies off
      lidRef.current.position.y = Math.min(lidRef.current.position.y + 0.1, 5);
      lidRef.current.rotation.x = Math.min(lidRef.current.rotation.x + 0.05, Math.PI);
      
      // Box expands slightly
      const scale = Math.min(boxRef.current.scale.x + 0.01, 1.2);
      boxRef.current.scale.set(scale, scale, scale);
    }
  });
  
  return (
    <group>
      {/* Main box */}
      <mesh ref={boxRef} position={[0, 0, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial
          color="#1a1a1a"
          metalness={0.8}
          roughness={0.2}
          emissive={glowColor}
          emissiveIntensity={stage === 'shaking' ? 0.3 : 0.1}
        />
      </mesh>
      
      {/* Box lid */}
      <mesh ref={lidRef} position={[0, 1.1, 0]}>
        <boxGeometry args={[2.1, 0.2, 2.1]} />
        <meshStandardMaterial
          color="#2a2a2a"
          metalness={0.8}
          roughness={0.2}
          emissive={glowColor}
          emissiveIntensity={stage === 'shaking' ? 0.3 : 0.1}
        />
      </mesh>
      
      {/* Gold trim */}
      <mesh position={[0, 0, 1.05]}>
        <planeGeometry args={[2.2, 2.2]} />
        <meshStandardMaterial
          color="#FFD700"
          metalness={1}
          roughness={0.3}
          emissive="#FFD700"
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* Lock/latch */}
      <mesh position={[0, 0.5, 1.1]}>
        <cylinderGeometry args={[0.15, 0.15, 0.3]} />
        <meshStandardMaterial
          color="#FFD700"
          metalness={1}
          roughness={0.3}
        />
      </mesh>
      
      {/* Inner glow light */}
      <pointLight
        ref={lightRef}
        position={[0, 0, 0]}
        color={glowColor}
        intensity={stage === 'opening' ? 5 : 1}
        distance={10}
      />
      
      {/* Crack effects (visible during shaking) */}
      {stage === 'shaking' && (
        <>
          {[...Array(6)].map((_, i) => (
            <mesh key={i} position={[
              Math.sin(i * Math.PI / 3) * 0.8,
              Math.cos(i * Math.PI / 3) * 0.8,
              1.01
            ]}>
              <planeGeometry args={[0.05, 0.4]} />
              <meshBasicMaterial
                color={glowColor}
                transparent
                opacity={0.8}
              />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
};

export const Lootbox3D: React.FC<Lootbox3DProps> = ({ stage, rarity }) => {
  return (
    <div className="w-[400px] h-[400px]">
      <Canvas
        camera={{ position: [0, 2, 5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-5, -5, -5]} intensity={0.3} />
        
        {/* Floating animation wrapper */}
        <Float
          speed={2}
          rotationIntensity={stage === 'appearing' ? 0.5 : 0}
          floatIntensity={stage === 'appearing' ? 0.5 : 0}
        >
          <LootboxMesh stage={stage} rarity={rarity} />
        </Float>
        
        {/* Background stars */}
        <Stars
          radius={50}
          depth={50}
          count={1000}
          factor={2}
          saturation={0}
          fade
        />
        
        {/* Environment for reflections */}
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};