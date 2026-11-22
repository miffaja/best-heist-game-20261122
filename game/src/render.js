// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// field is scaled to fit the window and centred. Vision cones are drawn as raycast fans
// that stop at walls, so what the player sees is exactly what the simulation checks.
// Rooms have real materials (marble, carpet, riveted steel, wood, concrete), warm light
// pools with darkened corners, and set dressing (statues, gem cases, security desks,
// potted trees). Locked VAULT DOORS show their combination dial and tumbler pips, and
// while the thief cracks one, a big dial overlay reads CRACKING VAULT… n/3.
// Everything is canvas shapes and text — no image files, no network.
// The renderer is now a thin shell: it owns the canvas, the scaling view and the
// draw order, and delegates every actual shape to the draw-* modules (rooms,
// actors, hud) built on draw-helpers. Re-exports the SCREEN_* names for main.js.
import { FIELD, PALETTE } from './config.js';
import { formatTime } from './draw-helpers.js';
import {
  drawExtractZone, drawFloors, drawLaserLabels, drawLasers, drawLoot, drawPatrolRoutes,
  drawProps, drawVaultDoors, drawVents, drawWalls,
} from './draw-rooms.js';
import {
  drawCameraLabels, drawCameras, drawEffects, drawGuards, drawPlayer, drawSmoke,
} from './draw-actors.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_TITLE, SCREEN_WIN, drawGetawayBanner, drawHud, drawPanel,
} from './draw-hud.js';

export { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './draw-hud.js';

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

  function draw(state, screen, best, rating) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    drawFloors(ctx, state);
    drawExtractZone(ctx, state);
    drawPatrolRoutes(ctx, state); // dotted guard loops: read the patrol before you move
    drawVents(ctx, state);     // vent grates: the second route into watched rooms
    drawProps(ctx, state);     // statues, cases, desks, trees dress the rooms
    drawLasers(ctx, state);
    drawLoot(ctx, state);
    drawCameras(ctx, state);   // cones under the actors
    drawGuards(ctx, state);
    drawWalls(ctx, state);     // walls over cone edges so rooms read cleanly
    drawVaultDoors(ctx, state); // steel slabs + dials over the walls they seal
    drawLaserLabels(ctx, state); // LASER / LASER DEAD pills over the doorway walls
    drawCameraLabels(ctx, state); // pills over the walls, under the thief
    drawPlayer(ctx, state);
    drawSmoke(ctx, state);     // smoke clouds swallow whoever stands in them
    drawEffects(ctx, state);

    // Soft vignette for depth.
    const grad = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    if (screen === SCREEN_TITLE) {
      drawHud(ctx, state, best);
      drawPanel(ctx, 'VAULT ZERO', PALETTE.playerTrim, [
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
      drawHud(ctx, state, best);
      drawPanel(ctx, 'PAUSED', PALETTE.text, ['The bank holds its breath.'], 'Press P or SPACE to resume');
    } else if (screen === SCREEN_OVER) {
      drawHud(ctx, state, best);
      // Compact bottom-left report: the bust itself (guard, red cone, thief) is
      // the evidence the moment was fair — it stays on screen around the panel.
      drawPanel(ctx, 'CAUGHT!', '#ff4d5e', [
        'A guard got a hand on you — the vault keeps its secrets.',
        `Haul lost: $${state.player.haul.toLocaleString('en-US')} · Time: ${formatTime(state.elapsed)}`,
        `Detections: ${state.detections} · Peak alarm: ${Math.round(state.alarmPeak)}%`,
      ], 'Press SPACE or click to try the heist again', { compact: true });
    } else if (screen === SCREEN_WIN) {
      drawHud(ctx, state, best);
      const next = state.levelIndex + 1 < 3
        ? `SPACE: rob ${state.levelIndex === 0 ? 'the VAULT ANNEX' : 'the SKY VAULT'} next`
        : 'SPACE: back to the title — all three floors robbed';
      drawPanel(ctx, 'CLEAN GETAWAY!', '#7de8a0', [
        `Haul secured: $${state.player.haul.toLocaleString('en-US')}`,
        `Time: ${formatTime(state.elapsed)} · Detections: ${state.detections} · Peak alarm: ${Math.round(state.alarmPeak)}%`,
        `GHOST RATING: ${rating || '—'}`,
        `Best haul: $${best.toLocaleString('en-US')}`,
      ], next);
    } else {
      drawHud(ctx, state, best);
      // The extraction just completed: the payoff banner rides over the live
      // frame (the full report panel follows on the win screen).
      if (state.extracted) drawGetawayBanner(ctx, state, rating);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, toField };
}
