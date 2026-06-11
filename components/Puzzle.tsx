"use client";

import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
} from "react";
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

  // ─── React state is ONLY used to trigger a re-render when the move
  // boundary changes (new move starts / move ends). NOT called every frame.
  const [activeMove, setActiveMove] = useState<Move | null>(null);

  // Stable callback so we don't recreate it
  const startNextMove = useCallback(() => {
    if (queue.current.length === 0) {
      busy.current = false;
      active.current = null;
      setActiveMove(null);
      return;
    }
    const move = queue.current.shift()!;
    active.current = move;
    elapsed.current = 0;
    setActiveMove({ ...move }); // trigger re-render once to reassign rotating group
  }, []);

  useImperativeHandle(ref, () => ({
    shuffle() {
      if (busy.current) return;
      const moves = randomMoves(20);
      history.current = [...moves].reverse().map(inv);
      queue.current = moves;
      busy.current = true;
      startNextMove();
    },
    solve() {
      if (busy.current) return;
      queue.current = history.current;
      history.current = [];
      busy.current = true;
      startNextMove();
    },
    isBusy() {
      return busy.current;
    },
  }));

  useFrame((_, dt) => {
    if (!active.current) return;

    elapsed.current += dt * SPEED;
    const t = Math.min(elapsed.current / TARGET, 1);
    const angle = ease(t) * TARGET * active.current.dir;
    const ax = active.current.axis;

    // Pure imperative mutation — zero React involvement per frame
    if (layerRef.current) {
      layerRef.current.rotation.set(
        ax === "x" ? angle : 0,
        ax === "y" ? angle : 0,
        ax === "z" ? angle : 0,
      );
    }

    if (t >= 1) {
      const move = active.current;

      // Reset layer rotation before snapping
      if (layerRef.current) {
        layerRef.current.rotation.set(0, 0, 0);
      }

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

        let nx = c.x,
          ny = c.y,
          nz = c.z;

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

      active.current = null;
      // Schedule next move — this is the only setState call per move boundary
      startNextMove();
    }
  });

  // ─── Render split: rotating vs static ─────────────────────────────────────
  // Derived from `activeMove` state (stable between frames, only changes at
  // move boundaries), so this block never re-runs during an animation frame.

  const rotatingIds = new Set<number>();
  if (activeMove) {
    for (const c of cubies.current) {
      const coord =
        activeMove.axis === "x" ? c.x : activeMove.axis === "y" ? c.y : c.z;
      if (coord === activeMove.layer) rotatingIds.add(c.id);
    }
  }

  return (
    <group>
      {/* Rotating layer — driven imperatively via layerRef */}
      <group ref={layerRef}>
        {cubies.current.map((c) => {
          if (!rotatingIds.has(c.id)) return null;
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

      {/* Static cubies */}
      <group>
        {cubies.current.map((c) => {
          if (rotatingIds.has(c.id)) return null;
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
