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

export type Move = {
  axis: "x" | "y" | "z";
  layer: number;
  dir: 1 | -1;
};

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
      dir: (Math.random() > 0.5 ? 1 : -1) as 1 | -1,
    });
  }
  return moves;
}

function rotPos(
  x: number,
  y: number,
  z: number,
  axis: Move["axis"],
  dir: 1 | -1,
): [number, number, number] {
  const cx = x - 1,
    cy = y - 1,
    cz = z - 1;
  if (axis === "x")
    return [x, Math.round(-cz * dir) + 1, Math.round(cy * dir) + 1];
  if (axis === "y")
    return [Math.round(cz * dir) + 1, y, Math.round(-cx * dir) + 1];
  return [Math.round(-cy * dir) + 1, Math.round(cx * dir) + 1, z];
}

export interface CubieState {
  id: number;
  x: number;
  y: number;
  z: number;
  matrix: THREE.Matrix4; // accumulated orientation
}

function applyMoveToState(cubies: CubieState[], move: Move): CubieState[] {
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
  return cubies.map((c) => {
    const coord = move.axis === "x" ? c.x : move.axis === "y" ? c.y : c.z;
    if (coord !== move.layer) return c;
    const [nx, ny, nz] = rotPos(c.x, c.y, c.z, move.axis, move.dir);
    return {
      ...c,
      x: nx,
      y: ny,
      z: nz,
      matrix: rot.clone().multiply(c.matrix),
    };
  });
}

export interface PuzzleHandle {
  shuffle: () => void;
  solve: () => void;
  isBusy: () => boolean;
}

function easeInOutQuint(t: number): number {
  return t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
}

export const SPACING = 1.01;
const TARGET = Math.PI / 2;
const SPEED = 4.2; // rad/s → ~0.37 s per move

const Puzzle = forwardRef<PuzzleHandle>((_, ref) => {
  const [cubies, setCubies] = useState<CubieState[]>(() =>
    Array.from({ length: 27 }, (_, i) => ({
      id: i,
      x: Math.floor(i / 9),
      y: Math.floor((i % 9) / 3),
      z: i % 3,
      matrix: new THREE.Matrix4(),
    })),
  );

  const cubiesRef = useRef<CubieState[]>(cubies);
  useEffect(() => {
    cubiesRef.current = cubies;
  }, [cubies]);

  const queue = useRef<Move[]>([]);
  const history = useRef<Move[]>([]);
  const busy = useRef(false);

  // Current animation — all imperative, lives in refs
  const animMove = useRef<Move | null>(null);
  const animElapsed = useRef(0);

  // The group that gets rotated for the active layer
  const layerGroupRef = useRef<THREE.Group>(null);

  // Tracks which cubies are in the layer group vs static group
  // We use a state variable so React re-partitions on move changes
  const [activeMove, setActiveMove] = useState<Move | null>(null);

  useImperativeHandle(ref, () => ({
    shuffle() {
      if (busy.current) return;
      busy.current = true;
      const moves = randomMoves(20);
      history.current = [...moves].reverse().map(inv);
      queue.current = [...moves];
      animMove.current = null;
    },
    solve() {
      if (busy.current) return;
      if (history.current.length === 0) return;
      busy.current = true;
      queue.current = [...history.current];
      history.current = [];
      animMove.current = null;
    },
    isBusy() {
      return busy.current;
    },
  }));

  useFrame((_, delta) => {
    // Start next move
    if (!animMove.current) {
      if (queue.current.length === 0) {
        busy.current = false;
        if (activeMove !== null) setActiveMove(null);
        return;
      }
      const move = queue.current.shift()!;
      animMove.current = move;
      animElapsed.current = 0;
      // Reset layer group rotation
      if (layerGroupRef.current) layerGroupRef.current.rotation.set(0, 0, 0);
      // Tell React which layer is active so it moves cubies into layerGroup
      setActiveMove(move);
      return; // give React one frame to re-partition
    }

    animElapsed.current = Math.min(animElapsed.current + delta * SPEED, TARGET);
    const t = animElapsed.current / TARGET;
    const angle = easeInOutQuint(t) * TARGET * animMove.current.dir;

    if (layerGroupRef.current) {
      const ax = animMove.current.axis;
      layerGroupRef.current.rotation.set(
        ax === "x" ? angle : 0,
        ax === "y" ? angle : 0,
        ax === "z" ? angle : 0,
      );
    }

    if (animElapsed.current >= TARGET) {
      // Bake move into logical state
      const completed = animMove.current;
      animMove.current = null;
      if (layerGroupRef.current) layerGroupRef.current.rotation.set(0, 0, 0);

      setCubies((prev) => {
        const next = applyMoveToState(prev, completed);
        cubiesRef.current = next;
        return next;
      });
      setActiveMove(null);
    }
  });

  // Partition cubies into the active layer vs the rest
  const layerIds = new Set<number>();
  if (activeMove) {
    cubies.forEach((c) => {
      const coord =
        activeMove.axis === "x" ? c.x : activeMove.axis === "y" ? c.y : c.z;
      if (coord === activeMove.layer) layerIds.add(c.id);
    });
  }

  return (
    <group>
      {/* Static cubies */}
      <group>
        {cubies
          .filter((c) => !layerIds.has(c.id))
          .map((c) => (
            <PuzzlePiece
              key={c.id}
              matrix={c.matrix}
              position={[
                (c.x - 1) * SPACING,
                (c.y - 1) * SPACING,
                (c.z - 1) * SPACING,
              ]}
              origX={c.x}
              origY={c.y}
              origZ={c.z}
            />
          ))}
      </group>

      {/* Rotating layer group */}
      <group ref={layerGroupRef}>
        {cubies
          .filter((c) => layerIds.has(c.id))
          .map((c) => (
            <PuzzlePiece
              key={c.id}
              matrix={c.matrix}
              position={[
                (c.x - 1) * SPACING,
                (c.y - 1) * SPACING,
                (c.z - 1) * SPACING,
              ]}
              origX={c.x}
              origY={c.y}
              origZ={c.z}
            />
          ))}
      </group>
    </group>
  );
});

Puzzle.displayName = "Puzzle";
export default Puzzle;
