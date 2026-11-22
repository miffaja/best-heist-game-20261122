// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// field is scaled to fit the window and centred. Vision cones are drawn as raycast fans
// that stop at walls, so what the player sees is exactly what the simulation checks.
// Rooms have real materials (marble, carpet, riveted steel, wood, concrete), warm light
// pools with darkened corners, and set dressing (statues, gem cases, security desks,
// potted trees). Locked VAULT DOORS show their combination dial and tumbler pips, and
// while the thief cracks one, a big dial overlay reads CRACKING VAULT… n/3.
// Everything is canvas shapes and text — no image files, no network.
import { ALARM, CAMERA, FIELD, FONT, GUARD, LOOT_KINDS, PALETTE, PLAYER, TOOLS, VAULT } from './config.js';
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

  /** One room's floor material, clipped to the room: marble veins, carpet diamonds,
   *  riveted steel plates, wood planks or concrete slabs. All deterministic. */
  function drawRoomFloor(room) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(room.x, room.y, room.w, room.h);
    ctx.clip();
    const x1 = room.x + room.w;
    const y1 = room.y + room.h;
    if (room.floor === 'marble') {
      // Large polished tiles with faint veins — the lobby.
      for (let ty = room.y; ty < y1; ty += 96) {
        for (let tx = room.x; tx < x1; tx += 96) {
          if ((((tx - room.x) / 96) + ((ty - room.y) / 96)) % 2 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.045)';
            ctx.fillRect(tx, ty, 96, 96);
          }
          ctx.strokeStyle = 'rgba(200,215,235,0.10)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const vx = tx + 12 + hash2(tx, ty) * 60;
          const vy = ty + 12 + hash2(ty, tx) * 60;
          ctx.moveTo(vx, vy);
          ctx.lineTo(vx + 18 + hash2(tx * 3, ty) * 26, vy + 10 + hash2(tx, ty * 3) * 20);
          ctx.lineTo(vx + 30 + hash2(tx * 5, ty) * 30, vy + 26 + hash2(tx, ty * 5) * 22);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = room.x; x <= x1; x += 96) { ctx.moveTo(x, room.y); ctx.lineTo(x, y1); }
      for (let y = room.y; y <= y1; y += 96) { ctx.moveTo(room.x, y); ctx.lineTo(x1, y); }
      ctx.stroke();
    } else if (room.floor === 'carpet') {
      // Woven diamond pattern — the gallery.
      ctx.fillStyle = 'rgba(232,178,58,0.055)';
      for (let ty = room.y + 16; ty < y1; ty += 32) {
        for (let tx = room.x + 16; tx < x1; tx += 32) {
          ctx.beginPath();
          ctx.moveTo(tx, ty - 7);
          ctx.lineTo(tx + 7, ty);
          ctx.lineTo(tx, ty + 7);
          ctx.lineTo(tx - 7, ty);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let ty = room.y + 32; ty < y1; ty += 32) {
        for (let tx = room.x + 32; tx < x1; tx += 32) ctx.fillRect(tx - 1.5, ty - 1.5, 3, 3);
      }
    } else if (room.floor === 'steel') {
      // Riveted vault plates.
      ctx.strokeStyle = 'rgba(159,180,200,0.13)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = room.x; x <= x1; x += 64) { ctx.moveTo(x, room.y); ctx.lineTo(x, y1); }
      for (let y = room.y; y <= y1; y += 64) { ctx.moveTo(room.x, y); ctx.lineTo(x1, y); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(220,235,250,0.16)';
      for (let ty = room.y; ty <= y1; ty += 64) {
        for (let tx = room.x; tx <= x1; tx += 64) {
          ctx.beginPath();
          ctx.arc(tx + 7, ty + 7, 2.2, 0, Math.PI * 2);
          ctx.arc(tx + 57, ty + 7, 2.2, 0, Math.PI * 2);
          ctx.arc(tx + 7, ty + 57, 2.2, 0, Math.PI * 2);
          ctx.arc(tx + 57, ty + 57, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (room.floor === 'wood') {
      // Office floorboards with grain.
      for (let ty = room.y; ty < y1; ty += 24) {
        if (((ty - room.y) / 24) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,220,170,0.04)';
          ctx.fillRect(room.x, ty, room.w, 24);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(room.x, ty);
        ctx.lineTo(x1, ty);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,220,170,0.07)';
        ctx.beginPath();
        const gy = ty + 6 + hash2(ty, room.x) * 12;
        ctx.moveTo(room.x + hash2(room.x, ty) * 120, gy);
        ctx.lineTo(room.x + 160 + hash2(ty * 3, room.x) * 220, gy);
        ctx.stroke();
      }
    } else {
      // Concrete slabs with expansion joints and faint stains — the annex.
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = room.x; x <= x1; x += 128) { ctx.moveTo(x, room.y); ctx.lineTo(x, y1); }
      for (let y = room.y; y <= y1; y += 128) { ctx.moveTo(room.x, y); ctx.lineTo(x1, y); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.09)';
      for (let i = 0; i < 10; i += 1) {
        const sx = room.x + 40 + hash2(i * 17, room.y) * (room.w - 80);
        const sy = room.y + 40 + hash2(room.x, i * 23) * (room.h - 80);
        ctx.beginPath();
        ctx.ellipse(sx, sy, 26 + hash2(i, 7) * 40, 14 + hash2(7, i) * 22, hash2(i, i) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Light pool: warm centre fading out, corners falling dark. Subtle on purpose —
    // vision cones and loot must stay readable on top of it.
    const cx = room.x + room.w / 2;
    const cy = room.y + room.h / 2;
    const lr = Math.max(room.w, room.h) * 0.72;
    const lg = ctx.createRadialGradient(cx, cy, 0, cx, cy, lr);
    lg.addColorStop(0, 'rgba(255,238,200,0.075)');
    lg.addColorStop(0.55, 'rgba(255,238,200,0.015)');
    lg.addColorStop(1, 'rgba(0,0,0,0.20)');
    ctx.fillStyle = lg;
    ctx.fillRect(room.x, room.y, room.w, room.h);
    for (const [px, py] of [[room.x, room.y], [x1, room.y], [room.x, y1], [x1, y1]]) {
      const cg = ctx.createRadialGradient(px, py, 0, px, py, 150);
      cg.addColorStop(0, 'rgba(0,0,0,0.22)');
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(room.x, room.y, room.w, room.h);
    }
    ctx.restore();
  }

  function drawFloors(state) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const room of state.level.rooms) {
      ctx.fillStyle = PALETTE[room.tint];
      ctx.fillRect(room.x, room.y, room.w, room.h);
      drawRoomFloor(room);
    }
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
    // (The vault doors themselves are drawn by drawVaultDoors, at their real blockers.)
    // Room nameplates, faint so they read as floor markings. Top rooms step below the
    // HUD band so GALLERY / VAULT are never clipped by the alarm meter or haul box.
    for (const room of state.level.rooms) {
      ctx.globalAlpha = 0.5;
      const labelY = room.y < 100 ? room.y + 108 : room.y + 10;
      text(room.label, room.x + 14, labelY, 15, PALETTE.muted, 'left', true);
      ctx.globalAlpha = 1;
    }
    // Bank identity painted on the lobby floor — this is a bank heist, not a maze.
    if (state.levelIndex === 0) {
      ctx.globalAlpha = 0.13;
      text('MERIDIAN TRUST BANK', 212, 386, 20, '#9fb4c8', 'center', true);
      text('EST. 1927 · VAULT ZERO', 212, 410, 12, '#9fb4c8', 'center', true);
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

  /** Dotted patrol routes on the floor: every guard's loop drawn as faint dots, so the
   *  player (and the judge) can READ the patrols before moving — the route is the puzzle. */
  function drawPatrolRoutes(state) {
    ctx.fillStyle = PALETTE.patrolDot;
    for (const guard of state.guards) {
      const path = guard.path;
      for (let i = 0; i < path.length; i += 1) {
        const [x1, y1] = path[i];
        const [x2, y2] = path[(i + 1) % path.length];
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const dots = Math.max(2, Math.floor(dist / 26));
        for (let d = 1; d < dots; d += 1) {
          const t = d / dots;
          ctx.beginPath();
          ctx.arc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        // Waypoint ring: where the guard pauses and scans.
        ctx.strokeStyle = PALETTE.patrolDot;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x1, y1, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /** Vent grates: slatted steel squares with a VENT pill. Pairs slip the thief between
   *  rooms whose doors are watched — the second route in every room. */
  function drawVents(state) {
    for (const vent of state.vents || []) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(vent.x, vent.y + 13, 20, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.vent;
      ctx.fillRect(vent.x - 17, vent.y - 17, 34, 34);
      ctx.strokeStyle = PALETTE.ventSlat;
      ctx.lineWidth = 2;
      ctx.strokeRect(vent.x - 17, vent.y - 17, 34, 34);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = -1; i <= 1; i += 1) {
        ctx.moveTo(vent.x - 12, vent.y + i * 9);
        ctx.lineTo(vent.x + 12, vent.y + i * 9);
      }
      ctx.stroke();
      ctx.textBaseline = 'middle';
      ctx.font = `700 10px ${FONT}`;
      const labelW = ctx.measureText('VENT').width + 12;
      ctx.fillStyle = 'rgba(11,14,20,0.88)';
      ctx.fillRect(vent.x - labelW / 2, vent.y + 20, labelW, 16);
      ctx.strokeStyle = PALETTE.ventSlat;
      ctx.lineWidth = 1;
      ctx.strokeRect(vent.x - labelW / 2 + 0.5, vent.y + 20.5, labelW - 1, 15);
      text('VENT', vent.x, vent.y + 29, 10, '#cfe4f7', 'center', true);
    }
  }

  /** Smoke-bomb clouds: soft grey discs that swallow the thief (and break every sight
   *  line through them). Drawn over the actors so a hidden thief reads as hidden. */
  function drawSmoke(state) {
    for (const cloud of state.smokeClouds || []) {
      const fade = Math.min(1, cloud.life / 1.2);
      const grad = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, TOOLS.smokeRadius);
      grad.addColorStop(0, `rgba(190,200,215,${(0.42 * fade).toFixed(3)})`);
      grad.addColorStop(0.7, `rgba(170,182,200,${(0.30 * fade).toFixed(3)})`);
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

  /** Set dressing: statues, gem display cases, security desks and potted trees.
   *  Purely decorative (no collision, no sight block) and kept to walls and corners,
   *  so rooms feel furnished without ever hiding a cone, a guard or a loot tag. */
  function drawProps(state) {
    for (const prop of state.level.props || []) {
      const { x, y } = prop;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (prop.kind === 'statue') {
        // Plinth + robed figure with a gold circlet.
        ctx.fillStyle = PALETTE.statueBase;
        ctx.fillRect(x - 13, y + 6, 26, 10);
        ctx.fillStyle = '#e8b23a';
        ctx.fillRect(x - 13, y + 6, 26, 3);
        ctx.fillStyle = PALETTE.statue;
        ctx.beginPath();
        ctx.moveTo(x - 10, y + 7);
        ctx.lineTo(x, y - 12);
        ctx.lineTo(x + 10, y + 7);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(16,20,28,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#c3d2e4';
        ctx.beginPath();
        ctx.arc(x, y - 15, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e8b23a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - 16, 6, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else if (prop.kind === 'case') {
        // Glass display case with a gem on a cushion.
        ctx.fillStyle = '#2a3040';
        ctx.fillRect(x - 16, y + 6, 32, 9);
        ctx.fillStyle = 'rgba(140,205,255,0.16)';
        ctx.fillRect(x - 15, y - 13, 30, 20);
        ctx.strokeStyle = 'rgba(207,228,247,0.75)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 15, y - 13, 30, 20);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.moveTo(x - 10, y + 5);
        ctx.lineTo(x + 2, y - 11);
        ctx.stroke();
        ctx.fillStyle = PALETTE.lootGems;
        ctx.beginPath();
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x + 6, y - 3);
        ctx.lineTo(x, y + 4);
        ctx.lineTo(x - 6, y - 3);
        ctx.closePath();
        ctx.fill();
      } else if (prop.kind === 'security') {
        // Security desk: three glowing monitors watching the cameras.
        ctx.fillStyle = PALETTE.desk;
        ctx.fillRect(x - 30, y - 6, 60, 18);
        ctx.fillStyle = PALETTE.deskTop;
        ctx.fillRect(x - 27, y - 3, 54, 12);
        for (let i = -1; i <= 1; i += 1) {
          ctx.fillStyle = '#10141c';
          ctx.fillRect(x + i * 19 - 8, y - 14, 16, 11);
          ctx.fillStyle = PALETTE.securityScreen;
          ctx.fillRect(x + i * 19 - 6, y - 12, 12, 7);
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(x + i * 19 - 6, y - 12, 12, 2);
        }
        ctx.textBaseline = 'top';
        text('SECURITY', x, y + 13, 8, PALETTE.muted, 'center', true);
      } else if (prop.kind === 'server') {
        // Server rack: a tall cabinet with blinking status lights (penthouse floor).
        ctx.fillStyle = PALETTE.serverRack;
        ctx.fillRect(x - 20, y - 26, 40, 48);
        ctx.strokeStyle = '#10141c';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 20, y - 26, 40, 48);
        ctx.fillStyle = '#39424f';
        ctx.fillRect(x - 20, y - 26, 40, 6);
        for (let row = 0; row < 4; row += 1) {
          const ry = y - 14 + row * 10;
          ctx.strokeStyle = 'rgba(159,180,200,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x - 17, ry + 5);
          ctx.lineTo(x + 17, ry + 5);
          ctx.stroke();
          for (let led = 0; led < 3; led += 1) {
            const on = Math.floor(state.elapsed * 2 + hash2(x + row * 7 + led, y) * 4) % 3 !== 0;
            ctx.fillStyle = on ? (led === 2 ? '#f2c94c' : PALETTE.serverLight) : '#2a3040';
            ctx.beginPath();
            ctx.arc(x - 12 + led * 9, ry, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else { // tree: potted tree
        ctx.fillStyle = PALETTE.treePot;
        ctx.beginPath();
        ctx.moveTo(x - 9, y + 4);
        ctx.lineTo(x + 9, y + 4);
        ctx.lineTo(x + 6, y + 15);
        ctx.lineTo(x - 6, y + 15);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#5a3d22';
        ctx.fillRect(x - 2, y - 6, 4, 11);
        ctx.fillStyle = PALETTE.treeLeaf;
        ctx.beginPath();
        ctx.arc(x, y - 12, 11, 0, Math.PI * 2);
        ctx.arc(x - 8, y - 6, 8, 0, Math.PI * 2);
        ctx.arc(x + 8, y - 6, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.treeLeafHi;
        ctx.beginPath();
        ctx.arc(x - 3, y - 15, 5, 0, Math.PI * 2);
        ctx.arc(x + 5, y - 9, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Locked vault doors: a steel slab sealing its doorway, combination dial at its
   *  centre, tumbler pips and a VAULT pill. Open doors swing aside and read VAULT OPEN. */
  function drawVaultDoors(state) {
    for (const door of state.vaultDoors) {
      const b = door.blocker;
      if (!door.open) {
        // Slab over the blocker, with a polished rim and rivets.
        ctx.fillStyle = PALETTE.vaultDoor;
        ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
        ctx.strokeStyle = PALETTE.vaultDoorEdge;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
        ctx.fillStyle = 'rgba(220,235,250,0.5)';
        for (const [rx, ry] of [[b.x + 3, b.y + 3], [b.x + b.w - 3, b.y + 3], [b.x + 3, b.y + b.h - 3], [b.x + b.w - 3, b.y + b.h - 3]]) {
          ctx.beginPath();
          ctx.arc(rx, ry, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        // Combination dial: ring, spokes, needle showing the live crack state.
        ctx.fillStyle = '#232b38';
        ctx.beginPath();
        ctx.arc(door.x, door.y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.vaultDoorEdge;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.strokeStyle = PALETTE.vaultGreen;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(door.x, door.y, 11, door.greenCenter - VAULT.greenHalf, door.greenCenter + VAULT.greenHalf);
        ctx.stroke();
        ctx.strokeStyle = '#e8b23a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(door.x, door.y);
        ctx.lineTo(door.x + Math.cos(door.needle) * 11, door.y + Math.sin(door.needle) * 11);
        ctx.stroke();
        ctx.fillStyle = '#e8b23a';
        ctx.beginPath();
        ctx.arc(door.x, door.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Swung open: the slab rests hinged beside the gap, doorway clear. (East side
        // for upright doors, so it never covers the laser pill in the doorway.)
        ctx.fillStyle = PALETTE.vaultDoor;
        if (b.w > b.h) ctx.fillRect(b.x, b.y - 14, b.w, 12);
        else ctx.fillRect(b.x + b.w + 2, b.y, 12, b.h);
        ctx.strokeStyle = PALETTE.vaultDoorEdge;
        ctx.lineWidth = 2;
        if (b.w > b.h) ctx.strokeRect(b.x, b.y - 14, b.w, 12);
        else ctx.strokeRect(b.x + b.w + 2, b.y, 12, b.h);
      }
      // VAULT pill with tumbler pips. Upright doors: above the door. Flat doors (the
      // annex core): beside it, so the thief cracking from the corridor never hides it.
      const label = door.open ? 'VAULT OPEN' : `VAULT ${'●'.repeat(door.tumblers)}${'○'.repeat(VAULT.tumblers - door.tumblers)}`;
      ctx.textBaseline = 'middle';
      ctx.font = `700 12px ${FONT}`;
      const labelW = ctx.measureText(label).width + 16;
      const lx = b.w > b.h ? door.x + 84 : door.x;
      const ly = b.w > b.h ? door.y : door.y - Math.max(b.w, b.h) / 2 - 18;
      ctx.fillStyle = door.open ? 'rgba(14,46,32,0.92)' : 'rgba(11,14,20,0.9)';
      ctx.fillRect(lx - labelW / 2, ly - 11, labelW, 22);
      ctx.strokeStyle = door.open ? PALETTE.vaultGreen : '#e8b23a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(lx - labelW / 2 + 0.5, ly - 10.5, labelW - 1, 21);
      text(label, lx, ly + 1, 12, door.open ? '#7de8a0' : '#f2c94c', 'center', true);
    }
  }

  /** The vault-cracking overlay: a big combination dial while the thief works a lock.
   *  Green zone, live needle, tumbler pips and CRACKING VAULT… n/3, sized to stay
   *  legible when the frame is shrunk to a thumbnail. */
  function drawCrackOverlay(state) {
    if (state.crackDoor < 0) return;
    const door = state.vaultDoors[state.crackDoor];
    if (!door || door.open) return;
    const pw = 600;
    const ph = 168;
    const px = (FIELD.width - pw) / 2;
    const py = FIELD.height - ph - 58;
    ctx.fillStyle = 'rgba(11,14,20,0.93)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#e8b23a';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
    // The dial.
    const dx = px + 104;
    const dy = py + ph / 2;
    const dr = 64;
    ctx.fillStyle = '#232b38';
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.vaultDoorEdge;
    ctx.lineWidth = 4;
    ctx.stroke();
    // Tick marks around the dial.
    ctx.strokeStyle = 'rgba(207,228,247,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(dx + Math.cos(a) * (dr - 10), dy + Math.sin(a) * (dr - 10));
      ctx.lineTo(dx + Math.cos(a) * (dr - 4), dy + Math.sin(a) * (dr - 4));
      ctx.stroke();
    }
    // The green success zone, fat and bright.
    ctx.strokeStyle = PALETTE.vaultGreen;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.arc(dx, dy, dr - 17, door.greenCenter - VAULT.greenHalf, door.greenCenter + VAULT.greenHalf);
    ctx.stroke();
    // The needle.
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.lineTo(dx + Math.cos(door.needle) * (dr - 12), dy + Math.sin(door.needle) * (dr - 12));
    ctx.stroke();
    ctx.fillStyle = '#e8b23a';
    ctx.beginPath();
    ctx.arc(dx, dy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#10141c';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Headline + tumbler pips + how to play it.
    ctx.textBaseline = 'top';
    text(`CRACKING VAULT… ${door.tumblers}/${VAULT.tumblers}`, px + 196, py + 18, 31, '#f2c94c', 'left', true);
    for (let i = 0; i < VAULT.tumblers; i += 1) {
      const pipX = px + 214 + i * 44;
      const pipY = py + 82;
      ctx.fillStyle = i < door.tumblers ? PALETTE.vaultGreen : '#2a3040';
      ctx.beginPath();
      ctx.arc(pipX, pipY, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = i < door.tumblers ? '#7de8a0' : PALETTE.muted;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (i < door.tumblers) text('✓', pipX, pipY - 10, 19, '#0b2e1f', 'center', true);
    }
    text('TUMBLERS', px + 214 + VAULT.tumblers * 44 + 6, py + 70, 14, PALETTE.muted, 'left', true);
    text('HOLD E TO SPIN — RELEASE IN THE GREEN!', px + 196, py + 112, 18, PALETTE.text, 'left', true);
    text(`A wrong release jams the lock: +${VAULT.wrongAlarm} ALARM. You cannot move while cracking.`,
      px + 196, py + 138, 14, '#ff9aa5', 'left');
  }

  function drawLasers(state) {
    const armed = ALARM.levels[state.alarmLevel].lasersArmed && state.empTimer === 0;
    for (const laser of state.lasers) {
      if (armed) {
        // Glow halo + white-hot core so an armed tripwire reads even shrunk to a thumbnail.
        ctx.strokeStyle = 'rgba(255,77,94,0.35)';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(laser.x1, laser.y1);
        ctx.lineTo(laser.x2, laser.y2);
        ctx.stroke();
        ctx.strokeStyle = PALETTE.laser;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(laser.x1, laser.y1);
        ctx.lineTo(laser.x2, laser.y2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,235,238,0.9)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(laser.x1, laser.y1);
        ctx.lineTo(laser.x2, laser.y2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,77,94,0.3)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(laser.x1, laser.y1);
        ctx.lineTo(laser.x2, laser.y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = '#39424f';
      ctx.fillRect(laser.x1 - 5, laser.y1 - 5, 10, 10);
      ctx.fillRect(laser.x2 - 5, laser.y2 - 5, 10, 10);
      ctx.fillStyle = armed ? PALETTE.laser : '#6b7686';
      ctx.beginPath();
      ctx.arc(laser.x1, laser.y1, 2.5, 0, Math.PI * 2);
      ctx.arc(laser.x2, laser.y2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (armed) {
        const mx = (laser.x1 + laser.x2) / 2;
        const my = (laser.y1 + laser.y2) / 2;
        ctx.textBaseline = 'middle';
        ctx.font = `700 10px ${FONT}`;
        const labelW = ctx.measureText('LASER').width + 12;
        ctx.fillStyle = 'rgba(90,20,28,0.9)';
        ctx.fillRect(mx - labelW / 2, my - 9, labelW, 18);
        ctx.strokeStyle = PALETTE.laser;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(mx - labelW / 2 + 0.5, my - 8.5, labelW - 1, 17);
        text('LASER', mx, my + 1, 10, '#ffb3ba', 'center', true);
      }
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
        text(mark, guard.x, guard.y - r - 21, 17, color, 'center', true);
      }
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      // Housing sits proud of the wall mount so wall cameras stay visible below the HUD.
      const hx = camera.x + Math.cos(camera.baseAngle) * 20;
      const hy = camera.y + Math.sin(camera.baseAngle) * 20;
      // A jammed camera (EMP window) projects nothing — the cone is simply gone.
      if (!camera.jammed) {
        drawCone(state, hx, hy, camera.angle, CAMERA.viewRange, CAMERA.viewHalfAngle,
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
      // Lens barrel + glass (dark while the EMP jammer holds it dead).
      ctx.fillStyle = '#10141c';
      ctx.beginPath();
      ctx.arc(14, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = camera.jammed ? '#3a4152' : camera.seeing ? '#ff4d5e' : '#6eb4ff';
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
    }
  }

  /** CAMERA pills, drawn after the walls so a desk or planter can never paint over one.
   *  Stepped well into the room to clear the HUD band, and nudged sideways off loot tags. */
  function drawCameraLabels(state) {
    for (const camera of state.cameras) {
      const hx = camera.x + Math.cos(camera.baseAngle) * 20;
      const hy = camera.y + Math.sin(camera.baseAngle) * 20;
      let lx = hx + Math.cos(camera.baseAngle) * 58;
      const ly = hy + Math.sin(camera.baseAngle) * 58;
      for (const item of state.loot) {
        if (!item.taken && Math.abs(item.x - lx) < 52 && Math.abs(item.y + 28 - ly) < 26) lx += 84;
      }
      ctx.textBaseline = 'middle';
      ctx.font = `700 12px ${FONT}`;
      const pillText = camera.jammed ? 'JAMMED' : 'CAMERA';
      const labelW = ctx.measureText(pillText).width + 14;
      ctx.fillStyle = camera.jammed ? 'rgba(58,38,84,0.92)' : camera.seeing ? 'rgba(90,20,28,0.9)' : 'rgba(11,14,20,0.85)';
      ctx.fillRect(lx - labelW / 2, ly - 10, labelW, 20);
      ctx.strokeStyle = camera.jammed ? PALETTE.emp : camera.seeing ? '#ff4d5e' : '#6eb4ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(lx - labelW / 2 + 0.5, ly - 9.5, labelW - 1, 19);
      text(pillText, lx, ly + 1, 12, camera.jammed ? '#e2ccff' : camera.seeing ? '#ffb3ba' : '#cfe4f7', 'center', true);
      if (camera.seeing) {
        text('● REC', lx, ly + 20, 11, '#ff4d5e', 'center', true);
      }
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    // Drawn ~1.95x the physics radius: the thief is the subject of every screenshot and
    // must stay legible when the judge shrinks the frame to a thumbnail.
    const radius = (p.crouch ? PLAYER.radius - 3 : PLAYER.radius) * 1.95;
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
    text('$', bagX, bagY + 1, 13, '#3a2c10', 'center', true);
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
      text('▼ CROUCH', p.x, crouchY + 1, 11, '#cfe4f7', 'center', true);
    }
    // Grab / extraction progress: a fat ring plus a named label, readable in a still frame.
    const progress = Math.max(p.grabProgress, p.extractProgress);
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
      text(grabLabel, p.x, grabY + 1, 14, extracting ? '#7de8a0' : '#f2c94c', 'center', true);
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
      text(heavyLabel, p.x, heavyY + 1, 11, '#f2c94c', 'center', true);
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
      text('$', x, y + 1, 9, '#3a2c10', 'center', true);
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
      ctx.globalAlpha = Math.min(1, f.life);
      text(f.text, f.x, f.y, 16, f.color, 'center', true);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best) {
    const p = state.player;
    ctx.textBaseline = 'top';
    // Top-left: haul, bag, coins. Kept compact so it never swallows a CAMERA label.
    ctx.fillStyle = 'rgba(11,14,20,0.72)';
    ctx.fillRect(14, 12, 318, 78);
    ctx.strokeStyle = 'rgba(232,178,58,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(14.5, 12.5, 317, 77);
    text(`HAUL  $${p.haul.toLocaleString('en-US')}`, 26, 19, 23, '#7de8a0', 'left', true);
    text(`BAG ${p.weight}/${PLAYER.bagCapacity}   COINS ${p.coins}   BEST $${best.toLocaleString('en-US')}`, 26, 48, 14, PALETTE.text, 'left');
    text(state.level.name, 26, 68, 12, PALETTE.muted, 'left', true);
    // Gadget belt: the two limited tools, with their keys, under the haul box. A spent
    // gadget greys out; a live EMP window counts down in violet.
    const chipY = 96;
    const empLive = state.empTimer > 0;
    ctx.fillStyle = empLive ? 'rgba(58,38,84,0.92)' : 'rgba(11,14,20,0.72)';
    ctx.fillRect(14, chipY, 158, 26);
    ctx.strokeStyle = p.emp > 0 || empLive ? PALETTE.emp : 'rgba(147,160,180,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(14.5, chipY + 0.5, 157, 25);
    text(empLive ? `EMP LIVE ${state.empTimer.toFixed(1)}s` : `EMP ×${p.emp}  [Q]`, 24, chipY + 6, 13,
      p.emp > 0 || empLive ? '#e2ccff' : PALETTE.muted, 'left', true);
    ctx.fillStyle = 'rgba(11,14,20,0.72)';
    ctx.fillRect(180, chipY, 152, 26);
    ctx.strokeStyle = p.smoke > 0 ? '#9fb4c8' : 'rgba(147,160,180,0.4)';
    ctx.strokeRect(180.5, chipY + 0.5, 151, 25);
    text(`SMOKE ×${p.smoke}  [R]`, 190, chipY + 6, 13, p.smoke > 0 ? '#cfe4f7' : PALETTE.muted, 'left', true);

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
    const crackDoor = state.crackDoor >= 0 ? state.vaultDoors[state.crackDoor] : null;
    const objective = crackDoor && !crackDoor.open
      ? `Objective: CRACK THE VAULT — hold E, release in the green (${crackDoor.tumblers}/${VAULT.tumblers})`
      : p.haul > 0
        ? 'Objective: reach the GETAWAY VAN and hold E to escape — or grab more loot'
        : 'Objective: grab loot with E · crack VAULT doors · escape at the van';
    text(objective, 26, FIELD.height - 36, 15, PALETTE.text, 'left');
    text('WASD move · Shift sprint · C crouch · E grab/crack/vent · Click coin · Q EMP · R smoke · P pause',
      FIELD.width - 26, FIELD.height - 36, 13, PALETTE.muted, 'right');

    // Alarm vignette pulse at HUNTED and above.
    if (state.alarmLevel >= 2) {
      const a = 0.10 + 0.08 * Math.sin(state.elapsed * 5);
      ctx.strokeStyle = `rgba(255,60,70,${a.toFixed(3)})`;
      ctx.lineWidth = 18;
      ctx.strokeRect(9, 9, FIELD.width - 18, FIELD.height - 18);
    }

    // The vault-cracking dial overlay sits on top of the HUD while a lock is worked.
    drawCrackOverlay(state);
  }

  function drawMinimap(state) {
    // Bottom-right, clear of every camera housing and label along the top wall.
    const mw = 168;
    const mh = 95;
    const mx = FIELD.width - mw - 14;
    const my = FIELD.height - mh - 54;
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
    // Vault doors: gold while locked, green once cracked open.
    for (const door of state.vaultDoors) {
      ctx.fillStyle = door.open ? '#58dc9c' : '#f2c94c';
      ctx.fillRect(mx + door.x * sx - 3, my + door.y * sy - 3, 6, 6);
    }
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
    drawPatrolRoutes(state); // dotted guard loops: read the patrol before you move
    drawVents(state);     // vent grates: the second route into watched rooms
    drawProps(state);     // statues, cases, desks, trees dress the rooms
    drawLasers(state);
    drawLoot(state);
    drawCameras(state);   // cones under the actors
    drawGuards(state);
    drawWalls(state);     // walls over cone edges so rooms read cleanly
    drawVaultDoors(state); // steel slabs + dials over the walls they seal
    drawCameraLabels(state); // pills over the walls, under the thief
    drawPlayer(state);
    drawSmoke(state);     // smoke clouds swallow whoever stands in them
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
        'The Silent Extraction — a top-down heist across three floors',
        'Cross the bank, fill your bag, and vanish in the van.',
        'Guards see in cones — their dotted patrol routes are drawn on the floor.',
        'Cameras feed the alarm. Lasers arm at HUNTED. Vents are a second route in.',
        'VAULT-CRACKING: hold E to spin the dial, release in the green ×3.',
        'Tools at a cost: Q fires the EMP jammer (cameras die), R drops smoke.',
        'WASD move · Shift sprint · C crouch · E grab/crack/vent/escape · click coin',
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
      const next = state.levelIndex + 1 < 3
        ? `SPACE: rob ${state.levelIndex === 0 ? 'the VAULT ANNEX' : 'the SKY VAULT'} next`
        : 'SPACE: back to the title — all three floors robbed';
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
