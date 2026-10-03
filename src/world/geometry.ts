/** Axis-aligned collision rectangle on the floor plane, optionally limited to a height band. */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
}

/** A flat counter-top area where loose items can be set down. */
export interface SurfaceDef {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  top: number;
}
