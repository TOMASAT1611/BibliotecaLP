import type { Pt } from "./types";

/** Ray casting punto en polígono (metros). */
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i];
    const pj = poly[j];
    const iy =
      pi.y > p.y !== pj.y > p.y &&
      p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y + 1e-12) + pi.x;
    if (iy) inside = !inside;
  }
  return inside;
}

function rotatePoint(p: Pt, deg: number, origin: Pt): Pt {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos };
}

export function stallCorners(
  center: Pt,
  widthM: number,
  depthM: number,
  rotationDeg: number
): Pt[] {
  const hw = widthM / 2;
  const hd = depthM / 2;
  const local: Pt[] = [
    { x: center.x - hw, y: center.y - hd },
    { x: center.x + hw, y: center.y - hd },
    { x: center.x + hw, y: center.y + hd },
    { x: center.x - hw, y: center.y + hd },
  ];
  return local.map((c) => rotatePoint(c, rotationDeg, center));
}

/** True si todas las esquinas del rectángulo del puesto están dentro del polígono. */
export function stallFits(
  center: Pt,
  widthM: number,
  depthM: number,
  rotationDeg: number,
  poly: Pt[]
): boolean {
  const corners = stallCorners(center, widthM, depthM, rotationDeg);
  return corners.every((c) => pointInPolygon(c, poly));
}

/** Ajusta el centro con pequeños pasos hacia el interior hasta encajar o devolver el último válido. */
export function clampStallCenter(
  center: Pt,
  widthM: number,
  depthM: number,
  rotationDeg: number,
  poly: Pt[]
): Pt {
  if (stallFits(center, widthM, depthM, rotationDeg, poly)) return center;

  const bbox = boundingBox(poly);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  let best = { ...center };

  for (let k = 0; k < 60; k++) {
    const t = (k + 1) / 60;
    const trial = {
      x: center.x + (cx - center.x) * t * 0.95,
      y: center.y + (cy - center.y) * t * 0.95,
    };
    if (stallFits(trial, widthM, depthM, rotationDeg, poly)) {
      best = trial;
      break;
    }
  }

  if (stallFits(best, widthM, depthM, rotationDeg, poly)) return best;

  return center;
}

/** Redondea a múltiplos de `gridM`. Si `gridM`≈0, no mueve la coordenada (útil para el perímetro de zona). */
export function snapCoord(value: number, gridM: number): number {
  if (!(gridM > 1e-9)) return value;


  return Math.round(value / gridM) * gridM;
}

/** Ajusta centro (x,y) al grid respetando que el puesto siga entrando en polígono. */
export function snapStallCenterXY(
  cx: number,
  cy: number,
  widthM: number,
  depthM: number,
  rotationDeg: number,
  poly: Pt[],
  gridM: number
): Pt {
  let nx = snapCoord(cx, gridM);
  let ny = snapCoord(cy, gridM);
  if (
    stallFits(
      { x: nx, y: ny },
      widthM,
      depthM,
      rotationDeg,
      poly
    )
  )
    return { x: nx, y: ny };

  nx = cx;
  ny = cy;

  const candidates: Pt[] = [
    { x: snapCoord(cx, gridM), y: snapCoord(cy, gridM) },
    { x: cx, y: snapCoord(cy, gridM) },
    { x: snapCoord(cx, gridM), y: cy },
  ];

  for (const candidate of candidates) {
    const clamped = clampStallCenter(
      candidate,
      widthM,
      depthM,
      rotationDeg,
      poly
    );
    const snapped = {
      x: snapCoord(clamped.x, gridM),
      y: snapCoord(clamped.y, gridM),
    };
    if (
      stallFits(
        snapped,
        widthM,
        depthM,
        rotationDeg,
        poly
      )
    )
      return snapped;
  }

  return clampStallCenter(
    { x: cx, y: cy },
    widthM,
    depthM,
    rotationDeg,
    poly
  );
}

export function boundingBox(poly: Pt[]) {
  if (poly.length < 1) {
    return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  }

  const xs = poly.map((p) => p.x).filter((n) => Number.isFinite(n));
  const ys = poly.map((p) => p.y).filter((n) => Number.isFinite(n));

  if (!xs.length || !ys.length) {
    return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  }

  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  /** Evita geometrías degeneradas (una línea o un punto) que rompen el SVG / el zoom con NaN. */
  if (!(minX < maxX)) {
    minX -= 0.25;
    maxX += 0.25;
  }

  if (!(minY < maxY)) {
    minY -= 0.25;
    maxY += 0.25;
  }

  return { minX, maxX, minY, maxY };
}

export function centroidPoly(poly: Pt[]): Pt {

  let sx = 0;


  let sy = 0;


  for (const p of poly) {

    sx += p.x;


    sy += p.y;


  }

  const n = poly.length || 1;


  return {


    x: sx / n,


    y: sy / n,


  };

}

/** Recorta/expande el dibujo proporcionalmente al centro para que la caja sea ~targetWm × targetHm (metros). */
export function scalePolyToEnvelope(poly: Pt[], targetWm: number, targetHm: number): Pt[] {
  if (poly.length < 1 || !Number.isFinite(targetWm) || !Number.isFinite(targetHm)) return poly.slice();

  const bb = boundingBox(poly);

  let w = bb.maxX - bb.minX;
  let h = bb.maxY - bb.minY;

  if (!(w > 1e-9)) w = 0.25;

  if (!(h > 1e-9)) h = 0.25;

  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;

  const sx = Math.max(Math.abs(targetWm), 1e-6) / w;
  const sy = Math.max(Math.abs(targetHm), 1e-6) / h;

  return poly.map((p) => ({
    x: cx + (p.x - cx) * sx,
    y: cy + (p.y - cy) * sy,
  }));
}

export function snapPolyToGrid(poly: Pt[], gridM: number): Pt[] {


  const g = gridM > 0 ? gridM : 0;


  if (!(g > 1e-9)) return poly.map((p) => ({ ...p }));

  return poly.map((p) => ({
    x: snapCoord(p.x, g),
    y: snapCoord(p.y, g),
  }));
}

/** Solo mesas: 1,5 m — no usar para perímetro/caja envolvente de la zona plaza. */


export const ZONE_OUTLINE_SNAP_M = 0;
