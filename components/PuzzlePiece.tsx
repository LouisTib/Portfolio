"use client";

import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { RoundedBox } from "@react-three/drei";

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

interface Props {
  matrix: THREE.Matrix4;
  position: [number, number, number];
  origX: number;
  origY: number;
  origZ: number;
}

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

// ─── Global material cache ─────────────────────────────────────────────────
// Keyed by a string that uniquely identifies this face sticker.
// Materials and their textures are NEVER disposed — they live for the page
// lifetime and are shared across all pieces. This prevents the flash that
// occurs when a piece unmounts (rotating↔static group swap) and dispose()
// invalidates a texture that other pieces are still using.
const materialCache = new Map<string, THREE.MeshStandardMaterial>();

function buildFaceCanvas(
  color: string,
  portrait: HTMLImageElement | null,
  slice: [number, number] | null,
): HTMLCanvasElement {
  const S = 256;
  const BORDER = 10;
  const RADIUS = 28;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;

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

  ctx.save();
  roundRect();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  if (portrait && slice) {
    const [col, row] = slice;
    const sw = portrait.width / 3;
    const sh = portrait.height / 3;
    ctx.save();
    roundRect();
    ctx.clip();
    ctx.drawImage(portrait, col * sw, row * sh, sw, sh, bx, by, bw, bh);
    ctx.restore();
  }

  return canvas;
}

function getCachedMaterial(
  color: string,
  portrait: HTMLImageElement | null,
  slice: [number, number] | null,
  outer: boolean,
): THREE.MeshStandardMaterial {
  const key = outer
    ? `outer:${color}:${slice ? slice.join(",") : "none"}:${portrait ? "img" : "noimg"}`
    : "inner";

  const cached = materialCache.get(key);
  if (cached) return cached;

  let mat: THREE.MeshStandardMaterial;

  if (!outer) {
    // Inner faces: plain black, no texture needed
    mat = new THREE.MeshStandardMaterial({
      color: "#111111",
      roughness: 0.25,
      metalness: 0,
    });
  } else {
    const canvas = buildFaceCanvas(color, portrait, slice);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;

    mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.25,
      metalness: 0,
    });
  }

  materialCache.set(key, mat);
  return mat;
}

// Portrait-loaded versions replace the noimg entries once the image is ready.
// We track which keys need upgrading so we don't redo work.
const upgradedKeys = new Set<string>();

function upgradePortraitMaterials(portrait: HTMLImageElement) {
  for (const [key, mat] of materialCache.entries()) {
    if (!key.startsWith("outer:") || !key.endsWith(":noimg")) continue;
    if (upgradedKeys.has(key)) continue;

    // Parse the key back to color + slice
    // format: outer:<color>:<col,row|none>:noimg
    const parts = key.split(":");
    const color = parts[1];
    const sliceStr = parts[2];
    const slice: [number, number] | null =
      sliceStr === "none"
        ? null
        : (sliceStr.split(",").map(Number) as [number, number]);

    const canvas = buildFaceCanvas(color, portrait, slice);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;

    // Swap the texture on the existing material in place — no remount needed
    if (mat.map) mat.map.dispose();
    mat.map = tex;
    mat.needsUpdate = true;

    // Also store the upgraded version under the "img" key so future pieces
    // get it directly without going through the noimg path.
    const imgKey = key.replace(":noimg", ":img");
    materialCache.set(imgKey, mat);

    upgradedKeys.add(key);
  }
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

export default function PuzzlePiece({
  matrix,
  position,
  origX,
  origY,
  origZ,
}: Props) {
  const texture = useLoader(TextureLoader, "/portrait.jpg");
  const portrait = texture.image as HTMLImageElement | null;

  // Upgrade any noimg cached materials once the portrait is available.
  // This runs once per component instance after portrait loads, but
  // upgradePortraitMaterials is idempotent via upgradedKeys.
  if (portrait) upgradePortraitMaterials(portrait);

  // Look up (or create) fully cached materials — stable references,
  // zero allocation after the first render.
  const materials = useMemo(() => {
    return FACE_DEFS.map(({ axis, dir, key }) => {
      const outer = isOuter(axis, dir, origX, origY, origZ);
      const slice = outer
        ? getPortraitSlice(axis, dir, origX, origY, origZ)
        : null;
      return getCachedMaterial(FACE_COLORS[key], portrait, slice, outer);
    });
  }, [origX, origY, origZ, portrait]);

  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current) return;
    const q = new THREE.Quaternion();
    q.setFromRotationMatrix(matrix);
    groupRef.current.quaternion.copy(q);
  }, [matrix]);

  // NO dispose — all materials are globally cached and shared.
  // Disposing on unmount would flash/black-out other pieces using the same material.

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
