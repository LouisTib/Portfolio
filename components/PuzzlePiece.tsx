"use client";

import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import {
  FACE_DEFS,
  isOuter,
  getMaterialFor,
  getBodyMaterial,
  getPlaneGeometry,
} from "@/lib/cubeAssets";

interface Props {
  groupRef: (el: THREE.Group | null) => void;
  position: [number, number, number];
  origX: number;
  origY: number;
  origZ: number;
}

export default function PuzzlePiece({
  groupRef,
  position,
  origX,
  origY,
  origZ,
}: Props) {
  return (
    <group ref={groupRef} position={position}>
      <RoundedBox
        args={[0.96, 0.96, 0.96]}
        radius={0.08}
        smoothness={4}
        castShadow={false}
        receiveShadow={false}
        material={getBodyMaterial()}
      />
      {FACE_DEFS.map(({ axis, dir, key, rotation, offset }) => {
        if (!isOuter(axis, dir, origX, origY, origZ)) return null;
        const material = getMaterialFor(axis, dir, key, origX, origY, origZ);
        return (
          <mesh
            key={key}
            geometry={getPlaneGeometry()}
            material={material}
            position={offset}
            rotation={rotation}
            castShadow={false}
            receiveShadow={false}
          />
        );
      })}
    </group>
  );
}
