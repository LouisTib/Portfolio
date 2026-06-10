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

  // FRONT / BACK (correct)
  if (axis === "z" && dir === "pos") return [gx, 2 - gy];
  if (axis === "z" && dir === "neg") return [2 - gx, 2 - gy];

  // LEFT / RIGHT (FIXED PROPER UV ORIENTATION)
  // u = z, v = y
  if (axis === "x" && dir === "pos") return [2 - gz, 2 - gy];
  if (axis === "x" && dir === "neg") return [gz, 2 - gy];

  // TOP / BOTTOM (correct)
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
  const S = 256;
  const BORDER = 10;
  const RADIUS = 28;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;

  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, S, S);

  if (!outer) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const bx = BORDER;
  const by = BORDER;
  const bw = S - BORDER * 2;
  const bh = S - BORDER * 2;

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

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  return tex;
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

      return new THREE.MeshStandardMaterial({
        map: makeFaceTexture(FACE_COLORS[key], portrait, slice, outer),
        roughness: 0.25,
        metalness: 0,
      });
    });
  }, [origX, origY, origZ, portrait]);

  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current) return;

    const q = new THREE.Quaternion();
    q.setFromRotationMatrix(matrix);
    groupRef.current.quaternion.copy(q);
  }, [matrix]);

  useEffect(() => {
    return () => {
      materials.forEach((m) => m.dispose());
    };
  }, [materials]);

  return (
    <group ref={groupRef} position={position} renderOrder={1}>
      {/* BODY */}
      <RoundedBox
        args={[0.96, 0.96, 0.96]}
        radius={0.08}
        smoothness={4}
        castShadow={false}
        receiveShadow={false}
      >
        <meshStandardMaterial color="#111111" roughness={0.5} metalness={0} />
      </RoundedBox>

      {/* STICKERS */}
      <mesh renderOrder={2} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[0.97, 0.97, 0.97]} />
        {materials.map((mat, i) => (
          <primitive key={i} object={mat} attach={`material-${i}`} />
        ))}
      </mesh>
    </group>
  );
}
