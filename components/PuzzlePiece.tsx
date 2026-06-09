"use client";

import * as THREE from "three";

const COLORS = {
  right: "#ff3b30", // red
  left: "#ff9500", // orange
  top: "#ffffff", // white
  bottom: "#ffd60a", // yellow
  front: "#34c759", // green
  back: "#007aff", // blue
};

export default function PuzzlePiece({
  position,
}: {
  position: [number, number, number];
}) {
  const materials = [
    new THREE.MeshStandardMaterial({ color: COLORS.right }),
    new THREE.MeshStandardMaterial({ color: COLORS.left }),
    new THREE.MeshStandardMaterial({ color: COLORS.top }),
    new THREE.MeshStandardMaterial({ color: COLORS.bottom }),
    new THREE.MeshStandardMaterial({ color: COLORS.front }),
    new THREE.MeshStandardMaterial({ color: COLORS.back }),
  ];

  return (
    <mesh position={position}>
      {/* slightly smaller cube = visible “rubik gaps” */}
      <boxGeometry args={[0.95, 0.95, 0.95]} />

      {materials.map((m, i) => (
        <primitive key={i} attach={`material-${i}`} object={m} />
      ))}
    </mesh>
  );
}
