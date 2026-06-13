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

const SPACING = 1.0005;
const TARGET = Math.PI / 2;
const SPEED = 4.2;

const INTRO_STAGGER = 0.11;
const INTRO_DURATION = 1.6;

function ease(t: number) {
  return t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
}

function easeIntro(t: number): number {
  const c1 = 1.15;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
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

// Camera is at [6, 4, 11] looking at origin.
// We want cubies to start completely off-screen to the top-right.
// Push them far in X and Y, and behind the camera in Z so they're
// well outside the frustum before they sweep in.
function buildStreamPositions(count: number): THREE.Vector3[] {
  // Origin point: far top-right, behind the camera's right shoulder
  const origin = new THREE.Vector3(60, 40, 30);
  // Direction they're stacked along — trailing back further top-right
  const streamDir = new THREE.Vector3(1, 0.8, 0.5).normalize();
  const gap = 3.5;

  return Array.from({ length: count }, (_, i) => {
    const offset = (count - 1 - i) * gap;
    return origin.clone().add(streamDir.clone().multiplyScalar(offset));
  });
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

  const cubieRefs = useRef<(THREE.Group | null)[]>(Array(27).fill(null));
  const queue = useRef<Move[]>([]);
  const history = useRef<Move[]>([]);
  const busy = useRef(false);
  const active = useRef<Move | null>(null);
  const elapsed = useRef(0);
  const introElapsed = useRef(0);
  const introDone = useRef(false);
  const streamStarts = useRef<THREE.Vector3[]>(buildStreamPositions(27));

  const _q = new THREE.Quaternion();
  const _qSpin = new THREE.Quaternion();
  const _axisVec = new THREE.Vector3();
  const _rot = new THREE.Matrix4();
  const _tmp = new THREE.Vector3();

  const startNextMove = useCallback(() => {
    if (queue.current.length === 0) {
      busy.current = false;
      active.current = null;
      return;
    }
    active.current = queue.current.shift()!;
    elapsed.current = 0;
  }, []);

  useImperativeHandle(ref, () => ({
    shuffle() {
      if (busy.current || !introDone.current) return;
      const moves = randomMoves(20);
      history.current = [...moves].reverse().map(inv).concat(history.current);
      queue.current = moves;
      busy.current = true;
      startNextMove();
    },
    solve() {
      if (busy.current || !introDone.current) return;
      queue.current = history.current;
      history.current = [];
      busy.current = true;
      startNextMove();
    },
    isBusy() {
      return busy.current || !introDone.current;
    },
  }));

  useFrame((_, dt) => {
    if (!introDone.current) {
      introElapsed.current += dt;
      const totalDuration = INTRO_STAGGER * 26 + INTRO_DURATION;
      let allDone = true;

      for (const c of cubies.current) {
        const groupEl = cubieRefs.current[c.id];
        if (!groupEl) continue;

        const delay = c.id * INTRO_STAGGER;
        const localT = (introElapsed.current - delay) / INTRO_DURATION;

        const homePos = new THREE.Vector3(
          (c.homeX - 1) * SPACING,
          (c.homeY - 1) * SPACING,
          (c.homeZ - 1) * SPACING,
        );

        if (localT <= 0) {
          groupEl.position.copy(streamStarts.current[c.id]);
          groupEl.visible = false;
          allDone = false;
        } else if (localT >= 1) {
          groupEl.position.copy(homePos);
          groupEl.visible = true;
        } else {
          allDone = false;
          groupEl.visible = true;
          const t = easeIntro(Math.min(localT, 1));
          _tmp.lerpVectors(streamStarts.current[c.id], homePos, t);
          groupEl.position.copy(_tmp);
        }
      }

      if (allDone) {
        introDone.current = true;
        for (const c of cubies.current) {
          const groupEl = cubieRefs.current[c.id];
          if (groupEl) {
            groupEl.visible = true;
            groupEl.position.set(
              (c.x - 1) * SPACING,
              (c.y - 1) * SPACING,
              (c.z - 1) * SPACING,
            );
          }
        }
      }
      return;
    }

    if (!active.current) return;
    const move = active.current;
    elapsed.current += dt * SPEED;
    const t = Math.min(elapsed.current / TARGET, 1);
    const angle = ease(t) * TARGET * move.dir;

    _axisVec.set(
      move.axis === "x" ? 1 : 0,
      move.axis === "y" ? 1 : 0,
      move.axis === "z" ? 1 : 0,
    );
    _qSpin.setFromAxisAngle(_axisVec, angle);

    for (const c of cubies.current) {
      const coord = move.axis === "x" ? c.x : move.axis === "y" ? c.y : c.z;
      if (coord !== move.layer) continue;
      const groupEl = cubieRefs.current[c.id];
      if (!groupEl) continue;

      const bx = (c.x - 1) * SPACING,
        by = (c.y - 1) * SPACING,
        bz = (c.z - 1) * SPACING;
      if (move.axis === "x") {
        const cosA = Math.cos(angle),
          sinA = Math.sin(angle);
        groupEl.position.set(bx, by * cosA - bz * sinA, by * sinA + bz * cosA);
      } else if (move.axis === "y") {
        const cosA = Math.cos(angle),
          sinA = Math.sin(angle);
        groupEl.position.set(bx * cosA + bz * sinA, by, -bx * sinA + bz * cosA);
      } else {
        const cosA = Math.cos(angle),
          sinA = Math.sin(angle);
        groupEl.position.set(bx * cosA - by * sinA, bx * sinA + by * cosA, bz);
      }
      _q.setFromRotationMatrix(c.matrix);
      groupEl.quaternion.copy(_qSpin).multiply(_q);
    }

    if (t >= 1) {
      _axisVec.set(
        move.axis === "x" ? 1 : 0,
        move.axis === "y" ? 1 : 0,
        move.axis === "z" ? 1 : 0,
      );
      _rot.makeRotationAxis(_axisVec, (Math.PI / 2) * move.dir);

      for (const c of cubies.current) {
        const coord = move.axis === "x" ? c.x : move.axis === "y" ? c.y : c.z;
        if (coord !== move.layer) continue;
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
        c.matrix = _rot.clone().multiply(c.matrix);
        const groupEl = cubieRefs.current[c.id];
        if (groupEl) {
          groupEl.position.set(
            (c.x - 1) * SPACING,
            (c.y - 1) * SPACING,
            (c.z - 1) * SPACING,
          );
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
            (c.homeX - 1) * SPACING,
            (c.homeY - 1) * SPACING,
            (c.homeZ - 1) * SPACING,
          ]}
          origX={c.homeX}
          origY={c.homeY}
          origZ={c.homeZ}
        />
      ))}
    </group>
  );
});
