import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function BlueStarfield() {
  const pointsRef = useRef<THREE.Points>(null);
  const lineRef = useRef<THREE.LineSegments>(null);

  const positions = useMemo(() => {
    const count = 180;
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      values[i * 3] = (Math.random() - 0.5) * 12;
      values[i * 3 + 1] = (Math.random() - 0.5) * 18;
      values[i * 3 + 2] = -2 - Math.random() * 8;
    }
    return values;
  }, []);

  const constellationPositions = useMemo(() => {
    const lines = new Float32Array([
      -4.2, 3.4, -4, -2.8, 2.8, -4,
      -2.8, 2.8, -4, -1.3, 3.2, -4,
      1.2, 3.6, -5, 2.7, 2.8, -5,
      2.7, 2.8, -5, 4.1, 3.3, -5,
      1.7, -2.1, -4.5, 2.9, -1.2, -4.5,
      2.9, -1.2, -4.5, 3.8, -2.5, -4.5,
      -3.7, -1.7, -5.5, -2.5, -2.4, -5.5,
      -2.5, -2.4, -5.5, -1.6, -1.3, -5.5,
    ]);
    return lines;
  }, []);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    if (pointsRef.current) {
      pointsRef.current.rotation.y = elapsed * 0.018;
      pointsRef.current.rotation.x = Math.sin(elapsed * 0.16) * 0.025;
    }
    if (lineRef.current) {
      lineRef.current.rotation.z = Math.sin(elapsed * 0.08) * 0.025;
      lineRef.current.position.y = Math.sin(elapsed * 0.18) * 0.08;
    }
  });

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.035} color="#B8F3FF" transparent opacity={0.64} sizeAttenuation />
      </points>
      <lineSegments ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[constellationPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#78DCE8" transparent opacity={0.22} />
      </lineSegments>
      <mesh position={[2.8, -1.8, -6]} rotation={[0, 0, 0.35]}>
        <torusGeometry args={[1.2, 0.006, 8, 80]} />
        <meshBasicMaterial color="#79E6F2" transparent opacity={0.16} />
      </mesh>
      <mesh position={[-3.8, 2.2, -5]} rotation={[0.3, 0.2, -0.4]}>
        <torusGeometry args={[0.55, 0.005, 8, 56]} />
        <meshBasicMaterial color="#DCEBFF" transparent opacity={0.14} />
      </mesh>
    </>
  );
}

export function BlueOnboardingBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 56, near: 0.1, far: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={styles.canvas}
      >
        <color attach="background" args={['#050B1A']} />
        <fog attach="fog" args={['#050B1A', 7, 18]} />
        <BlueStarfield />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: '#050B1A',
  },
});
