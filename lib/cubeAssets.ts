import * as THREE from "three";

export const materialCache = new Map<string, THREE.MeshStandardMaterial>();

const FACE_COLORS: Record<string, string> = {
  right: "#B90000",
  left: "#FF5900",
  top: "#FFFFFF",
  bottom: "#FFD500",
  front: "#009B48",
  back: "#0046AD",
};

export const FACE_DEFS = [
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

export function isOuter(
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

export function getMaterialFor(
  axis: "x" | "y" | "z",
  dir: "pos" | "neg",
  key: string,
  gx: number,
  gy: number,
  gz: number,
): THREE.MeshStandardMaterial | undefined {
  const slice = getPortraitSlice(axis, dir, gx, gy, gz);
  const cacheKey = slice
    ? `img:${FACE_COLORS[key]}:${slice.join(",")}`
    : `plain:${FACE_COLORS[key]}`;
  return materialCache.get(cacheKey);
}

let sharedBodyMaterial: THREE.MeshStandardMaterial | null = null;
export function getBodyMaterial() {
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
export function getPlaneGeometry() {
  if (!sharedPlaneGeometry) {
    sharedPlaneGeometry = new THREE.PlaneGeometry(0.93, 0.93);
  }
  return sharedPlaneGeometry;
}

// --- Preload entry point ---
let preloadPromise: Promise<void> | null = null;

export function preloadCubeAssets(): Promise<void> {
  if (preloadPromise) return preloadPromise;

  preloadPromise = new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          for (let z = 0; z < 3; z++) {
            for (const { axis, dir, key } of FACE_DEFS) {
              if (!isOuter(axis, dir, x, y, z)) continue;
              const slice = getPortraitSlice(axis, dir, x, y, z);
              if (slice) {
                const cacheKey = `img:${FACE_COLORS[key]}:${slice.join(",")}`;
                if (!materialCache.has(cacheKey)) {
                  const canvas = buildFaceCanvas(FACE_COLORS[key], img, slice);
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
              } else {
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
              }
            }
          }
        }
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = "/portrait.jpg";
  });

  return preloadPromise;
}

// Kick it off as soon as this module is evaluated — i.e. as early as
// the page bundle loads, well before the fall-in animation runs.
if (typeof window !== "undefined") {
  preloadCubeAssets();
}
