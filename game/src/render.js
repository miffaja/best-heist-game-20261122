// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// field is scaled to fit the window and centred. Vision cones are drawn as raycast fans
// that stop at walls, so what the player sees is exactly what the simulation checks.
// Everything is canvas shapes and text — no image files, no network.
import { ALARM, CAMERA, FIELD, FONT, GUARD, LOOT_KINDS, PALETTE, PLAYER } from './config.js';
import { rayDistance } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';   // caught
export const SCREEN_WIN = 'win';     // extracted

const ALARM_COLORS = [PALETTE.alarmCalm, PALETTE.alarmWarn, PALETTE.alarmHot, PALETTE.alarmLock];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  /** Convert a mouse client position to field coordinates (for aiming and coin tosses). */
  function toField(clientX, clientY) {
    const ratio = window.devicePixelRatio || 1;
    return {
      x: (clientX * ratio - view.x) / view.scale,
      y: (clientY * ratio - view.y) / view.scale,
    };
  }

  function text(value, x, y, size, color, align, bold) {
    ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.fillText(value, x, y);
  }

  function drawFloors(state) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const room of state.level.rooms) {
      ctx.fillStyle = PALETTE[room.tint];
      ctx.fillRect(room.x, room.y, room.w, room.h);
    }
    // Checker tile variation: alternating faint cells so floors read as real tile,
    // not flat colour. Deterministic from cell coordinates — no flicker.
    for (let ty = 24; ty < FIELD.height - 24; ty += 48) {
      for (let tx = 24; tx < FIELD.width - 24; tx += 48) {
        if (((tx / 48) + (ty / 48)) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.028)';
          ctx.fillRect(tx, ty, 48, 48);
        }
      }
    }
    // Floor tile grid.
    ctx.strokeStyle = PALETTE.floorTileLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 24; x < FIELD.width - 24; x += 48) { ctx.moveTo(x, 24); ctx.lineTo(x, FIELD.height - 24); }
    for (let y = 24; y < FIELD.height - 24; y += 48) { ctx.moveTo(24, y); ctx.lineTo(FIELD.width - 24, y); }
    ctx.stroke();
    // Rugs: a gallery runner and a lobby rug, drawn under furniture and loot.
    if (state.levelIndex === 0) {
      ctx.fillStyle = 'rgba(122,46,58,0.5)';
      ctx.fillRect(452, 168, 380, 120);
      ctx.strokeStyle = 'rgba(232,178,58,0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(458, 174, 368, 108);
      ctx.fillStyle = 'rgba(46,74,120,0.45)';
      ctx.fillRect(80, 180, 250, 150);
      ctx.strokeStyle = 'rgba(159,180,200,0.35)';
      ctx.strokeRect(86, 186, 238, 138);
    } else {
      ctx.fillStyle = 'rgba(122,46,58,0.4)';
      ctx.fillRect(470, 252, 340, 216);
      ctx.strokeStyle = 'rgba(232,178,58,0.4)';
      ctx.lineWidth = 3;
      ctx.strokeRect(478, 260, 324, 200);
    }
    // The vault door: a steel circle with spokes, on the vault room's wall.
    const door = state.levelIndex === 0 ? { x: 880, y: 120 } : { x: 640, y: 232 };
    ctx.fillStyle = '#39424f';
    ctx.beginPath();
    ctx.arc(door.x, door.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9fb4c8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(door.x, door.y, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(door.x, door.y);
      ctx.lineTo(door.x + Math.cos(a) * 20, door.y + Math.sin(a) * 20);
      ctx.stroke();
    }
    ctx.fillStyle = '#e8b23a';
    ctx.beginPath();
    ctx.arc(door.x, door.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.textBaseline = 'top';
    text('VAULT', door.x, door.y + 30, 11, '#9fb4c8', 'center', true);
    // Room nameplates, faint so they read as floor markings.
    for (const room of state.level.rooms) {
      ctx.globalAlpha = 0.35;
      text(room.label, room.x + 14, room.y + 10, 15, PALETTE.muted, 'left', true);
      ctx.globalAlpha = 1;
    }
  }

  function drawExtractZone(state) {
    const zone = state.level.extract;
    ctx.fillStyle = PALETTE.extractZone;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.strokeStyle = '#58dc9c';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
    ctx.setLineDash([]);
    // The getaway van: body, cab, windows, wheels.
    const vx = zone.x + 18;
    const vy = zone.y + 26;
    ctx.fillStyle = PALETTE.van;
    ctx.fillRect(vx, vy, 96, 40);
    ctx.fillStyle = PALETTE.vanTrim;
    ctx.fillRect(vx + 8, vy + 7, 52, 14);
    ctx.fillRect(vx + 68, vy + 7, 20, 14);
    ctx.fillStyle = '#10141c';
    ctx.beginPath();
    ctx.arc(vx + 20, vy + 42, 8, 0, Math.PI * 2);
    ctx.arc(vx + 78, vy + 42, 8, 0, Math.PI * 2);
    ctx.fill();
    // Side door + headlights + hazard stripe.
    ctx.strokeStyle = 'rgba(16,20,28,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(vx + 30, vy + 22, 26, 16);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(vx + 92, vy + 10, 4, 8);
    ctx.fillRect(vx + 92, vy + 24, 4, 8);
    ctx.fillStyle = '#e8b23a';
    ctx.fillRect(vx, vy + 36, 96, 3);
    ctx.textBaseline = 'top';
    text('GETAWAY VAN', zone.x + zone.w / 2, zone.y + 4, 13, '#7de8a0', 'center', true);
  }

  /** Deterministic 0..1 hash from two numbers (stable desk clutter, no flicker). */
  function hash2(a, b) {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >> 13)) | 0;
    h = Math.imul(h, 1274126177);
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  function drawWalls(state) {
    for (const rect of state.walls) {
      if (rect.kind === 'wall') {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(rect.x, rect.y, rect.w, Math.min(5, rect.h));
        ctx.fillRect(rect.x, rect.y, Math.min(5, rect.w), rect.h);
        // Wall trim: a gold pinstripe + brick ticks along long walls.
        ctx.fillStyle = 'rgba(232,178,58,0.28)';
        if (rect.w > rect.h) ctx.fillRect(rect.x, rect.y + rect.h - 3, rect.w, 2);
        else ctx.fillRect(rect.x + rect.w - 3, rect.y, 2, rect.h);
        ctx.strokeStyle = PALETTE.wallEdge;
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      } else if (rect.kind === 'desk') {
        // Wooden desk / vault rack with papers, a monitor and small clutter.
        ctx.fillStyle = PALETTE.desk;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = PALETTE.deskTop;
        ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
        const wide = rect.w >= rect.h;
        const along = wide ? rect.w : rect.h;
        // Papers.
        ctx.fillStyle = '#e8ecf2';
        for (let i = 0; i < 3; i += 1) {
          const t = 0.12 + hash2(rect.x + i * 7, rect.y) * 0.7;
          const px = wide ? rect.x + along * t : rect.x + 6;
          const py = wide ? rect.y + 6 : rect.y + along * t;
          ctx.fillRect(px, py, wide ? 16 : 12, wide ? 11 : 16);
        }
        // Monitor with a glowing screen.
        const mx = wide ? rect.x + along * 0.45 : rect.x + 5;
        const my = wide ? rect.y + 5 : rect.y + along * 0.45;
        ctx.fillStyle = '#10141c';
        ctx.fillRect(mx, my, wide ? 26 : 16, wide ? 16 : 26);
        ctx.fillStyle = '#6eb4ff';
        ctx.fillRect(mx + 3, my + 3, wide ? 20 : 10, wide ? 10 : 20);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(mx + 3, my + 3, wide ? 20 : 10, 3);
        // Gold ingots / boxes on vault racks.
        ctx.fillStyle = '#f2c94c';
        const gx = wide ? rect.x + along * 0.78 : rect.x + 7;
        const gy = wide ? rect.y + 7 : rect.y + along * 0.78;
        ctx.fillRect(gx, gy, 14, 7);
        ctx.fillRect(gx + 3, gy - 6, 10, 6);
      } else { // low cover: planter with foliage / glass display case
        ctx.fillStyle = PALETTE.cover;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = PALETTE.coverTop;
        ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
        // Foliage blobs (deterministic per rect).
        ctx.fillStyle = '#7a9a58';
        const blobs = Math.max(3, Math.floor(Math.max(rect.w, rect.h) / 18));
        for (let i = 0; i < blobs; i += 1) {
          const bx = rect.x + 8 + hash2(rect.x * 3 + i, rect.y) * (rect.w - 16);
          const by = rect.y + 8 + hash2(rect.x, rect.y * 5 + i) * (rect.h - 16);
          ctx.beginPath();
          ctx.arc(bx, by, 5 + hash2(i, rect.x) * 4, 0, Math.PI * 2);
          ctx.fill();
        }
        // Glass shine diagonal.
        ctx.strokeStyle = 'rgba(207,228,247,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rect.x + 6, rect.y + rect.h - 6);
        ctx.lineTo(rect.x + rect.w * 0.45, rect.y + 5);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      }
    }
  }

  function drawLasers(state) {
    const armed = ALARM.levels[state.alarmLevel].lasersArmed;
    for (const laser of state.lasers) {
      ctx.strokeStyle = armed ? PALETTE.laser : 'rgba(255,77,94,0.25)';
      ctx.lineWidth = armed ? 2.5 : 1.5;
      if (!armed) ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#39424f';
      ctx.fillRect(laser.x1 - 4, laser.y1 - 4, 8, 8);
      ctx.fillRect(laser.x2 - 4, laser.y2 - 4, 8, 8);
      ctx.fillStyle = armed ? PALETTE.laser : '#6b7686';
      ctx.beginPath();
      ctx.arc(laser.x1, laser.y1, 2, 0, Math.PI * 2);
      ctx.arc(laser.x2, laser.y2, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLoot(state) {
    const pulse = 0.6 + 0.4 * Math.sin(state.elapsed * 3);
    for (const item of state.loot) {
      if (item.taken) continue;
      const { x, y } = item;
      // Pedestal: a dark plinth with a gold rim under every loot target.
      ctx.fillStyle = '#2a3040';
      ctx.fillRect(x - 18, y + 8, 36, 10);
      ctx.fillStyle = '#e8b23a';
      ctx.fillRect(x - 18, y + 8, 36, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y + 19, 20, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Glow so loot targets read at a glance (and in screenshots).
      ctx.globalAlpha = 0.28 * pulse;
      ctx.fillStyle = item.kind === 'cash' ? PALETTE.lootCash : item.kind === 'gems' ? PALETTE.lootGems : item.kind === 'gold' ? PALETTE.lootGold : PALETTE.lootArtifact;
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(242,201,76,${(0.5 * pulse).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 21, 0, Math.PI * 2);
      ctx.stroke();
      if (item.kind === 'cash') {
        ctx.fillStyle = PALETTE.lootCash;
        ctx.fillRect(x - 13, y - 8, 26, 16);
        ctx.fillStyle = '#1e5c33';
        ctx.fillRect(x - 3, y - 8, 6, 16);
        text('$', x, y + 5, 13, '#eafff0', 'center', true);
      } else if (item.kind === 'gems') {
        ctx.fillStyle = PALETTE.lootGems;
        ctx.beginPath();
        ctx.moveTo(x, y - 12);
        ctx.lineTo(x + 10, y - 2);
        ctx.lineTo(x, y + 12);
        ctx.lineTo(x - 10, y - 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.moveTo(x, y - 12);
        ctx.lineTo(x + 5, y - 2);
        ctx.lineTo(x, y + 3);
        ctx.lineTo(x - 5, y - 2);
        ctx.closePath();
        ctx.fill();
      } else if (item.kind === 'gold') {
        ctx.fillStyle = PALETTE.lootGold;
        ctx.fillRect(x - 14, y + 2, 28, 9);
        ctx.fillRect(x - 10, y - 8, 20, 9);
        ctx.fillStyle = '#b98a1e';
        ctx.fillRect(x - 14, y + 9, 28, 2);
      } else { // artifact: a four-point star on a pedestal
        ctx.fillStyle = '#39424f';
        ctx.fillRect(x - 12, y + 6, 24, 8);
        ctx.fillStyle = PALETTE.lootArtifact;
        ctx.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? 13 : 5;
          const px = x + Math.cos(a) * r;
          const py = y - 2 + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
      // Value tag on a dark pill so it reads at thumbnail size.
      ctx.textBaseline = 'top';
      const tag = `$${item.value.toLocaleString('en-US')}`;
      ctx.font = `700 12px ${FONT}`;
      const tagW = ctx.measureText(tag).width + 12;
      ctx.fillStyle = 'rgba(11,14,20,0.82)';
      ctx.fillRect(x - tagW / 2, y + 20, tagW, 17);
      ctx.strokeStyle = 'rgba(242,201,76,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - tagW / 2 + 0.5, y + 20.5, tagW - 1, 16);
      text(tag, x, y + 22, 12, '#f2c94c', 'center', true);
    }
  }

  /** A vision cone as a raycast fan that stops at walls — the same geometry the rules use.
   *  Camera cones get CCTV scan-line arcs so they never read as guard cones. */
  function drawCone(state, x, y, angle, range, halfAngle, fill, scanLines) {
    const rays = 26;
    const dists = [];
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i <= rays; i += 1) {
      const a = angle - halfAngle + (2 * halfAngle * i) / rays;
      const d = rayDistance(state.walls, x, y, a, range);
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

  function drawGuards(state) {
    for (const guard of state.guards) {
      const hot = guard.mode === 'chase' || guard.meter > 0.65;
      // Flashlight origin: the cone starts at the guard's front, not the body centre.
      const fx = guard.x + Math.cos(guard.angle) * (GUARD.radius + 2);
      const fy = guard.y + Math.sin(guard.angle) * (GUARD.radius + 2);
      drawCone(state, fx, fy, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle,
        hot ? PALETTE.guardConeHot : PALETTE.guardCone, false);
    }
    for (const guard of state.guards) {
      const r = GUARD.radius;
      const a = guard.angle;
      const px = Math.cos(a + Math.PI / 2);
      const py = Math.sin(a + Math.PI / 2);
      // Soft shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(guard.x, guard.y + 6, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
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
      ctx.arc(guard.x + Math.cos(a) * 3, guard.y + Math.sin(a) * 3, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.guardTrim;
      ctx.beginPath();
      ctx.arc(guard.x + Math.cos(a) * 3, guard.y + Math.sin(a) * 3, 8, a - 1.9, a + 1.9);
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
        text(mark, guard.x, guard.y - r - 21, 17, color, 'center', true);
      }
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      // Housing sits proud of the wall mount so wall cameras stay visible below the HUD.
      const hx = camera.x + Math.cos(camera.baseAngle) * 20;
      const hy = camera.y + Math.sin(camera.baseAngle) * 20;
      drawCone(state, hx, hy, camera.angle, CAMERA.viewRange, CAMERA.viewHalfAngle,
        camera.seeing ? PALETTE.cameraConeHot : PALETTE.cameraCone, true);
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
      // Housing: a big rounded box rotated to the sweep angle.
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-13, -8, 30, 20);
      ctx.fillStyle = '#d7e3ef';
      ctx.fillRect(-14, -10, 30, 20);
      ctx.fillStyle = '#8fa8c0';
      ctx.fillRect(-14, -10, 30, 5);
      ctx.strokeStyle = '#10141c';
      ctx.lineWidth = 2;
      ctx.strokeRect(-14, -10, 30, 20);
      // Lens barrel + glass.
      ctx.fillStyle = '#10141c';
      ctx.beginPath();
      ctx.arc(14, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = camera.seeing ? '#ff4d5e' : '#6eb4ff';
      ctx.beginPath();
      ctx.arc(14, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(12.5, -1.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // REC dot: blinks, solid red while the thief is in frame.
      const on = camera.seeing || Math.floor(state.elapsed * 2) % 2 === 0;
      ctx.fillStyle = on ? '#ff4d5e' : '#5a2b30';
      ctx.beginPath();
      ctx.arc(hx - Math.cos(camera.baseAngle) * 8, hy - Math.sin(camera.baseAngle) * 8 - 12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // "CAMERA" label on a dark pill, stepped into the room so it never hides under HUD.
      const lx = hx + Math.cos(camera.baseAngle) * 34;
      const ly = hy + Math.sin(camera.baseAngle) * 34;
      ctx.textBaseline = 'middle';
      ctx.font = `700 12px ${FONT}`;
      const labelW = ctx.measureText('CAMERA').width + 14;
      ctx.fillStyle = camera.seeing ? 'rgba(90,20,28,0.9)' : 'rgba(11,14,20,0.85)';
      ctx.fillRect(lx - labelW / 2, ly - 10, labelW, 20);
      ctx.strokeStyle = camera.seeing ? '#ff4d5e' : '#6eb4ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(lx - labelW / 2 + 0.5, ly - 9.5, labelW - 1, 19);
      text('CAMERA', lx, ly + 1, 12, camera.seeing ? '#ffb3ba' : '#cfe4f7', 'center', true);
      if (camera.seeing) {
        text('● REC', lx, ly + 20, 11, '#ff4d5e', 'center', true);
      }
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    const radius = p.crouch ? PLAYER.radius - 3 : PLAYER.radius;
    const a = p.angle;
    const px = Math.cos(a + Math.PI / 2);
    const py = Math.sin(a + Math.PI / 2);
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
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 6, radius, radius * 0.7, 0, 0, Math.PI * 2);
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
    text('$', bagX, bagY + 1, 13, '#3a2c10', 'center', true);
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
    ctx.arc(p.x + Math.cos(a) * 3, p.y + Math.sin(a) * 3, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerTrim;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(a) * 3, p.y + Math.sin(a) * 3, 8.5, a - 1.15, a + 1.15);
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
    if (p.crouch) {
      ctx.strokeStyle = 'rgba(159,180,200,0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Grab / extraction progress ring.
    const progress = Math.max(p.grabProgress, p.extractProgress);
    if (progress > 0) {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = p.extractProgress > 0 ? '#58dc9c' : '#f2c94c';
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
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
    text('YOU', p.x, youY + 1, 13, '#10141c', 'center', true);
  }

  function drawEffects(state) {
    for (const coin of state.coinsInFlight) {
      const x = coin.x + (coin.tx - coin.x) * coin.t;
      const y = coin.y + (coin.ty - coin.y) * coin.t - Math.sin(coin.t * Math.PI) * 26;
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
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
      ctx.globalAlpha = Math.min(1, f.life);
      text(f.text, f.x, f.y, 16, f.color, 'center', true);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best) {
    const p = state.player;
    ctx.textBaseline = 'top';
    // Top-left: haul, bag, coins.
    ctx.fillStyle = 'rgba(11,14,20,0.72)';
    ctx.fillRect(14, 12, 330, 86);
    ctx.strokeStyle = 'rgba(232,178,58,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(14.5, 12.5, 329, 85);
    text(`HAUL  $${p.haul.toLocaleString('en-US')}`, 26, 20, 24, '#7de8a0', 'left', true);
    text(`BAG ${p.weight}/${PLAYER.bagCapacity}   COINS ${p.coins}   BEST $${best.toLocaleString('en-US')}`, 26, 52, 15, PALETTE.text, 'left');
    text(state.level.name, 26, 74, 13, PALETTE.muted, 'left', true);

    // Centre-top: the alarm meter — the brief's required element, big and readable.
    const meterW = 380;
    const meterX = (FIELD.width - meterW) / 2;
    const levelName = ALARM.levels[state.alarmLevel].name;
    ctx.fillStyle = 'rgba(11,14,20,0.72)';
    ctx.fillRect(meterX - 12, 12, meterW + 24, 64);
    ctx.strokeStyle = ALARM_COLORS[state.alarmLevel];
    ctx.strokeRect(meterX - 11.5, 12.5, meterW + 23, 63);
    text(`ALARM — ${levelName}`, FIELD.width / 2, 18, 18, ALARM_COLORS[state.alarmLevel], 'center', true);
    ctx.fillStyle = '#2a3040';
    ctx.fillRect(meterX, 44, meterW, 16);
    ctx.fillStyle = ALARM_COLORS[state.alarmLevel];
    ctx.fillRect(meterX, 44, (meterW * state.alarm) / ALARM.max, 16);
    // Threshold ticks at SUSPICIOUS / HUNTED / LOCKDOWN.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const lvl of ALARM.levels.slice(1)) {
      ctx.fillRect(meterX + (meterW * lvl.at) / ALARM.max, 42, 2, 20);
    }

    // Top-right: timer + minimap.
    text(formatTime(state.elapsed), FIELD.width - 26, 16, 24, PALETTE.text, 'right', true);
    drawMinimap(state);

    // Bottom objective line.
    ctx.fillStyle = 'rgba(11,14,20,0.72)';
    ctx.fillRect(14, FIELD.height - 44, 560, 32);
    const objective = p.haul > 0
      ? 'Objective: reach the GETAWAY VAN and hold E to escape — or grab more loot'
      : 'Objective: hold E beside loot to grab it, then escape at the van';
    text(objective, 26, FIELD.height - 36, 15, PALETTE.text, 'left');
    text('WASD move · Shift sprint · C crouch · E grab/escape · Click toss coin · P pause · M mute',
      FIELD.width - 26, FIELD.height - 36, 13, PALETTE.muted, 'right');

    // Alarm vignette pulse at HUNTED and above.
    if (state.alarmLevel >= 2) {
      const a = 0.10 + 0.08 * Math.sin(state.elapsed * 5);
      ctx.strokeStyle = `rgba(255,60,70,${a.toFixed(3)})`;
      ctx.lineWidth = 18;
      ctx.strokeRect(9, 9, FIELD.width - 18, FIELD.height - 18);
    }
  }

  function drawMinimap(state) {
    const mw = 196;
    const mh = 110;
    const mx = FIELD.width - mw - 14;
    const my = 52;
    const sx = mw / FIELD.width;
    const sy = mh / FIELD.height;
    ctx.fillStyle = 'rgba(11,14,20,0.78)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = 'rgba(147,160,180,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
    ctx.fillStyle = 'rgba(90,106,134,0.8)';
    for (const rect of state.walls) {
      if (rect.kind !== 'wall') continue;
      ctx.fillRect(mx + rect.x * sx, my + rect.y * sy, Math.max(1, rect.w * sx), Math.max(1, rect.h * sy));
    }
    const zone = state.level.extract;
    ctx.fillStyle = '#58dc9c';
    ctx.fillRect(mx + zone.x * sx, my + zone.y * sy, zone.w * sx, zone.h * sy);
    for (const item of state.loot) {
      if (item.taken) continue;
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(mx + item.x * sx - 2, my + item.y * sy - 2, 4, 4);
    }
    for (const camera of state.cameras) {
      ctx.fillStyle = '#6eb4ff';
      ctx.beginPath();
      ctx.arc(mx + camera.x * sx, my + camera.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const guard of state.guards) {
      ctx.fillStyle = guard.mode === 'chase' ? '#ff4d5e' : '#c85a64';
      ctx.beginPath();
      ctx.arc(mx + guard.x * sx, my + guard.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.textBaseline = 'top';
    text('MAP', mx + 6, my + 4, 10, PALETTE.muted, 'left', true);
  }

  function drawPanel(title, titleColor, lines, prompt) {
    const width = 640;
    const height = 120 + lines.length * 30 + 56;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
    ctx.textBaseline = 'top';
    text(title, FIELD.width / 2, y + 24, 40, titleColor, 'center', true);
    lines.forEach((line, i) => {
      text(line, FIELD.width / 2, y + 92 + i * 30, 18, PALETTE.text, 'center');
    });
    text(prompt, FIELD.width / 2, y + height - 44, 17, PALETTE.playerTrim, 'center', true);
  }

  function draw(state, screen, best, rating) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    drawFloors(state);
    drawExtractZone(state);
    drawLasers(state);
    drawLoot(state);
    drawCameras(state);   // cones under the actors
    drawGuards(state);
    drawWalls(state);     // walls over cone edges so rooms read cleanly
    drawPlayer(state);
    drawEffects(state);

    // Soft vignette for depth.
    const grad = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    if (screen === SCREEN_TITLE) {
      drawHud(state, best);
      drawPanel('VAULT ZERO', PALETTE.playerTrim, [
        'The Silent Extraction — a top-down heist',
        'Cross the bank, fill your bag, and vanish in the van.',
        'Guards see in cones. Cameras feed the alarm. Lasers arm at HUNTED.',
        'WASD move · Shift sprint · C crouch · hold E to grab & escape',
        'Mouse aims · click tosses a coin · heavier loot slows you down',
        state.level.name,
      ], 'Press SPACE or click to start the heist');
    } else if (screen === SCREEN_PAUSED) {
      drawHud(state, best);
      drawPanel('PAUSED', PALETTE.text, ['The bank holds its breath.'], 'Press P or SPACE to resume');
    } else if (screen === SCREEN_OVER) {
      drawHud(state, best);
      drawPanel('CAUGHT!', '#ff4d5e', [
        'A guard got a hand on you. The vault keeps its secrets — this time.',
        `Haul lost: $${state.player.haul.toLocaleString('en-US')} · Time: ${formatTime(state.elapsed)}`,
        `Detections: ${state.detections} · Peak alarm: ${Math.round(state.alarmPeak)}%`,
      ], 'Press SPACE or click to try the heist again');
    } else if (screen === SCREEN_WIN) {
      drawHud(state, best);
      const next = state.levelIndex + 1 < 2 ? 'SPACE: rob the VAULT ANNEX next' : 'SPACE: back to the title';
      drawPanel('CLEAN GETAWAY!', '#7de8a0', [
        `Haul secured: $${state.player.haul.toLocaleString('en-US')}`,
        `Time: ${formatTime(state.elapsed)} · Detections: ${state.detections} · Peak alarm: ${Math.round(state.alarmPeak)}%`,
        `GHOST RATING: ${rating || '—'}`,
        `Best haul: $${best.toLocaleString('en-US')}`,
      ], next);
    } else {
      drawHud(state, best);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, toField };
}
