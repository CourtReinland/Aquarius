import React, { Suspense, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CommunityIsland } from './CommunityIsland';
import { ParticleField } from './ParticleField';

/**
 * The main 3D scene for the Community Explorer.
 *
 * Renders a cosmic space with floating community islands
 * arranged in a spiral/grid pattern. Users can orbit, zoom,
 * and tap on communities to navigate.
 *
 * Layout: communities arranged in a spiral galaxy pattern
 * with the user's communities closest to center.
 */

export interface CommunityNode {
  id: string;
  name: string;
  memberCount: number;
  address: string;
  category: 'membership' | 'trending' | 'open';
}

interface ExplorerSceneProps {
  communities: CommunityNode[];
  onSelectCommunity?: (community: CommunityNode) => void;
}

// Color palette matching Aquarius brand
const CATEGORY_COLORS: Record<string, string> = {
  membership: '#4ECDC4', // Teal - your communities
  trending: '#7B68EE',   // Purple - trending
  open: '#F0C040',       // Gold - open to join
};

// Arrange communities in a spiral pattern
function spiralPosition(index: number, total: number): [number, number, number] {
  const angle = index * 0.8;
  const radius = 1.5 + index * 0.5;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const y = (Math.random() - 0.5) * 0.5; // Slight y variation
  return [x, y, z];
}

export function ExplorerScene({ communities, onSelectCommunity }: ExplorerSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 4, 8], fov: 60, near: 0.1, far: 100 }}
      style={{ flex: 1, backgroundColor: '#0A0E14' }}
      gl={{ antialias: true }}
    >
      {/* Ambient lighting */}
      <ambientLight intensity={0.15} color="#4ECDC4" />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.3}
        color="#FFFFFF"
      />

      {/* Fog for depth */}
      <fog attach="fog" args={['#0A0E14', 8, 25]} />

      {/* Background particles */}
      <ParticleField count={300} spread={30} />

      {/* Ground grid reference plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[40, 40, 40, 40]} />
        <meshBasicMaterial
          color="#4ECDC4"
          wireframe
          transparent
          opacity={0.03}
        />
      </mesh>

      {/* Community Islands */}
      <Suspense fallback={null}>
        {communities.map((community, index) => (
          <CommunityIsland
            key={community.id}
            position={spiralPosition(index, communities.length)}
            name={community.name}
            memberCount={community.memberCount}
            color={CATEGORY_COLORS[community.category] || '#4ECDC4'}
            index={index}
            onSelect={() => onSelectCommunity?.(community)}
          />
        ))}
      </Suspense>

      {/* Center beacon - "You are here" */}
      <mesh position={[0, -1, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 3, 8]} />
        <meshBasicMaterial color="#4ECDC4" transparent opacity={0.2} />
      </mesh>

      {/* Camera controls */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        autoRotate
        autoRotateSpeed={0.3}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 6}
        maxDistance={15}
        minDistance={3}
      />
    </Canvas>
  );
}
