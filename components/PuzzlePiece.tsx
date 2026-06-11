"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { RoundedBox } from "@react-three/drei";

// ─── Face definitions ──────────────────────────────────────────────────────

const FACE_COLORS: Record<string, string> = {
  right: "#B90000",
  left: "#FF5900",
  top: "#FFFFFF",
  bottom: "#FFD500",
  front: "#009B48",
  back: "#0046AD",
};

const FACE_DEFS = [
  { axis: "x" as const, dir: "pos" as const, key: "right" },
  { axis: "x" as const, dir: "neg" as const, key: "left" },
  { axis: "y" as const, dir: "pos" as const, key: "top" },
  { axis: "y" as const, dir: "neg" as const, key: "bottom" },
  { axis: "z" as const, dir: "pos" as const, key: "front" },
  { axis: "z" as const, dir: "neg" as const, key: "back" },
];

// ─── Props ─────────────────────────────────────────────────────────────────

interface Props {
  groupRef: (el: THREE.Group | null) => void;
  position: [number, number, number];
  origX: number;
  origY: number;
  origZ: number;
}

// ─── Geometry helpers ──────────────────────────────────────────────────────

function isOuter(
  axis: "x" | "y" | "z",
  dir: "pos" | "neg",
  gx: number,
  gy: number,
  gz: number,
): boolean {
  if (axis === "x") return dir === "pos" ? gx === 2 : gx === 0;
  if (axis === "y") return dir === "pos" ? gy === 2 : gy === 0;
  return dir === "pos" ? gz === 2 : gz === 0;
}

function getPortraitSlice(
  axis: "x" | "y" | "z",
  dir: "pos" | "neg",
  gx: number,
  gy: number,
  gz: number,
): [number, number] | null {
  if (!isOuter(axis, dir, gx, gy, gz)) return null;
  if (axis === "z" && dir === "pos") return [gx, 2 - gy];
  if (axis === "z" && dir === "neg") return [2 - gx, 2 - gy];
  if (axis === "x" && dir === "pos") return [2 - gz, 2 - gy];
  if (axis === "x" && dir === "neg") return [gz, 2 - gy];
  if (axis === "y" && dir === "pos") return [gx, gz];
  if (axis === "y" && dir === "neg") return [gx, 2 - gz];
  return null;
}

// ─── Material cache ────────────────────────────────────────────────────────
//
// Three tiers — materials are NEVER mutated after creation:
//
//   "inner"            → plain black, used for all inner faces
//   "plain:<color>"    → solid color sticker, used for outer faces UNTIL
//                        the portrait image has loaded
//   "img:<color>:<col>,<row>" → portrait-composited texture, built once
//                        the portrait is available; replaces plain in useMemo
//
// Because we never swap a texture on an existing material there is no
// one-frame black gap — each material is complete when first assigned.

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

function buildFaceCanvas(
  color: string,
  portrait: HTMLImageElement,
  slice: [number, number],
): HTMLCanvasElement {
  const S = 256;
  const BORDER = 10;
  const RADIUS = 28;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;

  // Dark background (shows at corners outside the rounded rect)
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, S, S);

  const bx = BORDER,
    by = BORDER;
  const bw = S - BORDER * 2,
    bh = S - BORDER * 2;

  function roundRect() {
    ctx.beginPath();
    ctx.moveTo(bx + RADIUS, by);
    ctx.lineTo(bx + bw - RADIUS, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + RADIUS);
    ctx.lineTo(bx + bw, by + bh - RADIUS);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - RADIUS, by + bh);
    ctx.lineTo(bx + RADIUS, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - RADIUS);
    ctx.lineTo(bx, by + RADIUS);
    ctx.quadraticCurveTo(bx, by, bx + RADIUS, by);
    ctx.closePath();
  }

  // Solid color base
  ctx.save();
  roundRect();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  // Portrait slice on top
  const [col, row] = slice;
  const sw = portrait.width / 3;
  const sh = portrait.height / 3;
  ctx.save();
  roundRect();
  ctx.clip();
  ctx.drawImage(portrait, col * sw, row * sh, sw, sh, bx, by, bw, bh);
  ctx.restore();

  return canvas;
}

function getCachedMaterial(
  color: string,
  portrait: HTMLImageElement | null,
  slice: [number, number] | null,
  outer: boolean,
): THREE.MeshStandardMaterial {
  // ── Inner face ──────────────────────────────────────────────────────────
  if (!outer) {
    const key = "inner";
    if (!materialCache.has(key)) {
      materialCache.set(
        key,
        new THREE.MeshStandardMaterial({
          color: "#111111",
          roughness: 0.25,
          metalness: 0,
        }),
      );
    }
    return materialCache.get(key)!;
  }

  // ── Outer face with portrait ────────────────────────────────────────────
  // Only create the portrait material once the image is fully loaded.
  if (portrait && slice) {
    const key = `img:${color}:${slice.join(",")}`;
    if (!materialCache.has(key)) {
      const canvas = buildFaceCanvas(color, portrait, slice);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      materialCache.set(
        key,
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.25,
          metalness: 0,
        }),
      );
    }
    return materialCache.get(key)!;
  }

  // ── Outer face — portrait not yet loaded ────────────────────────────────
  // Plain solid color — no texture to upload, nothing to swap later.
  const key = `plain:${color}`;
  if (!materialCache.has(key)) {
    materialCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.25,
        metalness: 0,
      }),
    );
  }
  return materialCache.get(key)!;
}

// ─── Shared body material ──────────────────────────────────────────────────

let sharedBodyMaterial: THREE.MeshStandardMaterial | null = null;
function getBodyMaterial() {
  if (!sharedBodyMaterial) {
    sharedBodyMaterial = new THREE.MeshStandardMaterial({
      color: "#111111",
      roughness: 0.5,
      metalness: 0,
    });
  }
  return sharedBodyMaterial;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function PuzzlePiece({
  groupRef,
  position,
  origX,
  origY,
  origZ,
}: Props) {
  const texture = useLoader(TextureLoader, "/portrait.jpg");
  const portrait = texture.image as HTMLImageElement | null;

  // Re-runs once when portrait goes from null → loaded.
  // On the first pass (no portrait) it hands out plain: materials.
  // On the second pass it looks up / creates img: materials — which are
  // already fully composited, so Three.js uploads a complete texture
  // with no intermediate black frame.
  const materials = useMemo(() => {
    return FACE_DEFS.map(({ axis, dir, key }) => {
      const outer = isOuter(axis, dir, origX, origY, origZ);
      const slice = outer
        ? getPortraitSlice(axis, dir, origX, origY, origZ)
        : null;
      return getCachedMaterial(FACE_COLORS[key], portrait, slice, outer);
    });
  }, [origX, origY, origZ, portrait]);

  return (
    <group ref={groupRef} position={position} renderOrder={1}>
      <RoundedBox
        args={[0.96, 0.96, 0.96]}
        radius={0.08}
        smoothness={4}
        castShadow={false}
        receiveShadow={false}
      >
        <primitive object={getBodyMaterial()} attach="material" />
      </RoundedBox>

      <mesh renderOrder={2} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[0.97, 0.97, 0.97]} />
        {materials.map((mat, i) => (
          <primitive key={i} object={mat} attach={`material-${i}`} />
        ))}
      </mesh>
    </group>
  );
}
