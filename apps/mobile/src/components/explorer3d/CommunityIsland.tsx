import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * A single floating community "island" in the 3D explorer.
 * Each community is rendered as a glowing geometric platform
 * with a beacon of light and floating text.
 *
 * The aesthetic: crystalline/geometric islands floating in a
 * dark space with teal accent lighting — matching the Aquarius
 * brand palette.
 */

interface CommunityIslandProps {
  position: [number, number, number];
  name: string;
  memberCount: number;
  color: string;
  index: number;
  onSelect?: () => void;
}

export function CommunityIsland({
  position,
  name,
  memberCount,
  color,
  index,
  onSelect,
}: CommunityIslandProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);

  // Each island bobs at slightly different phase
  const phaseOffset = useMemo(() => index * 0.7, [index]);

  // Gentle floating animation
  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.position.y =
        position[1] + Math.sin(t * 0.5 + phaseOffset) * 0.15;
      groupRef.current.rotation.y += 0.002;
    }
    if (glowRef.current) {
      const t = state.clock.elapsedTime;
      const scale = 1 + Math.sin(t * 2 + phaseOffset) * 0.05;
      glowRef.current.scale.setScalar(scale);
    }
    if (beaconRef.current) {
      const t = state.clock.elapsedTime;
      const intensity = 0.5 + Math.sin(t * 3 + phaseOffset) * 0.3;
      (beaconRef.current.material as THREE.MeshBasicMaterial).opacity = intensity;
    }
  });

  const baseColor = new THREE.Color(color);

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* Base platform - hexagonal prism */}
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.8, 1.0, 0.3, 6]} />
        <meshStandardMaterial
          color={baseColor}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      {/* Top surface - slightly smaller, glowing */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.7, 0.8, 0.1, 6]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={0.3}
          metalness={0.6}
          roughness={0.2}
        />
      </mesh>

      {/* Central beacon - glowing pillar */}
      <mesh ref={beaconRef} position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.0, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Beacon top orb */}
      <mesh position={[0, 1.35, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Glow ring around base */}
      <mesh ref={glowRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.2, 6]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Small crystal formations on the island */}
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2 + phaseOffset;
        const x = Math.cos(angle) * 0.5;
        const z = Math.sin(angle) * 0.5;
        return (
          <mesh key={i} position={[x, 0.35 + i * 0.05, z]}>
            <coneGeometry args={[0.06, 0.2 + i * 0.05, 4]} />
            <meshStandardMaterial
              color={baseColor}
              emissive={baseColor}
              emissiveIntensity={0.5}
              metalness={0.8}
              roughness={0.1}
            />
          </mesh>
        );
      })}

      {/* Member count indicator - small floating spheres */}
      {Array.from({ length: Math.min(memberCount, 5) }).map((_, i) => {
        const angle = (i / Math.min(memberCount, 5)) * Math.PI * 2;
        return (
          <mesh
            key={`member-${i}`}
            position={[Math.cos(angle) * 0.4, 0.5, Math.sin(angle) * 0.4]}
          >
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#E6EDF3" />
          </mesh>
        );
      })}

      {/* Point light for local illumination */}
      <pointLight
        color={color}
        intensity={0.5}
        distance={3}
        position={[0, 1, 0]}
      />
    </group>
  );
}
