"use client";

import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
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

// ─── Intro timing ───────────────────────────────────────────────────────────
// Each cubie takes INTRO_DURATION seconds to fly in.
// They start staggered by INTRO_STAGGER seconds apart (in a shuffled order).
const INTRO_STAGGER = 0.09; // seconds between each cubie starting
const INTRO_DURATION = 2.2; // how long each individual cubie takes to arrive

// Total wall-clock time (in seconds) for the full intro animation to finish —
// i.e. the moment the last (most-delayed) cubie arrives at its home position.
// Exported so other UI (e.g. the page header/footer text) can sync its own
// entrance animation to land right as this completes.
export const INTRO_TOTAL_DURATION = 26 * INTRO_STAGGER + INTRO_DURATION;

// ─── Easing ──────────────────────────────────────────────────────────────────
// easeOutQuart — smooth deceleration, zero bounce/overshoot (Lego-style)
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

// Ease for rotation moves (existing)
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
  explode: () => void;
  condense: () => void;
  isBusy: () => boolean;
  isExploded: () => boolean;
}

// ─── Random off-screen spawn positions ───────────────────────────────────────
// Guarantees even spread across all 6 directions by assigning faces via
// round-robin through a shuffled face list, then using a seeded LCG only
// to vary the position *within* each face. This prevents LCG clustering.
function buildRandomOffscreenPositions(count: number): THREE.Vector3[] {
  // Tiny seeded LCG — only used for position offsets, not face selection
  function seededRand(seed: number): () => number {
    let s = (seed ^ 0xdeadbeef) >>> 0;
    return () => {
      s = Math.imul(s ^ (s >>> 15), s | 1);
      s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
      return ((s ^ (s >>> 14)) >>> 0) / 0xffffffff;
    };
  }

  // Only left/right/top/bottom — Z (front/back) is inside the frustum
  // so cubies there would be visibly "popping in" regardless of distance.
  // faces: 0=+x (right)  1=-x (left)  2=+y (top)  3=-y (bottom)
  const faceList: number[] = [];
  for (let i = 0; i < count; i++) faceList.push(i % 4);
  // Deterministic shuffle of the face list
  let ss = 0x1337cafe;
  const sfRand = () => {
    ss = Math.imul(ss ^ (ss >>> 15), ss | 1);
    ss ^= ss + Math.imul(ss ^ (ss >>> 7), ss | 61);
    return ((ss ^ (ss >>> 14)) >>> 0) / 0xffffffff;
  };
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(sfRand() * (i + 1));
    [faceList[i], faceList[j]] = [faceList[j], faceList[i]];
  }

  return Array.from({ length: count }, (_, i) => {
    const rand = seededRand(i * 0x9e3779b9 + 0x6c62272e);
    const face = faceList[i];

    const spread = 22;
    const dist = 38 + rand() * 18; // 38–56 units out — well off screen
    const a = (rand() - 0.5) * spread;
    const b = (rand() - 0.5) * spread;

    // Keep z near 0 so cubies travel at roughly the same depth as the cube,
    // never behind or in front of the camera frustum
    const zOffset = (rand() - 0.5) * 4;
    let x = 0,
      y = 0,
      z = zOffset;
    switch (face) {
      case 0:
        x = dist;
        y = a;
        break; // right
      case 1:
        x = -dist;
        y = a;
        break; // left
      case 2:
        x = a;
        y = dist;
        break; // top
      case 3:
        x = a;
        y = -dist;
        break; // bottom
    }

    return new THREE.Vector3(x, y, z);
  });
}

