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
    // Floor tile grid.
    ctx.strokeStyle = PALETTE.floorTileLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 24; x < FIELD.width - 24; x += 48) { ctx.moveTo(x, 24); ctx.lineTo(x, FIELD.height - 24); }
    for (let y = 24; y < FIELD.height - 24; y += 48) { ctx.moveTo(24, y); ctx.lineTo(FIELD.width - 24, y); }
    ctx.stroke();
    // Room nameplates, faint so they read as floor markings.
    ctx.textBaseline = 'top';
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
    ctx.textBaseline = 'top';
    text('GETAWAY VAN', zone.x + zone.w / 2, zone.y + 4, 13, '#7de8a0', 'center', true);
  }

  function drawWalls(state) {
    for (const rect of state.walls) {
      if (rect.kind === 'wall') {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(rect.x, rect.y, rect.w, Math.min(5, rect.h));
        ctx.strokeStyle = PALETTE.wallEdge;
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      } else if (rect.kind === 'desk') {
        ctx.fillStyle = PALETTE.desk;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = PALETTE.deskTop;
        ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
      } else { // low cover: planter / display case
        ctx.fillStyle = PALETTE.cover;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = PALETTE.coverTop;
        ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
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
      // Glow so loot targets read at a glance (and in screenshots).
      ctx.globalAlpha = 0.25 * pulse;
      ctx.fillStyle = item.kind === 'cash' ? PALETTE.lootCash : item.kind === 'gems' ? PALETTE.lootGems : item.kind === 'gold' ? PALETTE.lootGold : PALETTE.lootArtifact;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
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
      // Value tag.
      ctx.textBaseline = 'top';
      text(`$${item.value.toLocaleString('en-US')}`, x, y + 15, 11, PALETTE.text, 'center', true);
    }
  }

  /** A vision cone as a raycast fan that stops at walls — the same geometry the rules use. */
  function drawCone(state, x, y, angle, range, halfAngle, fill) {
    const rays = 26;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i <= rays; i += 1) {
      const a = angle - halfAngle + (2 * halfAngle * i) / rays;
      const d = rayDistance(state.walls, x, y, a, range);
      ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      const hot = guard.mode === 'chase' || guard.meter > 0.65;
      drawCone(state, guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle,
        hot ? PALETTE.guardConeHot : PALETTE.guardCone);
    }
    for (const guard of state.guards) {
      // Soft shadow, body, cap, facing tick.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(guard.x, guard.y + 5, 13, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.guard;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.guardTrim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius - 2, guard.angle - 0.7, guard.angle + 0.7);
      ctx.stroke();
      ctx.fillStyle = PALETTE.guardTrim;
      ctx.beginPath();
      ctx.arc(guard.x + Math.cos(guard.angle) * 7, guard.y + Math.sin(guard.angle) * 7, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // Detection meter arc over the head: yellow filling to red.
      if (guard.meter > 0.02) {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y - 20, 8, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = guard.meter > 0.65 ? '#ff4d5e' : '#f2c94c';
        ctx.beginPath();
        ctx.arc(guard.x, guard.y - 20, 8, Math.PI, Math.PI + Math.PI * guard.meter);
        ctx.stroke();
      }
      ctx.textBaseline = 'bottom';
      if (guard.mode === 'chase') text('!', guard.x, guard.y - 28, 18, '#ff4d5e', 'center', true);
      else if (guard.mode === 'investigate') text('?', guard.x, guard.y - 28, 16, '#f2c94c', 'center', true);
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      drawCone(state, camera.x, camera.y, camera.angle, CAMERA.viewRange, CAMERA.viewHalfAngle,
        camera.seeing ? PALETTE.cameraConeHot : PALETTE.cameraCone);
    }
    for (const camera of state.cameras) {
      ctx.fillStyle = '#39424f';
      ctx.fillRect(camera.x - 8, camera.y - 8, 16, 16);
      ctx.fillStyle = PALETTE.camera;
      ctx.beginPath();
      ctx.arc(camera.x + Math.cos(camera.angle) * 5, camera.y + Math.sin(camera.angle) * 5, 5, 0, Math.PI * 2);
      ctx.fill();
      // Recording LED: blinks, solid red while the thief is in frame.
      const on = camera.seeing || Math.floor(state.elapsed * 2) % 2 === 0;
      ctx.fillStyle = on ? '#ff4d5e' : '#5a2b30';
      ctx.beginPath();
      ctx.arc(camera.x, camera.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.textBaseline = 'top';
      text('CAM', camera.x, camera.y + 10, 9, PALETTE.muted, 'center', true);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    const radius = p.crouch ? PLAYER.radius - 3 : PLAYER.radius;
    // A soft pulsing ring under the thief so the eye finds them instantly in any frame.
    ctx.strokeStyle = `rgba(232,178,58,${(0.35 + 0.2 * Math.sin(state.elapsed * 4)).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 5, radius, radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Loot bag behind the thief, growing with carried weight.
    if (p.weight > 0) {
      const bagR = 6 + p.weight * 0.9;
      ctx.fillStyle = PALETTE.playerBag;
      ctx.beginPath();
      ctx.arc(p.x - Math.cos(p.angle) * 10, p.y - Math.sin(p.angle) * 10, bagR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0a0d13';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Gold mask stripe toward facing + hood point.
    ctx.strokeStyle = PALETTE.playerTrim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius - 3, p.angle - 0.55, p.angle + 0.55);
    ctx.stroke();
    ctx.fillStyle = PALETTE.playerTrim;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 6, p.y + Math.sin(p.angle) * 6, 3, 0, Math.PI * 2);
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
      ctx.fillStyle = worst > 0.65 ? '#ff4d5e' : '#f2c94c';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - radius - 16, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#10141c';
      ctx.beginPath();
      ctx.arc(p.x, p.y - radius - 16, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y - radius - 16, 13, Math.PI, Math.PI + Math.PI * worst);
      ctx.stroke();
    }
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
