"use client";

import { useRef, forwardRef, useImperativeHandle, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import PuzzlePiece from "./PuzzlePiece";

export type Move = {
  axis: "x" | "y" | "z";
  layer: number;
  dir: 1 | -1;
};

const SPACING = 1.004;
const TARGET = Math.PI / 2;
const SPEED = 4.2;

function ease(t: number) {
  return t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
}

function inv(m: Move): Move {
  return { ...m, dir: -m.dir as 1 | -1 };
}

function randomMoves(n = 20): Move[] {
  const axes: Move["axis"][] = ["x", "y", "z"];
  const moves: Move[] = [];
  let lastAxis = "";

  for (let i = 0; i < n; i++) {
    let ax: Move["axis"];

    do {
      ax = axes[Math.floor(Math.random() * 3)];
    } while (ax === lastAxis);

    lastAxis = ax;

    moves.push({
      axis: ax,
      layer: Math.floor(Math.random() * 3),
      dir: Math.random() > 0.5 ? 1 : -1,
    });
  }

  return moves;
}

export interface Cubie {
  id: number;
  x: number;
  y: number;
  z: number;

  homeX: number;
  homeY: number;
  homeZ: number;

  matrix: THREE.Matrix4;
}

export interface PuzzleHandle {
  shuffle: () => void;
  solve: () => void;
  isBusy: () => boolean;
}

export default forwardRef<PuzzleHandle>((_, ref) => {
  const cubies = useRef<Cubie[]>(
    Array.from({ length: 27 }, (_, i) => {
      const x = Math.floor(i / 9);
      const y = Math.floor((i % 9) / 3);
      const z = i % 3;

      return {
        id: i,
        x,
        y,
        z,
        homeX: x,
        homeY: y,
        homeZ: z,
        matrix: new THREE.Matrix4(),
      };
    }),
  );

  const queue = useRef<Move[]>([]);
  const history = useRef<Move[]>([]);
  const busy = useRef(false);

  const active = useRef<Move | null>(null);
  const elapsed = useRef(0);

  const layerRef = useRef<THREE.Group>(null);

  const [, tick] = useState(0);

  useImperativeHandle(ref, () => ({
    shuffle() {
      if (busy.current) return;

      const moves = randomMoves(20);
      history.current = [...moves].reverse().map(inv);
      queue.current = moves;

      busy.current = true;
      tick((v) => v + 1);
    },

    solve() {
      if (busy.current) return;

      queue.current = history.current;
      history.current = [];

      busy.current = true;
      tick((v) => v + 1);
    },

    isBusy() {
      return busy.current;
    },
  }));

  useFrame((_, dt) => {
    if (!active.current) {
      if (queue.current.length === 0) {
        busy.current = false;
        return;
      }

      active.current = queue.current.shift()!;
      elapsed.current = 0;
      tick((v) => v + 1);
      return;
    }

    elapsed.current += dt * SPEED;

    const t = Math.min(elapsed.current / TARGET, 1);
    const angle = ease(t) * TARGET * active.current.dir;

    const ax = active.current.axis;

    if (layerRef.current) {
      layerRef.current.rotation.set(
        ax === "x" ? angle : 0,
        ax === "y" ? angle : 0,
        ax === "z" ? angle : 0,
      );
    }

    if (t >= 1) {
      const move = active.current;
      active.current = null;

      const axisVec =
        move.axis === "x"
          ? new THREE.Vector3(1, 0, 0)
          : move.axis === "y"
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(0, 0, 1);

      const rot = new THREE.Matrix4().makeRotationAxis(
        axisVec,
        (Math.PI / 2) * move.dir,
      );

      for (const c of cubies.current) {
        const coord = move.axis === "x" ? c.x : move.axis === "y" ? c.y : c.z;

        if (coord !== move.layer) continue;

        const x = c.x - 1;
        const y = c.y - 1;
        const z = c.z - 1;

        let nx = c.x;
        let ny = c.y;
        let nz = c.z;

        if (move.axis === "x") {
          ny = Math.round(-z * move.dir) + 1;
          nz = Math.round(y * move.dir) + 1;
        }

        if (move.axis === "y") {
          nx = Math.round(z * move.dir) + 1;
          nz = Math.round(-x * move.dir) + 1;
        }

        if (move.axis === "z") {
          nx = Math.round(-y * move.dir) + 1;
          ny = Math.round(x * move.dir) + 1;
        }

        c.x = nx;
        c.y = ny;
        c.z = nz;

        c.matrix = rot.clone().multiply(c.matrix);
      }
    }
  });

  // -----------------------------
  // 🔥 OPTIMIZED RENDER (NO FILTERS)
  // -----------------------------

  const activeMove = active.current;

  const rotatingSet = new Set<number>();

  if (activeMove) {
    for (const c of cubies.current) {
      const coord =
        activeMove.axis === "x" ? c.x : activeMove.axis === "y" ? c.y : c.z;

      if (coord === activeMove.layer) {
        rotatingSet.add(c.id);
      }
    }
  }

  return (
    <group>
      <group ref={layerRef}>
        {cubies.current.map((c) => {
          const isRotating = rotatingSet.has(c.id);

          if (!isRotating) return null;

          return (
            <PuzzlePiece
              key={c.id}
              matrix={c.matrix}
              position={[
                (c.x - 1) * SPACING,
                (c.y - 1) * SPACING,
                (c.z - 1) * SPACING,
              ]}
              origX={c.homeX}
              origY={c.homeY}
              origZ={c.homeZ}
            />
          );
        })}
      </group>

      <group>
        {cubies.current.map((c) => {
          const isRotating = rotatingSet.has(c.id);

          if (isRotating) return null;

          return (
            <PuzzlePiece
              key={c.id}
              matrix={c.matrix}
              position={[
                (c.x - 1) * SPACING,
                (c.y - 1) * SPACING,
                (c.z - 1) * SPACING,
              ]}
              origX={c.homeX}
              origY={c.homeY}
              origZ={c.homeZ}
            />
          );
        })}
      </group>
    </group>
  );
});
