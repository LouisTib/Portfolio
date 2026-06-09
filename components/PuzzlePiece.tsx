"use client";

import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";

const FACE_COLORS = {
  right: "#FF6B35", // orange
  left: "#1a1a1a", // dark (inner face)
  top: "#ffffff", // white
  bottom: "#1a1a1a", // dark (inner face)
  front: "#4CAF82", // green
  back: "#1a1a1a", // dark (inner face)
};

// Each cubie face on the outside gets a slice of the portrait
// gridX, gridY: which column/row of the 3x3 grid (0-2)
// face: which face of the cube
interface PuzzlePieceProps {
  position: [number, number, number];
  gridX: number;
  gridY: number;
  gridZ: number;
  faceColors?: typeof FACE_COLORS;
}

export default function PuzzlePiece({
  position,
  gridX,
  gridY,
  gridZ,
  faceColors = FACE_COLORS,
}: PuzzlePieceProps) {
  const texture = useLoader(TextureLoader, "/portrait.jpg");

  // For each face, create a canvas texture that shows the right 1/3 slice
  function makeSlicedTexture(
    axis: "x" | "y" | "z",
    faceDir: "pos" | "neg",
    sliceU: number, // 0,1,2 — horizontal slice index
    sliceV: number, // 0,1,2 — vertical slice index
  ): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Draw background color
    const faceKey =
      axis === "x"
        ? faceDir === "pos"
          ? "right"
          : "left"
        : axis === "y"
          ? faceDir === "pos"
            ? "top"
            : "bottom"
          : faceDir === "pos"
            ? "front"
            : "back";
    ctx.fillStyle = faceColors[faceKey as keyof typeof faceColors];
    ctx.fillRect(0, 0, size, size);

    // Draw the portrait slice for outer faces
    const isOuter =
      (axis === "x" && faceDir === "pos" && gridX === 2) ||
      (axis === "x" && faceDir === "neg" && gridX === 0) ||
      (axis === "y" && faceDir === "pos" && gridY === 2) ||
      (axis === "y" && faceDir === "neg" && gridY === 0) ||
      (axis === "z" && faceDir === "pos" && gridZ === 2) ||
      (axis === "z" && faceDir === "neg" && gridZ === 0);

    if (isOuter && texture.image) {
      const iw = texture.image.width;
      const ih = texture.image.height;
      const sw = iw / 3;
      const sh = ih / 3;
      // sliceU=0 is leftmost column, sliceV=0 is top row
      ctx.drawImage(
        texture.image,
        sliceU * sw,
        sliceV * sh,
        sw,
        sh,
        0,
        0,
        size,
        size,
      );
    }

    const t = new THREE.CanvasTexture(canvas);
    return t;
  }

  // right face (+X): column = gridZ, row = 2-gridY (flip Y)
  const rightTex = makeSlicedTexture("x", "pos", gridZ, 2 - gridY);
  // left face (-X): column = 2-gridZ, row = 2-gridY
  const leftTex = makeSlicedTexture("x", "neg", 2 - gridZ, 2 - gridY);
  // top face (+Y): column = gridX, row = gridZ
  const topTex = makeSlicedTexture("y", "pos", gridX, gridZ);
  // bottom face (-Y)
  const bottomTex = makeSlicedTexture("y", "neg", gridX, 2 - gridZ);
  // front face (+Z): column = gridX, row = 2-gridY
  const frontTex = makeSlicedTexture("z", "pos", gridX, 2 - gridY);
  // back face (-Z)
  const backTex = makeSlicedTexture("z", "neg", 2 - gridX, 2 - gridY);

  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[0.95, 0.95, 0.95]} />
      <meshStandardMaterial
        attach="material-0"
        map={rightTex}
        roughness={0.3}
        metalness={0.05}
      />
      <meshStandardMaterial
        attach="material-1"
        map={leftTex}
        roughness={0.3}
        metalness={0.05}
      />
      <meshStandardMaterial
        attach="material-2"
        map={topTex}
        roughness={0.3}
        metalness={0.05}
      />
      <meshStandardMaterial
        attach="material-3"
        map={bottomTex}
        roughness={0.3}
        metalness={0.05}
      />
      <meshStandardMaterial
        attach="material-4"
        map={frontTex}
        roughness={0.3}
        metalness={0.05}
      />
      <meshStandardMaterial
        attach="material-5"
        map={backTex}
        roughness={0.3}
        metalness={0.05}
      />
    </mesh>
  );
}
