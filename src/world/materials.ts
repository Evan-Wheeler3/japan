import * as THREE from 'three';
import { Rng } from '../sim/rng';

export const FONT = '"DotGothic16", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", monospace';

const matCache = new Map<string, THREE.MeshStandardMaterial>();

export interface MatOptions {
  emissive?: number;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  map?: THREE.Texture;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  /** Required when `map` is set, since textures can't be keyed automatically. */
  key?: string;
  flat?: boolean;
}

export function mat(color: number, o: MatOptions = {}): THREE.MeshStandardMaterial {
  const key =
    o.key ??
    `${color}|${o.emissive ?? 0}|${o.emissiveIntensity ?? 1}|${o.roughness ?? 0.85}|${o.metalness ?? 0}|${o.opacity ?? 1}|${o.side ?? 0}|${o.flat ?? true}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.emissiveIntensity ?? 1,
      roughness: o.roughness ?? 0.85,
      metalness: o.metalness ?? 0,
      map: o.map ?? null,
      transparent: o.transparent ?? (o.opacity !== undefined && o.opacity < 1),
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
      flatShading: o.flat ?? true,
    });
    matCache.set(key, m);
  }
  return m;
}

function pixelTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, rng: Rng) => void, seed = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, new Rng(seed));
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

function shade(c: number, f: number): string {
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) * f));
  const g = Math.min(255, Math.max(0, ((c >> 8) & 255) * f));
  const b = Math.min(255, Math.max(0, (c & 255) * f));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/** Horizontal planks, one texture repeat per world metre. */
export function woodTexture(base: number, seed = 1, plankPx = 8) {
  return pixelTexture(
    32,
    32,
    (ctx, rng) => {
      for (let y = 0; y < 32; y += plankPx) {
        const f = rng.range(0.85, 1.12);
        ctx.fillStyle = shade(base, f);
        ctx.fillRect(0, y, 32, plankPx);
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = shade(base, f * rng.range(0.82, 0.95));
          ctx.fillRect(rng.int(0, 31), y + rng.int(1, plankPx - 2), rng.int(2, 7), 1);
        }
        ctx.fillStyle = shade(base, 0.55);
        ctx.fillRect(0, y + plankPx - 1, 32, 1);
        ctx.fillRect(rng.int(0, 31), y, 1, plankPx);
      }
    },
    seed,
  );
}

export function plasterTexture(base: number, seed = 2) {
  return pixelTexture(
    16,
    16,
    (ctx, rng) => {
      ctx.fillStyle = hex(base);
      ctx.fillRect(0, 0, 16, 16);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = shade(base, rng.range(0.92, 1.05));
        ctx.fillRect(rng.int(0, 15), rng.int(0, 15), 1, 1);
      }
    },
    seed,
  );
}

export function tileTexture(base: number) {
  return pixelTexture(16, 16, (ctx) => {
    ctx.fillStyle = hex(base);
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = shade(base, 0.78);
    ctx.fillRect(0, 7, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(7, 0, 1, 8);
    ctx.fillRect(15, 8, 1, 8);
  });
}

export function shojiTexture() {
  return pixelTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#f3e6c8';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(0, 0, 1, 16);
    ctx.fillRect(0, 8, 16, 1);
    ctx.fillRect(8, 0, 1, 16);
  });
}

export function roofTileTexture() {
  return pixelTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#2e3138';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#1d1f24';
    for (let y = 0; y < 16; y += 4) ctx.fillRect(0, y + 3, 16, 1);
    for (let x = 0; x < 16; x += 4) ctx.fillRect(x, 0, 1, 16);
  });
}

export interface SignOptions {
  width: number;
  height: number;
  bg: string;
  fg: string;
  lines: { text: string; size: number; y: number; color?: string; align?: CanvasTextAlign; x?: number }[];
  border?: string;
}

/** Canvas text sign rendered at low resolution then nearest-filtered for a pixel look. */
export function signTexture(o: SignOptions) {
  const canvas = document.createElement('canvas');
  canvas.width = o.width;
  canvas.height = o.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = o.bg;
  ctx.fillRect(0, 0, o.width, o.height);
  if (o.border) {
    ctx.strokeStyle = o.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, o.width - 6, o.height - 6);
  }
  ctx.textBaseline = 'middle';
  for (const line of o.lines) {
    ctx.fillStyle = line.color ?? o.fg;
    ctx.font = `${line.size}px ${FONT}`;
    ctx.textAlign = line.align ?? 'center';
    ctx.fillText(line.text, line.x ?? o.width / 2, line.y);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
