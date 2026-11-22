// Shared drawing helpers: text, a deterministic hash, the clock format, and the
// raycast vision cone every guard and camera projects. Everything here takes the
// canvas context explicitly — no hidden state.
import { FONT, TOOLS } from './config.js';
import { rayDistance, raySmokeDistance } from './geometry.js';

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function text(ctx, value, x, y, size, color, align, bold) {
  ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.fillText(value, x, y);
}

/** Deterministic 0..1 hash from two numbers (stable desk clutter, no flicker). */
export function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export function drawCone(ctx, state, x, y, angle, range, halfAngle, fill, scanLines) {
  const rays = 26;
  const dists = [];
  // Radial falloff: bright at the source, fading to nothing at range, so two cones
  // crossing stay readable instead of stacking into mud. Alpha is kept low on purpose.
  const m = fill.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
  if (m) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, range);
    grad.addColorStop(0, `rgba(${m[1]},${m[2]},${m[3]},${m[4]})`);
    grad.addColorStop(0.55, `rgba(${m[1]},${m[2]},${m[3]},${(Number(m[4]) * 0.55).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${m[1]},${m[2]},${m[3]},0.02)`);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = fill;
  }
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    let d = rayDistance(state.walls, x, y, a, range);
    // Smoke stops sight, so it stops the drawn cone too: the fan ends at the cloud's
    // near edge, exactly where the simulation stops seeing.
    for (const cloud of state.smokeClouds || []) {
      d = Math.min(d, raySmokeDistance(cloud, TOOLS.smokeRadius, x, y, a));
    }
    dists.push(d);
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
  // Bright rim so the cone edge reads at thumbnail size.
  ctx.strokeStyle = scanLines ? 'rgba(207,228,247,0.55)' : 'rgba(255,214,90,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (scanLines) {
    // Concentric scan arcs at 1/3 and 2/3 range, clipped to the fan's own distances.
    ctx.strokeStyle = 'rgba(207,228,247,0.4)';
    ctx.lineWidth = 1.5;
    for (const frac of [0.36, 0.66]) {
      ctx.beginPath();
      for (let i = 0; i <= rays; i += 1) {
        const a = angle - halfAngle + (2 * halfAngle * i) / rays;
        const d = dists[i] * frac;
        const px = x + Math.cos(a) * d;
        const py = y + Math.sin(a) * d;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Centre reticle line down the cone axis.
    ctx.strokeStyle = 'rgba(207,228,247,0.35)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * dists[Math.floor(rays / 2)], y + Math.sin(angle) * dists[Math.floor(rays / 2)]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
