// Pure geometry for the heist simulation: angle maths, segment tests, and the
// raycast the renderer uses to draw vision cones that stop at walls. No state,
// no DOM — the same functions serve the rules (line of sight) and the picture.
import { ALARM } from './config.js';

/** Which escalation band an alarm value falls in (index into ALARM.levels). */
export function alarmLevelIndex(alarm) {
  let index = 0;
  for (let i = 0; i < ALARM.levels.length; i += 1) if (alarm >= ALARM.levels[i].at) index = i;
  return index;
}

/** Smallest signed angle from a to b, in [-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Does segment (x1,y1)-(x2,y2) cross the axis-aligned rect? (slab test) */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

/** Segment-segment intersection (for laser tripwires). */
export function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1x = bx - ax;
  const d1y = by - ay;
  const d2x = dx - cx;
  const d2y = dy - cy;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return false;
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / denom;
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/**
 * Distance from (x,y) along `angle` to the nearest sight-blocking wall (kind 'wall' or
 * 'desk'), capped at maxDist. The renderer casts a fan of these to draw vision cones that
 * stop at walls; the simulation uses segmentHitsRect for exact line of sight.
 */
export function rayDistance(walls, x, y, angle, maxDist) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = maxDist;
  for (const rect of walls) {
    if (rect.kind === 'low') continue;
    // Ray vs AABB slab test, nearest positive t.
    let tMin = 0;
    let tMax = best;
    let ok = true;
    if (Math.abs(dx) < 1e-9) {
      if (x < rect.x || x > rect.x + rect.w) ok = false;
    } else {
      let t1 = (rect.x - x) / dx;
      let t2 = (rect.x + rect.w - x) / dx;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) ok = false;
    }
    if (ok) {
      if (Math.abs(dy) < 1e-9) {
        if (y < rect.y || y > rect.y + rect.h) ok = false;
      } else {
        let t1 = (rect.y - y) / dy;
        let t2 = (rect.y + rect.h - y) / dy;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) ok = false;
      }
    }
    if (ok && tMin < best) best = tMin;
  }
  return best;
}

/**
 * Distance from (x,y) along `angle` to the near edge of a smoke cloud (a circle),
 * or Infinity when the ray misses it. Vision cones stop at smoke exactly as sight
 * does, so the picture never promises a guard can see through a cloud.
 */
export function raySmokeDistance(cloud, radius, x, y, angle) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const ox = x - cloud.x;
  const oy = y - cloud.y;
  const b = ox * dx + oy * dy;
  const c = ox * ox + oy * oy - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : Infinity;
}
