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
  {
    axis: "x" as const,
    dir: "pos" as const,
    key: "right",
    rotation: [0, Math.PI / 2, 0] as [number, number, number],
    offset: [0.482, 0, 0] as [number, number, number],
  },
  {
    axis: "x" as const,
    dir: "neg" as const,
    key: "left",
    rotation: [0, -Math.PI / 2, 0] as [number, number, number],
    offset: [-0.482, 0, 0] as [number, number, number],
  },
  {
    axis: "y" as const,
    dir: "pos" as const,
    key: "top",
    rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
    offset: [0, 0.482, 0] as [number, number, number],
  },
  {
    axis: "y" as const,
    dir: "neg" as const,
    key: "bottom",
    rotation: [Math.PI / 2, 0, 0] as [number, number, number],
    offset: [0, -0.482, 0] as [number, number, number],
  },
  {
    axis: "z" as const,
    dir: "pos" as const,
    key: "front",
    rotation: [0, 0, 0] as [number, number, number],
    offset: [0, 0, 0.482] as [number, number, number],
  },
  {
    axis: "z" as const,
    dir: "neg" as const,
    key: "back",
    rotation: [0, Math.PI, 0] as [number, number, number],
    offset: [0, 0, -0.482] as [number, number, number],
  },
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

// Build and cache materials eagerly given a fully-loaded portrait image.
// This is called once per cubie after the texture is confirmed loaded.
function buildMaterials(
  origX: number,
  origY: number,
  origZ: number,
  portrait: HTMLImageElement,
): (THREE.MeshStandardMaterial | null)[] {
  return FACE_DEFS.map(({ axis, dir, key }) => {
    const outer = isOuter(axis, dir, origX, origY, origZ);
    if (!outer) return null;

    const slice = getPortraitSlice(axis, dir, origX, origY, origZ);

    if (slice) {
      const cacheKey = `img:${FACE_COLORS[key]}:${slice.join(",")}`;
      if (!materialCache.has(cacheKey)) {
        const canvas = buildFaceCanvas(FACE_COLORS[key], portrait, slice);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        materialCache.set(
          cacheKey,
          new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.25,
            metalness: 0,
          }),
        );
      }
      return materialCache.get(cacheKey)!;
    }

    const cacheKey = `plain:${FACE_COLORS[key]}`;
    if (!materialCache.has(cacheKey)) {
      materialCache.set(
        cacheKey,
        new THREE.MeshStandardMaterial({
          color: FACE_COLORS[key],
          roughness: 0.25,
          metalness: 0,
        }),
      );
    }
    return materialCache.get(cacheKey)!;
  });
}

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

let sharedPlaneGeometry: THREE.PlaneGeometry | null = null;
function getPlaneGeometry() {
  if (!sharedPlaneGeometry) {
    sharedPlaneGeometry = new THREE.PlaneGeometry(0.93, 0.93);
  }
  return sharedPlaneGeometry;
}

export default function PuzzlePiece({
  groupRef,
  position,
  origX,
  origY,
  origZ,
}: Props) {
  const texture = useLoader(TextureLoader, "/portrait.jpg");

  // Store materials in a ref so they are never recomputed after first build.
  // This prevents the black-flash caused by useMemo re-running mid-animation.
  const materialsRef = useRef<(THREE.MeshStandardMaterial | null)[] | null>(
    null,
  );
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  useEffect(() => {
    const portrait = texture.image as HTMLImageElement | null;
    if (!portrait || !portrait.complete || portrait.naturalWidth === 0) return;
    if (materialsRef.current) return; // already built — never rebuild

    materialsRef.current = buildMaterials(origX, origY, origZ, portrait);

    // Apply to meshes immediately
    materialsRef.current.forEach((mat, i) => {
      const mesh = meshRefs.current[i];
      if (mesh && mat) mesh.material = mat;
    });
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
      {FACE_DEFS.map(({ axis, dir, key, rotation, offset }, i) => {
        const outer = isOuter(axis, dir, origX, origY, origZ);
        if (!outer) return null;
        return (
          <mesh
            key={key}
            ref={(el) => {
              meshRefs.current[i] = el;
            }}
            geometry={getPlaneGeometry()}
            position={offset}
            rotation={rotation}
            castShadow={false}
            receiveShadow={false}
          />
        );
      })}
    </group>
  );
}
