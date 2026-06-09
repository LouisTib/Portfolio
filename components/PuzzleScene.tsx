"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Puzzle, { PuzzleHandle } from "./Puzzle";
import { Suspense } from "react";

// Auto-rotating wrapper
function AutoRotate({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });
  return <group ref={groupRef}>{children}</group>;
}

interface PuzzleSceneProps {
  puzzleRef: React.RefObject<PuzzleHandle | null>;
}

export default function PuzzleScene({ puzzleRef }: PuzzleSceneProps) {
  return (
    <Canvas camera={{ position: [5, 4, 5], fov: 50 }} shadows>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={2} castShadow />
      <directionalLight position={[-5, -3, -5]} intensity={0.4} />

      <Suspense fallback={null}>
        <AutoRotate>
          <Puzzle ref={puzzleRef} />
        </AutoRotate>
      </Suspense>

      <OrbitControls
        enableZoom={true}
        enablePan={false}
        minDistance={4}
        maxDistance={12}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.8}
      />
    </Canvas>
  );
}
