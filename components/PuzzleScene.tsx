"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import Puzzle, { PuzzleHandle } from "./Puzzle";
import { preloadCubeAssets } from "@/lib/cubeAssets";
import { useEffect } from "react";

function AutoRotate({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.28;
  });
  return <group ref={groupRef}>{children}</group>;
}

interface PuzzleSceneProps {
  puzzleRef: React.MutableRefObject<PuzzleHandle | null>;
}

export default function PuzzleScene({ puzzleRef }: PuzzleSceneProps) {
  useEffect(() => {
    preloadCubeAssets();
  }, []);
  return (
    <Canvas
      camera={{ position: [6, 4, 11], fov: 55 }}
      shadows="soft"
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
    >
      <ambientLight intensity={0.55} />

      <directionalLight
        position={[6, 10, 6]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0005}
        color="#fff8f0"
      />

      <directionalLight
        position={[-5, 3, -4]}
        intensity={0.5}
        color="#c0d8ff"
      />

      <directionalLight
        position={[0, 6, -8]}
        intensity={0.35}
        color="#ffffff"
      />

      <pointLight position={[0, -4, 0]} intensity={0.3} color="#ffe8c0" />

      <Environment preset="city" />

      <Suspense fallback={null}>
        <AutoRotate>
          <Puzzle ref={puzzleRef} />
        </AutoRotate>
      </Suspense>

      <OrbitControls
        enableZoom
        enablePan={false}
        minDistance={5}
        maxDistance={18}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
      />
    </Canvas>
  );
}
