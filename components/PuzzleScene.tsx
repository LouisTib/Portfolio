"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import Puzzle, { PuzzleHandle } from "./Puzzle";

function AutoRotate({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.28;
  });
  return <group ref={groupRef}>{children}</group>;
}

interface PuzzleSceneProps {
  puzzleRef: React.RefObject<PuzzleHandle | null>;
}

export default function PuzzleScene({ puzzleRef }: PuzzleSceneProps) {
  return (
    <Canvas
      camera={{ position: [9, 7, 9], fov: 38 }}
      shadows="soft"
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
    >
      {/* Ambient fill */}
      <ambientLight intensity={0.55} />

      {/* Key light — top right front, warm */}
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

      {/* Fill light — left, cool blue */}
      <directionalLight
        position={[-5, 3, -4]}
        intensity={0.5}
        color="#c0d8ff"
      />

      {/* Rim light — back top, subtle */}
      <directionalLight
        position={[0, 6, -8]}
        intensity={0.35}
        color="#ffffff"
      />

      {/* Soft ground bounce */}
      <pointLight position={[0, -4, 0]} intensity={0.3} color="#ffe8c0" />

      {/* HDRI-style environment for reflections on the glossy stickers */}
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
        minPolarAngle={0} // was Math.PI / 6 — now allows full top-down view
        maxPolarAngle={Math.PI} // was Math.PI / 1.8 — now allows full bottom view
      />
    </Canvas>
  );
}