// ─── Randomised stagger order ─────────────────────────────────────────────────
// Shuffle 0..26 so cubies don't just appear in grid order
function buildStaggerOrder(count: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  // Deterministic Fisher-Yates using the same seed trick
  let s = 99991;
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order; // staggerOrder[cubieId] = its stagger index
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
  // True only after gl.compile() has finished pre-warming all shaders
  const introReady = useRef(false);

  // ── Explode animation state ───────────────────────────────────────────────
  // phases: 'idle' | 'out' | 'hang' | 'in'
  const explodePhase = useRef<"idle" | "out" | "hang" | "in">("idle");
  const explodeElapsed = useRef(0);
  // Per-cubie explode target positions (randomised scatter from cube center)
  const explodeTargets = useRef<THREE.Vector3[]>([]);
  // Per-cubie random spin axis/speed while exploded
  const explodeSpinAxes = useRef<THREE.Vector3[]>([]);
  const explodeSpinSpeeds = useRef<number[]>([]);
  // Accumulated spin quaternion (relative to the cubie's resting orientation)
  const explodeSpinQuat = useRef<THREE.Quaternion[]>([]);
  // Each cubie's resting orientation at the moment explode was triggered
  const explodeBaseQuat = useRef<THREE.Quaternion[]>([]);
  // Snapshot of the spin quaternion at the start of the "in" phase, so it
  // can be slerped back to rest as the cubie flies home
  const explodeInStartQuat = useRef<THREE.Quaternion[]>([]);

  const EXPLODE_OUT_DUR = 0.6; // seconds to scatter outward
  const EXPLODE_IN_DUR = 0.9; // seconds to return home

  function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
  }
  function easeInOutQuart(t: number) {
    return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
  }

  // Stable off-screen positions and stagger order (computed once)
  const spawnPositions = useRef<THREE.Vector3[]>(
    buildRandomOffscreenPositions(27),
  );
  const staggerOrder = useRef<number[]>(buildStaggerOrder(27));
  const { gl, scene, camera } = useThree();

  // Pre-compile all shaders before starting the intro so there's no lag spike
  // on the first animated frame. gl.compile() is synchronous on the GPU side.
  useEffect(() => {
    // A short rAF delay ensures React has flushed all groupRef callbacks
    // and the scene graph is fully populated before we compile.
    const id = requestAnimationFrame(() => {
      gl.compile(scene, camera);
      introReady.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [gl, scene, camera]);

  const _q = new THREE.Quaternion();
  const _qSpin = new THREE.Quaternion();
  const _axisVec = new THREE.Vector3();
  const _rot = new THREE.Matrix4();
  const _tmp = new THREE.Vector3();
  const _dq = new THREE.Quaternion();
  const _slerpQuat = new THREE.Quaternion();
  const _identityQuat = new THREE.Quaternion();

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
    explode() {
      if (busy.current || !introDone.current || explodePhase.current !== "idle")
        return;

      explodeTargets.current = [];
      explodeSpinAxes.current = [];
      explodeSpinSpeeds.current = [];
      explodeSpinQuat.current = [];
      explodeBaseQuat.current = [];
      explodeInStartQuat.current = [];

      for (const c of cubies.current) {
        const home = new THREE.Vector3(
          (c.x - 1) * SPACING,
          (c.y - 1) * SPACING,
          (c.z - 1) * SPACING,
        );

        // Mostly-radial direction with extra jitter so the scatter reads as
        // organic/random rather than a perfectly even robotic burst.
        const dir = new THREE.Vector3(
          home.x + (Math.random() - 0.5) * 1.8,
          home.y + (Math.random() - 0.5) * 1.8,
          home.z + (Math.random() - 0.5) * 1.8,
        );
        if (dir.lengthSq() < 0.0001) {
          dir.set(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5,
          );
        }
        dir.normalize();

        const dist = 2.2 + Math.random() * 2.8;
        explodeTargets.current.push(home.clone().add(dir.multiplyScalar(dist)));

        // Random spin axis + slow angular speed (rad/s), random direction
        const axis = new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5,
        );
        if (axis.lengthSq() < 0.0001) axis.set(0, 1, 0);
        axis.normalize();
        explodeSpinAxes.current.push(axis);
        explodeSpinSpeeds.current.push(
          (0.35 + Math.random() * 0.75) * (Math.random() < 0.5 ? -1 : 1),
        );

        explodeSpinQuat.current.push(new THREE.Quaternion());
        explodeInStartQuat.current.push(new THREE.Quaternion());

        _q.setFromRotationMatrix(c.matrix);
        explodeBaseQuat.current.push(_q.clone());
      }

      // Relax target positions apart so cubies don't end up overlapping
      // each other (which reads as "going into" one another mid-air).
      const MIN_SEP = 1.2; // a cubie is ~1 unit across, give a little buffer
      for (let iter = 0; iter < 8; iter++) {
        for (let i = 0; i < explodeTargets.current.length; i++) {
          for (let j = i + 1; j < explodeTargets.current.length; j++) {
            const a = explodeTargets.current[i];
            const b = explodeTargets.current[j];
            const diff = a.clone().sub(b);
            const dist = diff.length();
            if (dist < 1e-4) {
              const jitter = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5,
              )
                .normalize()
                .multiplyScalar(MIN_SEP / 2);
              a.add(jitter);
              b.sub(jitter);
            } else if (dist < MIN_SEP) {
              const push = diff
                .normalize()
                .multiplyScalar((MIN_SEP - dist) / 2);
              a.add(push);
              b.sub(push);
            }
          }
        }
      }

      explodeElapsed.current = 0;
      explodePhase.current = "out";
      busy.current = true;
    },
    condense() {
      // Only meaningful while the pieces are hanging out in their
      // exploded/expanded state.
      if (explodePhase.current !== "hang") return;
      for (const c of cubies.current) {
        explodeInStartQuat.current[c.id].copy(explodeSpinQuat.current[c.id]);
      }
      explodeElapsed.current = 0;
      explodePhase.current = "in";
      busy.current = true;
    },
    isBusy() {
      return busy.current || !introDone.current;
    },
    isExploded() {
      return explodePhase.current === "hang";
    },
  }));

  useFrame((_, dt) => {
    // ── Intro animation ──────────────────────────────────────────────────────
    if (!introDone.current) {
      if (!introReady.current) return;
      introElapsed.current += dt;
      let allDone = true;

      for (const c of cubies.current) {
        const groupEl = cubieRefs.current[c.id];
        if (!groupEl) continue;

        // Each cubie gets a delay based on its randomised stagger rank
        const staggerRank = staggerOrder.current[c.id];
        const delay = staggerRank * INTRO_STAGGER;
        const localT = (introElapsed.current - delay) / INTRO_DURATION;

        const homePos = new THREE.Vector3(
          (c.homeX - 1) * SPACING,
          (c.homeY - 1) * SPACING,
          (c.homeZ - 1) * SPACING,
        );

        if (localT <= 0) {
          // Not yet started — stay hidden at spawn position
          groupEl.position.copy(spawnPositions.current[c.id]);
          groupEl.visible = false;
          allDone = false;
        } else if (localT >= 1) {
          // Finished — lock to home
          groupEl.position.copy(homePos);
          groupEl.visible = true;
        } else {
          // In flight
          allDone = false;
          groupEl.visible = true;
          const t = easeOutQuart(localT);
          _tmp.lerpVectors(spawnPositions.current[c.id], homePos, t);
          groupEl.position.copy(_tmp);
        }
      }

      if (allDone) {
        introDone.current = true;
        // Snap everything exactly to home
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

    // ── Explode animation ────────────────────────────────────────────────────
    if (explodePhase.current !== "idle") {
      explodeElapsed.current += dt;

      if (explodePhase.current === "out") {
        const t = Math.min(explodeElapsed.current / EXPLODE_OUT_DUR, 1);
        const et = easeOutCubic(t);
        for (const c of cubies.current) {
          const groupEl = cubieRefs.current[c.id];
          if (!groupEl) continue;
          const home = new THREE.Vector3(
            (c.x - 1) * SPACING,
            (c.y - 1) * SPACING,
            (c.z - 1) * SPACING,
          );
          _tmp.lerpVectors(home, explodeTargets.current[c.id], et);
          groupEl.position.copy(_tmp);

          // Slowly accumulate a random spin as the cubie flies outward
          _dq.setFromAxisAngle(
            explodeSpinAxes.current[c.id],
            explodeSpinSpeeds.current[c.id] * dt,
          );
          explodeSpinQuat.current[c.id].premultiply(_dq);
          groupEl.quaternion
            .copy(explodeBaseQuat.current[c.id])
            .multiply(explodeSpinQuat.current[c.id]);
        }
        if (t >= 1) {
          explodePhase.current = "hang";
          explodeElapsed.current = 0;
          // Pieces now sit in their expanded state until the user chooses
          // to condense them back — release "busy" so the Condense button
          // (and isExploded()) become available.
          busy.current = false;
        }
      } else if (explodePhase.current === "hang") {
        for (const c of cubies.current) {
          const groupEl = cubieRefs.current[c.id];
          if (!groupEl) continue;
          // Keep slowly spinning in place while hanging at the peak
          _dq.setFromAxisAngle(
            explodeSpinAxes.current[c.id],
            explodeSpinSpeeds.current[c.id] * dt,
          );
          explodeSpinQuat.current[c.id].premultiply(_dq);
          groupEl.quaternion
            .copy(explodeBaseQuat.current[c.id])
            .multiply(explodeSpinQuat.current[c.id]);
        }
        // Stays in "hang" indefinitely — condense() (triggered by the user)
        // is what kicks off the "in" phase.
      } else if (explodePhase.current === "in") {
        const t = Math.min(explodeElapsed.current / EXPLODE_IN_DUR, 1);
        const et = easeInOutQuart(t);
        for (const c of cubies.current) {
          const groupEl = cubieRefs.current[c.id];
          if (!groupEl) continue;
          const home = new THREE.Vector3(
            (c.x - 1) * SPACING,
            (c.y - 1) * SPACING,
            (c.z - 1) * SPACING,
          );
          _tmp.lerpVectors(explodeTargets.current[c.id], home, et);
          groupEl.position.copy(_tmp);

          // Ease the spin back to the cubie's resting orientation as it
          // returns home, so it settles in clean rather than snapping.
          _slerpQuat.copy(explodeInStartQuat.current[c.id]);
          _slerpQuat.slerp(_identityQuat, et);
          groupEl.quaternion
            .copy(explodeBaseQuat.current[c.id])
            .multiply(_slerpQuat);
        }
        if (t >= 1) {
          // Snap home and clear
          for (const c of cubies.current) {
            const groupEl = cubieRefs.current[c.id];
            if (groupEl) {
              groupEl.position.set(
                (c.x - 1) * SPACING,
                (c.y - 1) * SPACING,
                (c.z - 1) * SPACING,
              );
              groupEl.quaternion.copy(explodeBaseQuat.current[c.id]);
            }
          }
          explodePhase.current = "idle";
          busy.current = false;
        }
      }
      return;
    }

    // ── Rotation move animation ───────────────────────────────────────────────
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
            if (!el) return;
            cubieRefs.current[c.id] = el;
            // Only hide on the initial mount (before intro finishes).
            // If React re-renders after intro is done (e.g. useThree causes
            // a re-render), don't clobber the position/visibility.
            if (!introDone.current) {
              el.visible = false;
              el.position.set(9999, 9999, 9999);
            }
          }}
          position={[9999, 9999, 9999]}
          origX={c.homeX}
          origY={c.homeY}
          origZ={c.homeZ}
        />
      ))}
    </group>
  );
});
