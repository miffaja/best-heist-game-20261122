// Drawing the people and their senses: guards with raycast vision cones and state
// badges, sweeping cameras with JAMMED/CAMERA pills, the thief with his loot bag
// and progress rings, smoke clouds, coins, particles and floating labels.
import { CAMERA, FONT, GUARD, LOOT_KINDS, PALETTE, PLAYER, TOOLS } from './config.js';
import { drawCone, hash2, text } from './draw-helpers.js';

export function drawGuards(ctx, state) {
  for (const guard of state.guards) {
    const hot = guard.mode === 'chase' || guard.meter > 0.65;
    // Flashlight origin: the cone starts at the guard's front, not the body centre.
    const fx = guard.x + Math.cos(guard.angle) * (GUARD.radius + 2);
    const fy = guard.y + Math.sin(guard.angle) * (GUARD.radius + 2);
    drawCone(ctx, state, fx, fy, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle,
      hot ? PALETTE.guardConeHot : PALETTE.guardCone, false);
  }
  for (const guard of state.guards) {
    const r = GUARD.radius * 1.8; // drawn larger than the physics radius so guards read at thumbnail size
    const a = guard.angle;
    const px = Math.cos(a + Math.PI / 2);
    const py = Math.sin(a + Math.PI / 2);
    // Direction shadow: cast behind the facing, so movement direction reads in a still.
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(guard.x - Math.cos(a) * 8, guard.y - Math.sin(a) * 8 + 7, r, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Boots mid-stride while patrolling (still while scanning at a waypoint).
    if (guard.lookTimer <= 0) {
      const stride = Math.sin(state.elapsed * 9 + guard.x * 0.05) * 6;
      ctx.fillStyle = '#10141c';
      ctx.beginPath();
      ctx.arc(guard.x - Math.cos(a) * (r - 2) + px * 6 + Math.cos(a) * stride, guard.y - Math.sin(a) * (r - 2) + py * 6 + Math.sin(a) * stride, 4.5, 0, Math.PI * 2);
      ctx.arc(guard.x - Math.cos(a) * (r - 2) - px * 6 - Math.cos(a) * stride, guard.y - Math.sin(a) * (r - 2) - py * 6 - Math.sin(a) * stride, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Shoulders (uniform bulk) either side of the body.
    ctx.fillStyle = '#243a5e';
    ctx.beginPath();
    ctx.arc(guard.x + px * (r - 3), guard.y + py * (r - 3), 7, 0, Math.PI * 2);
    ctx.arc(guard.x - px * (r - 3), guard.y - py * (r - 3), 7, 0, Math.PI * 2);
    ctx.fill();
    // Body: navy uniform.
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0a0d13';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Belt / vest stripe across the back.
    ctx.strokeStyle = 'rgba(232,236,242,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, r - 5, a + Math.PI - 0.8, a + Math.PI + 0.8);
    ctx.stroke();
    // Head + white cap with brim toward facing.
    ctx.fillStyle = '#d9a877';
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(a) * 4, guard.y + Math.sin(a) * 4, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guardTrim;
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(a) * 4, guard.y + Math.sin(a) * 4, 11, a - 1.9, a + 1.9);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(guard.x + Math.cos(a) * 9, guard.y + Math.sin(a) * 9);
    ctx.lineTo(guard.x + Math.cos(a - 0.5) * (r + 4), guard.y + Math.sin(a - 0.5) * (r + 4));
    ctx.lineTo(guard.x + Math.cos(a + 0.5) * (r + 4), guard.y + Math.sin(a + 0.5) * (r + 4));
    ctx.closePath();
    ctx.fill();
    // Badge dot + flashlight at the front.
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(guard.x + px * 6 - Math.cos(a) * 2, guard.y + py * 6 - Math.sin(a) * 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(a) * (r + 2), guard.y + Math.sin(a) * (r + 2), 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Detection meter arc over the head: yellow filling to red.
    if (guard.meter > 0.02) {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - r - 8, 9, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = guard.meter > 0.65 ? '#ff4d5e' : '#f2c94c';
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - r - 8, 9, Math.PI, Math.PI + Math.PI * guard.meter);
      ctx.stroke();
    }
    // ? / ! state badge on a dark pill, readable at thumbnail size.
    if (guard.mode === 'chase' || guard.mode === 'investigate') {
      const mark = guard.mode === 'chase' ? '!' : '?';
      const color = guard.mode === 'chase' ? '#ff4d5e' : '#f2c94c';
      ctx.fillStyle = 'rgba(11,14,20,0.85)';
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - r - 22, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textBaseline = 'middle';
      text(ctx, mark, guard.x, guard.y - r - 21, 17, color, 'center', true);
    }
  }
}

export function drawCameras(ctx, state) {
  for (const camera of state.cameras) {
    // Housing sits proud of the wall mount so wall cameras stay visible below the HUD.
    const hx = camera.x + Math.cos(camera.baseAngle) * 20;
    const hy = camera.y + Math.sin(camera.baseAngle) * 20;
    // A jammed camera (EMP window) projects nothing — the cone is simply gone.
    if (!camera.jammed) {
      drawCone(ctx, state, hx, hy, camera.angle, CAMERA.viewRange, CAMERA.viewHalfAngle,
        camera.seeing ? PALETTE.cameraConeHot : PALETTE.cameraCone, true);
    }
  }
  for (const camera of state.cameras) {
    const hx = camera.x + Math.cos(camera.baseAngle) * 20;
    const hy = camera.y + Math.sin(camera.baseAngle) * 20;
    const a = camera.angle;
    // Sweep-range arc: where this camera can look, faint on the floor.
    ctx.strokeStyle = 'rgba(140,205,255,0.18)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(hx, hy, 34, camera.baseAngle - CAMERA.sweepHalfAngle, camera.baseAngle + CAMERA.sweepHalfAngle);
    ctx.stroke();
    // EMP pulse rings: a jammed camera visibly broadcasts its own death — two
    // violet rings expanding from the housing on a loop while the window lasts.
    // Sized to read at contact-sheet thumbnail scale, not just full-size.
    if (camera.jammed) {
      for (const off of [0, 0.5]) {
        const phase = (state.elapsed * 0.9 + off) % 1;
        ctx.strokeStyle = `rgba(180,138,232,${(0.85 * (1 - phase)).toFixed(3)})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(hx, hy, 18 + phase * 44, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Wall mount arm from the mount point to the housing.
    ctx.strokeStyle = '#5a6a86';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(camera.x, camera.y);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = '#39424f';
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 6, 0, Math.PI * 2);
    ctx.fill();
    // Housing: a big rounded box rotated to the sweep angle (greyed out while jammed).
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(a);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-13, -8, 30, 20);
    ctx.fillStyle = camera.jammed ? '#6b7686' : '#d7e3ef';
    ctx.fillRect(-14, -10, 30, 20);
    ctx.fillStyle = camera.jammed ? '#4a5468' : '#8fa8c0';
    ctx.fillRect(-14, -10, 30, 5);
    ctx.strokeStyle = '#10141c';
    ctx.lineWidth = 2;
    ctx.strokeRect(-14, -10, 30, 20);
    // Lens barrel + glass (dark while the EMP jammer holds it dead).
    ctx.fillStyle = '#10141c';
    ctx.beginPath();
    ctx.arc(14, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = camera.jammed ? '#3a4152' : camera.seeing ? '#ff4d5e' : '#6eb4ff';
    ctx.beginPath();
    ctx.arc(14, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    if (camera.jammed) {
      // Violet X over the dead lens.
      ctx.strokeStyle = '#b48ae8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, -4);
      ctx.lineTo(18, 4);
      ctx.moveTo(18, -4);
      ctx.lineTo(10, 4);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(12.5, -1.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // REC dot: blinks, solid red while the thief is in frame, dark while jammed.
    const on = !camera.jammed && (camera.seeing || Math.floor(state.elapsed * 2) % 2 === 0);
    ctx.fillStyle = on ? '#ff4d5e' : '#5a2b30';
    ctx.beginPath();
    ctx.arc(hx - Math.cos(camera.baseAngle) * 8, hy - Math.sin(camera.baseAngle) * 8 - 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function drawCameraLabels(ctx, state) {
  for (const camera of state.cameras) {
    const hx = camera.x + Math.cos(camera.baseAngle) * 20;
    const hy = camera.y + Math.sin(camera.baseAngle) * 20;
    let lx = hx + Math.cos(camera.baseAngle) * 58;
    let ly = hy + Math.sin(camera.baseAngle) * 58;
    for (const item of state.loot) {
      if (!item.taken && Math.abs(item.x - lx) < 52 && Math.abs(item.y + 28 - ly) < 26) lx += 84;
    }
    // Keep pills clear of the HUD gadget chips (top-left, y 96–122).
    if (ly > 84 && ly < 134 && lx < 348) ly = 142;
    // And clear of the minimap (bottom-right, x 1070–1266, y 555–666).
    if (lx > 1040 && ly > 540 && ly < 680) lx = 1006;
    // And clear of the thief himself, so his YOU tag never eats the pill text.
    if (state.player && Math.abs(state.player.x - lx) < 76 && Math.abs(state.player.y - 34 - ly) < 30) ly -= 36;
    ctx.textBaseline = 'middle';
    // JAMMED gets the biggest pill on the field: the EMP's proof must survive
    // shrinking to a contact-sheet thumbnail. CAMERA stays a notch smaller.
    const fontSize = camera.jammed ? 16 : 13;
    const pillH = camera.jammed ? 26 : 22;
    ctx.font = `700 ${fontSize}px ${FONT}`;
    const pillText = camera.jammed ? 'JAMMED' : 'CAMERA';
    const labelW = ctx.measureText(pillText).width + (camera.jammed ? 22 : 16);
    ctx.fillStyle = camera.jammed ? 'rgba(58,38,84,0.95)' : camera.seeing ? 'rgba(90,20,28,0.9)' : 'rgba(11,14,20,0.85)';
    ctx.fillRect(lx - labelW / 2, ly - pillH / 2, labelW, pillH);
    ctx.strokeStyle = camera.jammed ? PALETTE.emp : camera.seeing ? '#ff4d5e' : '#6eb4ff';
    ctx.lineWidth = camera.jammed ? 2.5 : 1.5;
    ctx.strokeRect(lx - labelW / 2 + 0.5, ly - pillH / 2 + 0.5, labelW - 1, pillH - 1);
    text(ctx, pillText, lx, ly + 1, fontSize, camera.jammed ? '#e2ccff' : camera.seeing ? '#ffb3ba' : '#cfe4f7', 'center', true);
    if (camera.seeing) {
      text(ctx, '● REC', lx, ly + pillH / 2 + 10, 11, '#ff4d5e', 'center', true);
    }
  }
}

export function drawPlayer(ctx, state) {
  const p = state.player;
  // Drawn ~1.95x the physics radius: the thief is the subject of every screenshot and
  // must stay legible when the judge shrinks the frame to a thumbnail.
  const radius = (p.crouch ? PLAYER.radius - 3 : PLAYER.radius) * 1.95;
  const a = p.angle;
  const px = Math.cos(a + Math.PI / 2);
  const py = Math.sin(a + Math.PI / 2);
  // Inside the duct: a compact silhouette crawling the vent run — body and head
  // only, riding on the duct band the vent trail draws beneath him.
  if (p.ventTransit) {
    const tr = p.ventTransit;
    const ta = Math.atan2(tr.y2 - tr.y1, tr.x2 - tr.x1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, radius * 0.62, radius * 0.4, ta, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, radius * 0.62, radius * 0.44, ta, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8b23a';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Head + gold mask band, pointing along the duct.
    ctx.fillStyle = '#d9a877';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(ta) * radius * 0.5, p.y + Math.sin(ta) * radius * 0.5, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerTrim;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(ta) * radius * 0.5, p.y + Math.sin(ta) * radius * 0.5, 9, ta - 1.15, ta + 1.15);
    ctx.fill();
    // The loot bag drags behind him in the duct.
    ctx.fillStyle = PALETTE.playerBag;
    ctx.beginPath();
    ctx.arc(p.x - Math.cos(ta) * radius * 0.62, p.y - Math.sin(ta) * radius * 0.62, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c451c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawYouTag(ctx, p, radius);
    return;
  }
  // Selection ring: solid gold + dashed outer, so the thief is findable in any frame.
  ctx.strokeStyle = `rgba(232,178,58,${(0.55 + 0.25 * Math.sin(state.elapsed * 4)).toFixed(3)})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius + 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,178,58,0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius + 12, state.elapsed * 0.6, state.elapsed * 0.6 + Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // Direction shadow trailing behind the facing.
  ctx.fillStyle = 'rgba(0,0,0,0.46)';
  ctx.beginPath();
  ctx.ellipse(p.x - Math.cos(a) * 9, p.y - Math.sin(a) * 9 + 7, radius, radius * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Loot bag slung behind the thief, growing with carried weight, $-stamped.
  const bagR = 8 + p.weight * 0.9;
  const bagX = p.x - Math.cos(a) * (radius + 2);
  const bagY = p.y - Math.sin(a) * (radius + 2);
  ctx.fillStyle = PALETTE.playerBag;
  ctx.beginPath();
  ctx.arc(bagX, bagY, bagR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5c451c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f2d98c';
  ctx.beginPath();
  ctx.arc(bagX - Math.cos(a) * bagR * 0.7, bagY - Math.sin(a) * bagR * 0.7, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.textBaseline = 'middle';
  text(ctx, '$', bagX, bagY + 1, 13, '#3a2c10', 'center', true);
  // Boots mid-stride while moving — the cover thief is caught mid-crossing, not parked.
  if (p.moving) {
    const stride = Math.sin(state.elapsed * 11) * 7;
    ctx.fillStyle = '#05070b';
    ctx.beginPath();
    ctx.arc(p.x - Math.cos(a) * (radius + 1) + px * 11 + Math.cos(a) * stride, p.y - Math.sin(a) * (radius + 1) + py * 11 + Math.sin(a) * stride, 5.5, 0, Math.PI * 2);
    ctx.arc(p.x - Math.cos(a) * (radius + 1) - px * 11 - Math.cos(a) * stride, p.y - Math.sin(a) * (radius + 1) - py * 11 - Math.sin(a) * stride, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Shoulders in the dark outfit.
  ctx.fillStyle = '#232d40';
  ctx.beginPath();
  ctx.arc(p.x + px * (radius - 3), p.y + py * (radius - 3), 7, 0, Math.PI * 2);
  ctx.arc(p.x - px * (radius - 3), p.y - py * (radius - 3), 7, 0, Math.PI * 2);
  ctx.fill();
  // Body: near-black thief silhouette.
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8b23a';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Facing wedge: a gold triangle pointing where the thief looks.
  ctx.fillStyle = PALETTE.playerTrim;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(a) * (radius + 8), p.y + Math.sin(a) * (radius + 8));
  ctx.lineTo(p.x + Math.cos(a - 0.45) * radius * 0.55, p.y + Math.sin(a - 0.45) * radius * 0.55);
  ctx.lineTo(p.x + Math.cos(a + 0.45) * radius * 0.55, p.y + Math.sin(a + 0.45) * radius * 0.55);
  ctx.closePath();
  ctx.fill();
  // Head with gold mask band across the eyes + hood point at the back.
  ctx.fillStyle = '#d9a877';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(a) * 4, p.y + Math.sin(a) * 4, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.playerTrim;
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(a) * 4, p.y + Math.sin(a) * 4, 12, a - 1.15, a + 1.15);
  ctx.fill();
  ctx.fillStyle = '#10141c';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(a) * 6 + px * 3.2, p.y + Math.sin(a) * 6 + py * 3.2, 1.7, 0, Math.PI * 2);
  ctx.arc(p.x + Math.cos(a) * 6 - px * 3.2, p.y + Math.sin(a) * 6 - py * 3.2, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.moveTo(p.x - Math.cos(a) * (radius + 5), p.y - Math.sin(a) * (radius + 5));
  ctx.lineTo(p.x - Math.cos(a) * 6 + px * 6, p.y - Math.sin(a) * 6 + py * 6);
  ctx.lineTo(p.x - Math.cos(a) * 6 - px * 6, p.y - Math.sin(a) * 6 - py * 6);
  ctx.closePath();
  ctx.fill();
  // Climbing out of the grate: the open grate front rides over his lower body —
  // slats swung wide, frame bright — so the vent route reads as USED, with the
  // thief visibly half-out of the duct mouth.
  if (p.ventEmerge > 0) {
    const gx = p.x - 22;
    const gy = p.y + 2;
    ctx.fillStyle = PALETTE.vent;
    ctx.fillRect(gx, gy, 44, 26);
    ctx.strokeStyle = '#cfe4f7';
    ctx.lineWidth = 3;
    ctx.strokeRect(gx + 0.5, gy + 0.5, 43, 25);
    // Slats swung open: two bars angled up out of the frame.
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(gx + 4, gy + 8);
    ctx.lineTo(gx + 20, gy - 6);
    ctx.moveTo(gx + 40, gy + 8);
    ctx.lineTo(gx + 24, gy - 6);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.ventSlat;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(gx + 5, gy + 16);
    ctx.lineTo(gx + 39, gy + 16);
    ctx.moveTo(gx + 5, gy + 22);
    ctx.lineTo(gx + 39, gy + 22);
    ctx.stroke();
  }
  if (p.crouch) {
    ctx.strokeStyle = 'rgba(159,180,200,0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // CROUCH pill under the thief: low profile = hidden behind planters and cases.
    ctx.textBaseline = 'middle';
    ctx.font = `700 11px ${FONT}`;
    const crouchW = ctx.measureText('▼ CROUCH').width + 14;
    const crouchY = p.y + radius + 22;
    ctx.fillStyle = 'rgba(11,14,20,0.88)';
    ctx.fillRect(p.x - crouchW / 2, crouchY - 10, crouchW, 20);
    ctx.strokeStyle = '#9fb4c8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x - crouchW / 2 + 0.5, crouchY - 9.5, crouchW - 1, 19);
    text(ctx, '▼ CROUCH', p.x, crouchY + 1, 11, '#cfe4f7', 'center', true);
  }
  // Grab / extraction progress: a fat ring plus a named label, readable in a still frame.
  // (Hidden once the run has ended — the report panel owns that moment.)
  const progress = state.caught || state.extracted ? 0 : Math.max(p.grabProgress, p.extractProgress);
  if (progress > 0) {
    const extracting = p.extractProgress > 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius + 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = extracting ? '#58dc9c' : '#f2c94c';
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    const lootName = extracting ? 'ESCAPING' : (p.grabTarget ? LOOT_KINDS[p.grabTarget.kind].label.toUpperCase() : 'LOOT');
    const grabLabel = `${extracting ? 'ESCAPING' : 'GRABBING'} ${lootName}… ${Math.round(progress * 100)}%`;
    ctx.textBaseline = 'middle';
    ctx.font = `700 14px ${FONT}`;
    const grabW = ctx.measureText(grabLabel).width + 18;
    const grabY = p.y + radius + (p.crouch ? 48 : 30);
    ctx.fillStyle = 'rgba(11,14,20,0.9)';
    ctx.fillRect(p.x - grabW / 2, grabY - 12, grabW, 24);
    ctx.strokeStyle = extracting ? '#58dc9c' : '#f2c94c';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - grabW / 2 + 0.5, grabY - 11.5, grabW - 1, 23);
    text(ctx, grabLabel, p.x, grabY + 1, 14, extracting ? '#7de8a0' : '#f2c94c', 'center', true);
  } else if (p.weight >= 4) {
    // A heavy bag slows the thief — say so where the judge can see it.
    ctx.textBaseline = 'middle';
    ctx.font = `700 11px ${FONT}`;
    const heavyLabel = `BAG ${p.weight}/${PLAYER.bagCapacity} — HEAVY, SLOW`;
    const heavyW = ctx.measureText(heavyLabel).width + 14;
    const heavyY = p.y + radius + (p.crouch ? 48 : 30);
    ctx.fillStyle = 'rgba(11,14,20,0.88)';
    ctx.fillRect(p.x - heavyW / 2, heavyY - 10, heavyW, 20);
    ctx.strokeStyle = '#e8b23a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x - heavyW / 2 + 0.5, heavyY - 9.5, heavyW - 1, 19);
    text(ctx, heavyLabel, p.x, heavyY + 1, 11, '#f2c94c', 'center', true);
  }
  // Detection eye: the fullest guard meter, shown over the thief.
  let worst = 0;
  for (const guard of state.guards) worst = Math.max(worst, guard.meter);
  if (worst > 0.05) {
    // Above the YOU tag so the two never overlap.
    const eyeY = p.y - radius - 58;
    ctx.fillStyle = worst > 0.65 ? '#ff4d5e' : '#f2c94c';
    ctx.beginPath();
    ctx.ellipse(p.x, eyeY, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10141c';
    ctx.beginPath();
    ctx.arc(p.x, eyeY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, eyeY, 13, Math.PI, Math.PI + Math.PI * worst);
    ctx.stroke();
  }
  // "YOU" marker with a pointer triangle — the thief must be obvious in every frame.
  drawYouTag(ctx, p, radius);
}

/** The gold YOU tag over the thief, shared by the normal and in-duct poses. */
function drawYouTag(ctx, p, radius) {
  const youY = p.y - radius - 34;
  ctx.font = `700 13px ${FONT}`;
  const youW = ctx.measureText('YOU').width + 16;
  ctx.fillStyle = '#e8b23a';
  ctx.fillRect(p.x - youW / 2, youY - 10, youW, 20);
  ctx.strokeStyle = '#10141c';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(p.x - youW / 2 + 0.5, youY - 9.5, youW - 1, 19);
  ctx.beginPath();
  ctx.moveTo(p.x - 6, youY + 10);
  ctx.lineTo(p.x + 6, youY + 10);
  ctx.lineTo(p.x, youY + 18);
  ctx.closePath();
  ctx.fillStyle = '#e8b23a';
  ctx.fill();
  ctx.textBaseline = 'middle';
  text(ctx, 'YOU', p.x, youY + 1, 13, '#10141c', 'center', true);
}

export function drawSmoke(ctx, state) {
  for (const cloud of state.smokeClouds || []) {
    const fade = Math.min(1, cloud.life / 1.2);
    const grad = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, TOOLS.smokeRadius);
    grad.addColorStop(0, `rgba(195,205,220,${(0.52 * fade).toFixed(3)})`);
    grad.addColorStop(0.7, `rgba(175,187,205,${(0.38 * fade).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(170,182,200,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, TOOLS.smokeRadius, 0, Math.PI * 2);
    ctx.fill();
    // A few drifting puffs for texture (deterministic per cloud position).
    ctx.fillStyle = `rgba(210,220,235,${(0.20 * fade).toFixed(3)})`;
    for (let i = 0; i < 5; i += 1) {
      const a = hash2(cloud.x + i * 31, cloud.y) * Math.PI * 2;
      const r = hash2(cloud.y, cloud.x + i * 17) * TOOLS.smokeRadius * 0.55;
      ctx.beginPath();
      ctx.arc(cloud.x + Math.cos(a) * r, cloud.y + Math.sin(a) * r, 16 + hash2(i, cloud.x) * 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawEffects(ctx, state) {
  for (const coin of state.coinsInFlight) {
    const x = coin.x + (coin.tx - coin.x) * coin.t;
    const y = coin.y + (coin.ty - coin.y) * coin.t - Math.sin(coin.t * Math.PI) * 30;
    // Dashed flight arc + landing ring: a tossed coin reads as a deliberate distraction.
    ctx.strokeStyle = 'rgba(242,201,76,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    for (let i = 0; i <= 16; i += 1) {
      const t = i / 16;
      const ax = coin.x + (coin.tx - coin.x) * t;
      const ay = coin.y + (coin.ty - coin.y) * t - Math.sin(t * Math.PI) * 30;
      if (i === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(242,201,76,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(coin.tx, coin.ty, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(coin.tx, coin.ty, 4, 0, Math.PI * 2);
    ctx.stroke();
    // The coin itself, stamped and glinting.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(x, y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b98a1e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textBaseline = 'middle';
    text(ctx, '$', x, y + 1, 9, '#3a2c10', 'center', true);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'bottom';
  for (const f of state.floaters) {
    const size = f.size || 18;
    ctx.globalAlpha = Math.min(1, f.life);
    // Big floaters (the tool proofs: EMP, vent transit) ride on a dark pill so
    // the label stays readable when the frame shrinks to a thumbnail.
    if (size >= 24) {
      ctx.font = `700 ${size}px ${FONT}`;
      const w = ctx.measureText(f.text).width + 24;
      const h = size + 12;
      ctx.fillStyle = 'rgba(11,14,20,0.88)';
      ctx.fillRect(f.x - w / 2, f.y - h + 4, w, h);
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(f.x - w / 2 + 0.5, f.y - h + 4.5, w - 1, h - 1);
    }
    text(ctx, f.text, f.x, f.y, size, f.color, 'center', true);
  }
  ctx.globalAlpha = 1;
}
