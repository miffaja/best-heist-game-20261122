// Drawing the bank itself: room floors and materials, walls and furniture, set
// dressing, patrol routes, vent grates, laser tripwires, loot targets and the
// locked vault doors. Pure rendering — the simulation lives in world.js.
import { ALARM, FIELD, FONT, PALETTE, VAULT } from './config.js';
import { hash2, text } from './draw-helpers.js';

export function drawRoomFloor(ctx, room) {
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

export function drawFloors(ctx, state) {
  ctx.fillStyle = PALETTE.backdrop;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  for (const room of state.level.rooms) {
    ctx.fillStyle = PALETTE[room.tint];
    ctx.fillRect(room.x, room.y, room.w, room.h);
    drawRoomFloor(ctx, room);
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
    // Woven diamond pattern so the lobby rug reads as a rug, not a blue slab.
    ctx.fillStyle = 'rgba(207,228,247,0.10)';
    for (let ry = 200; ry < 322; ry += 24) {
      for (let rx = 102; rx < 322; rx += 24) {
        ctx.beginPath();
        ctx.moveTo(rx, ry - 6);
        ctx.lineTo(rx + 6, ry);
        ctx.lineTo(rx, ry + 6);
        ctx.lineTo(rx - 6, ry);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(232,178,58,0.30)';
    ctx.lineWidth = 2;
    ctx.strokeRect(98, 198, 214, 114);
  } else {
    ctx.fillStyle = 'rgba(122,46,58,0.4)';
    ctx.fillRect(470, 252, 340, 216);
    ctx.strokeStyle = 'rgba(232,178,58,0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(478, 260, 324, 200);
  }
  // (The vault doors themselves are drawn by drawVaultDoors, at their real blockers.)
  // The floor's name painted big on its open floor — each floor announces itself, so
  // a shrunken frame still says which of the three floors this is.
  if (state.level.banner) {
    ctx.globalAlpha = 0.10;
    text(ctx, state.level.banner.text, state.level.banner.x, state.level.banner.y, 46, '#cfe4f7', 'center', true);
    ctx.globalAlpha = 1;
  }
  // Room nameplates, faint so they read as floor markings. Top rooms step below the
  // HUD band so GALLERY / VAULT are never clipped by the alarm meter or haul box.
  for (const room of state.level.rooms) {
    ctx.globalAlpha = 0.5;
    const labelY = room.y < 100 ? room.y + 108 : room.y + 10;
    text(ctx, room.label, room.x + 14, labelY, 15, PALETTE.muted, 'left', true);
    ctx.globalAlpha = 1;
  }
}

export function drawExtractZone(ctx, state) {
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
  text(ctx, 'GETAWAY VAN', zone.x + zone.w / 2, zone.y + 4, 13, '#7de8a0', 'center', true);
}

export function drawPatrolRoutes(ctx, state) {
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

export function drawVents(ctx, state) {
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
    text(ctx, 'VENT', vent.x, vent.y + 29, 10, '#cfe4f7', 'center', true);
  }
}

export function drawWalls(ctx, state) {
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

export function drawProps(ctx, state) {
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
      text(ctx, 'SECURITY', x, y + 13, 8, PALETTE.muted, 'center', true);
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
          const ledColor = led === 2 ? '#f2c94c' : PALETTE.serverLight;
          if (on) {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = ledColor;
            ctx.beginPath();
            ctx.arc(x - 12 + led * 9, ry, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.fillStyle = on ? ledColor : '#2a3040';
          ctx.beginPath();
          ctx.arc(x - 12 + led * 9, ry, 2.6, 0, Math.PI * 2);
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

export function drawLasers(ctx, state) {
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
      text(ctx, 'LASER', mx, my + 1, 10, '#ffb3ba', 'center', true);
    }
  }
}

export function drawLoot(ctx, state) {
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
      text(ctx, '$', x, y + 5, 13, '#eafff0', 'center', true);
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
    text(ctx, tag, x, y + 22, 12, '#f2c94c', 'center', true);
  }
}

export function drawVaultDoors(ctx, state) {
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
    text(ctx, label, lx, ly + 1, 12, door.open ? '#7de8a0' : '#f2c94c', 'center', true);
  }
}
