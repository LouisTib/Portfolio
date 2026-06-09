"use client";

import {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import PuzzlePiece from "./PuzzlePiece";

const SIZE = 3;

type Move = {
  axis: "x" | "y" | "z";
  layer: number; // 0, 1, 2
  dir: 1 | -1;
};

// Generate a random scramble
function randomMoves(count = 20): Move[] {
  const axes: ("x" | "y" | "z")[] = ["x", "y", "z"];
  return Array.from({ length: count }, () => ({
    axis: axes[Math.floor(Math.random() * 3)],
    layer: Math.floor(Math.random() * 3),
    dir: (Math.random() > 0.5 ? 1 : -1) as 1 | -1,
  }));
}

export interface PuzzleHandle {
  shuffle: () => void;
  solve: () => void;
}

interface CubieState {
  x: number;
  y: number;
  z: number;
  rotation: THREE.Euler;
}

const Puzzle = forwardRef<PuzzleHandle>((_, ref) => {
  // Cubie logical positions (grid 0-2)
  const [cubies, setCubies] = useState<CubieState[]>(() => {
    const arr: CubieState[] = [];
    for (let x = 0; x < SIZE; x++)
      for (let y = 0; y < SIZE; y++)
        for (let z = 0; z < SIZE; z++)
          arr.push({ x, y, z, rotation: new THREE.Euler() });
    return arr;
  });

  // Animation queue
  const queueRef = useRef<Move[]>([]);
  const animRef = useRef<{
    move: Move;
    progress: number;
    startState: CubieState[];
  } | null>(null);

  const solveHistoryRef = useRef<Move[]>([]);

  function applyMoveInstant(state: CubieState[], move: Move): CubieState[] {
    // Rotate position indices for pieces on this layer
    return state.map((c) => {
      const coord = move.axis === "x" ? c.x : move.axis === "y" ? c.y : c.z;
      if (coord !== move.layer) return c;

      let nx = c.x,
        ny = c.y,
        nz = c.z;
      if (move.axis === "x") {
        // rotate in YZ plane
        const y = c.y - 1,
          z = c.z - 1;
        nx = c.x;
        ny = Math.round(-z * move.dir + 1);
        nz = Math.round(y * move.dir + 1);
      } else if (move.axis === "y") {
        const x = c.x - 1,
          z = c.z - 1;
        nx = Math.round(z * move.dir + 1);
        ny = c.y;
        nz = Math.round(-x * move.dir + 1);
      } else {
        const x = c.x - 1,
          y = c.y - 1;
        nx = Math.round(-y * move.dir + 1);
        ny = Math.round(x * move.dir + 1);
        nz = c.z;
      }
      return { ...c, x: nx, y: ny, z: nz };
    });
  }

  useImperativeHandle(ref, () => ({
    shuffle() {
      const moves = randomMoves(18);
      solveHistoryRef.current = moves
        .map((m) => ({ ...m, dir: -m.dir as 1 | -1 }))
        .reverse();
      queueRef.current = [...moves];
      animRef.current = null;
    },
    solve() {
      queueRef.current = [...solveHistoryRef.current];
      animRef.current = null;
    },
  }));

  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!animRef.current && queueRef.current.length > 0) {
      const move = queueRef.current.shift()!;
      animRef.current = {
        move,
        progress: 0,
        startState: cubies.map((c) => ({ ...c })),
      };
    }

    if (animRef.current) {
      const speed = 8; // radians per second
      animRef.current.progress += delta * speed;
      const totalAngle = Math.PI / 2;
      const angle = Math.min(animRef.current.progress, totalAngle);
      const done = animRef.current.progress >= totalAngle;

      if (done) {
        // Commit the move to state
        setCubies((prev) => applyMoveInstant(prev, animRef.current!.move));
        animRef.current = null;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {cubies.map((c, i) => (
        <PuzzlePiece
          key={i}
          position={[(c.x - 1) * 1.05, (c.y - 1) * 1.05, (c.z - 1) * 1.05]}
          gridX={c.x}
          gridY={c.y}
          gridZ={c.z}
        />
      ))}
    </group>
  );
});

Puzzle.displayName = "Puzzle";
export default Puzzle;
