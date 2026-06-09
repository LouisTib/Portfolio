"use client";

import PuzzlePiece from "./PuzzlePiece";

const SIZE = 3;

export default function Puzzle() {
  const cubes: { x: number; y: number; z: number }[] = [];

  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      for (let z = 0; z < SIZE; z++) {
        cubes.push({ x, y, z });
      }
    }
  }

  return (
    <group>
      {cubes.map((c, i) => (
        <PuzzlePiece
          key={i}
          position={[(c.x - 1) * 1.05, (c.y - 1) * 1.05, (c.z - 1) * 1.05]}
        />
      ))}
    </group>
  );
}
