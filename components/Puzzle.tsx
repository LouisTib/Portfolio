"use client";

import { useRef, forwardRef, useImperativeHandle, useCallback } from "react";
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

  // One ref per cubie — indexed by cubie.id — never remounted
  const cubieRefs = useRef<(THREE.Group | null)[]>(Array(27).fill(null));

  const queue = useRef<Move[]>([]);
  const history = useRef<Move[]>([]);
  const busy = useRef(false);
  const active = useRef<Move | null>(null);
  const elapsed = useRef(0);

  // Scratch objects — allocated once, reused every frame
  const _q = new THREE.Quaternion();
  const _axisVec = new THREE.Vector3();
  const _rot = new THREE.Matrix4();

  const startNextMove = useCallback(() => {
    if (queue.current.length === 0) {
      busy.current = false;
      active.current = null;
      return;
    }
    const move = queue.current.shift()!;
    active.current = move;
    elapsed.current = 0;
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

    const move = active.current;
    elapsed.current += dt * SPEED;
    const t = Math.min(elapsed.current / TARGET, 1);
    const angle = ease(t) * TARGET * move.dir;

    // Rotate every cubie in the active layer directly via its ref
    for (const c of cubies.current) {
      const coord = move.axis === "x" ? c.x : move.axis === "y" ? c.y : c.z;
      if (coord !== move.layer) continue;

      const groupEl = cubieRefs.current[c.id];
      if (!groupEl) continue;

      // Base position
      const bx = (c.x - 1) * SPACING;
      const by = (c.y - 1) * SPACING;
      const bz = (c.z - 1) * SPACING;

      if (move.axis === "x") {
        const cosA = Math.cos(angle),
          sinA = Math.sin(angle);
        groupEl.position.set(bx, by * cosA - bz * sinA, by * sinA + bz * cosA);
        groupEl.rotation.set(angle, 0, 0);
      } else if (move.axis === "y") {
        const cosA = Math.cos(angle),
          sinA = Math.sin(angle);
        groupEl.position.set(bx * cosA + bz * sinA, by, -bx * sinA + bz * cosA);
        groupEl.rotation.set(0, angle, 0);
      } else {
        const cosA = Math.cos(angle),
          sinA = Math.sin(angle);
        groupEl.position.set(bx * cosA - by * sinA, bx * sinA + by * cosA, bz);
        groupEl.rotation.set(0, 0, angle);
      }
    }

    if (t >= 1) {
      // Snap: bake rotation into each cubie's matrix and reset to resting position
      _axisVec.set(
        move.axis === "x" ? 1 : 0,
        move.axis === "y" ? 1 : 0,
        move.axis === "z" ? 1 : 0,
      );
      _rot.makeRotationAxis(_axisVec, (Math.PI / 2) * move.dir);

      for (const c of cubies.current) {
        const coord = move.axis === "x" ? c.x : move.axis === "y" ? c.y : c.z;
        if (coord !== move.layer) continue;

        // Update logical position
        const px = c.x - 1,
          py = c.y - 1,
          pz = c.z - 1;
        if (move.axis === "x") {
          c.y = Math.round(-pz * move.dir) + 1;
          c.z = Math.round(py * move.dir) + 1;
        } else if (move.axis === "y") {
          c.x = Math.round(pz * move.dir) + 1;
          c.z = Math.round(-px * move.dir) + 1;
        } else {
          c.x = Math.round(-py * move.dir) + 1;
          c.y = Math.round(px * move.dir) + 1;
        }

        // Bake into accumulated matrix
        c.matrix = _rot.clone().multiply(c.matrix);

        // Reset the group to its new resting transform
        const groupEl = cubieRefs.current[c.id];
        if (groupEl) {
          groupEl.position.set(
            (c.x - 1) * SPACING,
            (c.y - 1) * SPACING,
            (c.z - 1) * SPACING,
          );
          groupEl.rotation.set(0, 0, 0);
          // Apply accumulated orientation
          _q.setFromRotationMatrix(c.matrix);
          groupEl.quaternion.copy(_q);
        }
      }

      active.current = null;
      startNextMove();
    }
  });

  return (
    <group>
      {cubies.current.map((c) => (
        <PuzzlePiece
          key={c.id}
          groupRef={(el) => {
            cubieRefs.current[c.id] = el;
          }}
          position={[
            (c.x - 1) * SPACING,
            (c.y - 1) * SPACING,
            (c.z - 1) * SPACING,
          ]}
          origX={c.homeX}
          origY={c.homeY}
          origZ={c.homeZ}
        />
      ))}
    </group>
  );
});
