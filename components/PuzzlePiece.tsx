"use client";

import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";

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
  if (axis === "x" && dir === "pos") return [gz, 2 - gy];
  if (axis === "x" && dir === "neg") return [2 - gz, 2 - gy];
  if (axis === "y" && dir === "pos") return [gx, gz];
  if (axis === "y" && dir === "neg") return [gx, 2 - gz];
  return null;
}

function makeFaceTexture(
  color: string,
  portrait: HTMLImageElement | null,
  slice: [number, number] | null,
  outer: boolean,
): THREE.CanvasTexture {
  const S = 256,
    BORDER = 13,
    RADIUS = 9;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, S, S);
  if (!outer) return new THREE.CanvasTexture(canvas);

  const bx = BORDER,
    by = BORDER,
    bw = S - BORDER * 2,
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

  // Drop shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 1.5;
  ctx.shadowOffsetY = 2.5;
  roundRect();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  // Portrait
  if (portrait && slice) {
    const [col, row] = slice;
    const sw = portrait.width / 3,
      sh = portrait.height / 3;
    ctx.save();
    roundRect();
    ctx.clip();
    ctx.drawImage(portrait, col * sw, row * sh, sw, sh, bx, by, bw, bh);
    ctx.fillStyle = color + "22";
    ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
  }

  // Gloss
  ctx.save();
  roundRect();
  ctx.clip();
  const g = ctx.createLinearGradient(bx, by, bx + bw * 0.65, by + bh * 0.55);
  g.addColorStop(0, "rgba(255,255,255,0.30)");
  g.addColorStop(0.45, "rgba(255,255,255,0.07)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(bx, by, bw, bh);
  ctx.restore();

  // Rim highlight
  ctx.save();
  roundRect();
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  return new THREE.CanvasTexture(canvas);
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

  const materials = useMemo(() => {
    return FACE_DEFS.map(({ axis, dir, key }) => {
      const outer = isOuter(axis, dir, origX, origY, origZ);
      const slice = getPortraitSlice(axis, dir, origX, origY, origZ);
      const color = FACE_COLORS[key] ?? "#1a1a1a";
      return new THREE.MeshStandardMaterial({
        map: makeFaceTexture(color, portrait, slice, outer),
        roughness: 0.12,
        metalness: 0.0,
        envMapIntensity: 1.2,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origX, origY, origZ, portrait]);

  const meshRef = useRef<THREE.Mesh>(null);

  // Decompose the accumulated rotation matrix and apply it to the mesh
  useEffect(() => {
    if (!meshRef.current) return;
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const pos = new THREE.Vector3();
    matrix.decompose(pos, quat, scale);
    meshRef.current.quaternion.copy(quat);
  }, [matrix]);

  return (
    <mesh ref={meshRef} position={position} castShadow receiveShadow>
      <boxGeometry args={[0.96, 0.96, 0.96]} />
      {materials.map((mat, i) => (
        <primitive key={i} object={mat} attach={`material-${i}`} />
      ))}
    </mesh>
  );
}
