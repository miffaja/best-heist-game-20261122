// The heads-up display: haul and gadget chips, the alarm meter, the minimap, the
// vault-cracking dial overlay, and the title / pause / caught / getaway panels.
// SCREEN_* names the five screens the loop can be on.
import { ALARM, FIELD, PALETTE, PLAYER, VAULT } from './config.js';
import { formatTime, text } from './draw-helpers.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';   // caught
export const SCREEN_WIN = 'win';     // extracted

const ALARM_COLORS = [PALETTE.alarmCalm, PALETTE.alarmWarn, PALETTE.alarmHot, PALETTE.alarmLock];

export function drawCrackOverlay(ctx, state) {
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
  text(ctx, `CRACKING VAULT… ${door.tumblers}/${VAULT.tumblers}`, px + 196, py + 18, 31, '#f2c94c', 'left', true);
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
    if (i < door.tumblers) text(ctx, '✓', pipX, pipY - 10, 19, '#0b2e1f', 'center', true);
  }
  text(ctx, 'TUMBLERS', px + 214 + VAULT.tumblers * 44 + 6, py + 70, 14, PALETTE.muted, 'left', true);
  text(ctx, 'HOLD E TO SPIN — RELEASE IN THE GREEN!', px + 196, py + 112, 18, PALETTE.text, 'left', true);
  text(ctx, `A wrong release jams the lock: +${VAULT.wrongAlarm} ALARM. You cannot move while cracking.`,
    px + 196, py + 138, 14, '#ff9aa5', 'left');
}

export function drawHud(ctx, state, best) {
  const p = state.player;
  ctx.textBaseline = 'top';
  // Top-left: haul, bag, coins. Kept compact so it never swallows a CAMERA label.
  ctx.fillStyle = 'rgba(11,14,20,0.72)';
  ctx.fillRect(14, 12, 318, 78);
  ctx.strokeStyle = 'rgba(232,178,58,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(14.5, 12.5, 317, 77);
  text(ctx, `HAUL  $${p.haul.toLocaleString('en-US')}`, 26, 19, 23, '#7de8a0', 'left', true);
  text(ctx, `BAG ${p.weight}/${PLAYER.bagCapacity}   COINS ${p.coins}   BEST $${best.toLocaleString('en-US')}`, 26, 48, 14, PALETTE.text, 'left');
  text(ctx, state.level.name, 26, 67, 13, PALETTE.muted, 'left', true);
  // Gadget belt: the two limited tools, with their keys, under the haul box. A spent
  // gadget greys out; a live EMP window counts down in violet. Chips are tall and
  // the type is big — the EMP LIVE countdown is proof the tool works, so it must
  // stay readable when the frame shrinks to a thumbnail.
  const chipY = 96;
  const chipH = 30;
  const empLive = state.empTimer > 0;
  ctx.fillStyle = empLive ? 'rgba(58,38,84,0.95)' : 'rgba(11,14,20,0.72)';
  ctx.fillRect(14, chipY, 176, chipH);
  ctx.strokeStyle = p.emp > 0 || empLive ? PALETTE.emp : 'rgba(147,160,180,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(14.5, chipY + 0.5, 175, chipH - 1);
  text(ctx, empLive ? `EMP LIVE ${state.empTimer.toFixed(1)}s` : `EMP ×${p.emp}  [Q]`, 24, chipY + 7, 15,
    p.emp > 0 || empLive ? '#e2ccff' : PALETTE.muted, 'left', true);
  ctx.fillStyle = 'rgba(11,14,20,0.72)';
  ctx.fillRect(198, chipY, 160, chipH);
  ctx.strokeStyle = p.smoke > 0 ? '#9fb4c8' : 'rgba(147,160,180,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(198.5, chipY + 0.5, 159, chipH - 1);
  text(ctx, `SMOKE ×${p.smoke}  [R]`, 208, chipY + 7, 15, p.smoke > 0 ? '#cfe4f7' : PALETTE.muted, 'left', true);

  // Centre-top: the alarm meter — the brief's required element, big and readable.
  const meterW = 380;
  const meterX = (FIELD.width - meterW) / 2;
  const levelName = ALARM.levels[state.alarmLevel].name;
  ctx.fillStyle = 'rgba(11,14,20,0.72)';
  ctx.fillRect(meterX - 12, 12, meterW + 24, 64);
  ctx.strokeStyle = ALARM_COLORS[state.alarmLevel];
  ctx.strokeRect(meterX - 11.5, 12.5, meterW + 23, 63);
  text(ctx, `ALARM — ${levelName}`, FIELD.width / 2, 18, 18, ALARM_COLORS[state.alarmLevel], 'center', true);
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
  text(ctx, formatTime(state.elapsed), FIELD.width - 26, 16, 24, PALETTE.text, 'right', true);
  drawMinimap(ctx, state);

  // Bottom objective line.
  ctx.fillStyle = 'rgba(11,14,20,0.72)';
  ctx.fillRect(14, FIELD.height - 44, 560, 32);
  const crackDoor = state.crackDoor >= 0 ? state.vaultDoors[state.crackDoor] : null;
  const objective = crackDoor && !crackDoor.open
    ? `Objective: CRACK THE VAULT — hold E, release in the green (${crackDoor.tumblers}/${VAULT.tumblers})`
    : p.haul > 0
      ? 'Objective: reach the GETAWAY VAN and hold E to escape — or grab more loot'
      : 'Objective: grab loot with E · crack VAULT doors · escape at the van';
  text(ctx, objective, 26, FIELD.height - 36, 15, PALETTE.text, 'left');
  text(ctx, 'WASD move · Shift sprint · C crouch · E grab/crack/vent · Click coin · Q EMP · R smoke · P pause',
    FIELD.width - 26, FIELD.height - 36, 13, PALETTE.muted, 'right');

  // Alarm vignette pulse at HUNTED and above.
  if (state.alarmLevel >= 2) {
    const a = 0.10 + 0.08 * Math.sin(state.elapsed * 5);
    ctx.strokeStyle = `rgba(255,60,70,${a.toFixed(3)})`;
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, FIELD.width - 18, FIELD.height - 18);
  }

  // The vault-cracking dial overlay sits on top of the HUD while a lock is worked.
  drawCrackOverlay(ctx, state);
}

