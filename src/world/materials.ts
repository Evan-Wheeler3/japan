import * as THREE from 'three';

export const FONT = '"DotGothic16", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", monospace';

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
