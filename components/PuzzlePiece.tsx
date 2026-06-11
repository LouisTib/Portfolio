"use client";

import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { RoundedBox } from "@react-three/drei";

useLoader.preload(TextureLoader, "/portrait.jpg");

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
  groupRef: (el: THREE.Group | null) => void;
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
  if (!outer) {
    const key = "inner";
    if (!materialCache.has(key)) {
      materialCache.set(
        key,
        new THREE.MeshStandardMaterial({
          color: "#111111",
          roughness: 0.25,
          metalness: 0,
          depthWrite: false, // inner faces never need to win the depth test
        }),
      );
    }
    return materialCache.get(key)!;
  }

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
          depthWrite: false, // sticker sits on top of body; skip depth writes
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      );
    }
    return materialCache.get(key)!;
  }

  const key = `plain:${color}`;
  if (!materialCache.has(key)) {
    materialCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.25,
        metalness: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
  }
  return materialCache.get(key)!;
}

let sharedBodyMaterial: THREE.MeshStandardMaterial | null = null;
function getBodyMaterial() {
  if (!sharedBodyMaterial) {
    sharedBodyMaterial = new THREE.MeshStandardMaterial({
      color: "#111111",
      roughness: 0.5,
      metalness: 0,
      // Body DOES write depth — it is the base surface
    });
  }
  return sharedBodyMaterial;
}

let sharedBoxGeometry: THREE.BoxGeometry | null = null;
function getBoxGeometry() {
  if (!sharedBoxGeometry) {
    sharedBoxGeometry = new THREE.BoxGeometry(0.97, 0.97, 0.97);
  }
  return sharedBoxGeometry;
}

export default function PuzzlePiece({
  groupRef,
  position,
  origX,
  origY,
  origZ,
}: Props) {
  const texture = useLoader(TextureLoader, "/portrait.jpg");
  const stickerRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const mesh = stickerRef.current;
    if (!mesh) return;
    const portrait = texture.image as HTMLImageElement | null;
    const mats = FACE_DEFS.map(({ axis, dir, key }) => {
      const outer = isOuter(axis, dir, origX, origY, origZ);
      const slice = outer
        ? getPortraitSlice(axis, dir, origX, origY, origZ)
        : null;
      return getCachedMaterial(FACE_COLORS[key], portrait, slice, outer);
    });
    mesh.material = mats;
  }, [texture, origX, origY, origZ]);

  return (
    <group ref={groupRef} position={position}>
      <RoundedBox
        args={[0.96, 0.96, 0.96]}
        radius={0.08}
        smoothness={4}
        castShadow={false}
        receiveShadow={false}
        material={getBodyMaterial()}
      />
      {/*
        renderOrder={1} ensures this draws after the body in the same pass.
        depthWrite=false (set on every material above) means it never occludes
        itself or neighbouring cubies — it just composites on top of whatever
        the depth buffer already accepted. Combined with polygonOffset this
        eliminates the z-fighting black flash entirely, even mid-rotation.
      */}
      <mesh
        ref={stickerRef}
        geometry={getBoxGeometry()}
        renderOrder={1}
        castShadow={false}
        receiveShadow={false}
      />
    </group>
  );
}