export function drawMinimap(ctx, state) {
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
  text(ctx, 'MAP', mx + 6, my + 4, 10, PALETTE.muted, 'left', true);
}

/**
 * The getaway payoff, as a compact banner over live gameplay (not a full panel):
 * the moment the extraction channel completes, the haul is secured and the ghost
 * rating is called — big enough to read at thumbnail size, small enough that the
 * room, the van and the thief still own the frame.
 */
export function drawGetawayBanner(ctx, state, rating) {
  // Anchored right of the gadget chips so the EMP LIVE countdown stays readable.
  const x = 366;
  const width = FIELD.width - x - 26;
  const height = 84;
  const y = 88;
  ctx.fillStyle = 'rgba(11,20,16,0.92)';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = '#58dc9c';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  ctx.textBaseline = 'top';
  text(ctx, `✓ CLEAN GETAWAY — HAUL SECURED $${state.player.haul.toLocaleString('en-US')}`,
    x + width / 2, y + 10, 30, '#7de8a0', 'center', true);
  text(ctx, `GHOST RATING: ${rating || '—'}  ·  TIME ${formatTime(state.elapsed)}  ·  DETECTIONS ${state.detections}  ·  PEAK ALARM ${Math.round(state.alarmPeak)}%`,
    x + width / 2, y + 50, 16, PALETTE.text, 'center', true);
}

export function drawPanel(ctx, title, titleColor, lines, prompt) {
  const width = 560;
  const height = 104 + lines.length * 27 + 48;
  const x = (FIELD.width - width) / 2;
  const y = (FIELD.height - height) / 2;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  ctx.textBaseline = 'top';
  text(ctx, title, FIELD.width / 2, y + 20, 34, titleColor, 'center', true);
  lines.forEach((line, i) => {
    text(ctx, line, FIELD.width / 2, y + 78 + i * 27, 16, PALETTE.text, 'center');
  });
  text(ctx, prompt, FIELD.width / 2, y + height - 38, 15, PALETTE.playerTrim, 'center', true);
}
