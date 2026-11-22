// The screenshot scenes behind ?shot=cover|camera|loot|extract. Each scene places real
// entities with the world's staging helpers and then runs the ordinary simulation forward
// for a fixed number of steps, so every frame is what the game itself renders — guards
// patrol, cones sweep, meters fill — and the same seed always gives the same frame.
import { CAMERA, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_WIN } from './render.js';

const NEUTRAL = { mx: 0, my: 0, interact: false, crouch: false, sprint: false };
const HOLD = { mx: 0, my: 0, interact: true, crouch: false, sprint: false };

function run(world, steps, input) {
  for (let i = 0; i < steps; i += 1) world.step(STEP, input || NEUTRAL);
}

/** Aim a camera's sweep so that, at the world's current elapsed time, it points `offset` rad off its mount direction. */
function aimCamera(world, index, offset) {
  const camera = world.state.cameras[index];
  const sweepMul = [1.0, 1.35, 1.8, 2.4][world.state.alarmLevel];
  const ratio = Math.max(-1, Math.min(1, offset / CAMERA.sweepHalfAngle));
  camera.phase = Math.asin(ratio) - world.state.elapsed * CAMERA.sweepSpeed * sweepMul;
}

/**
 * COVER — the brief's one-frame summary: the thief crossing the gallery mid-heist, two
 * guards with vision cones closing in, cameras sweeping overhead, a gem case in the bag,
 * gold still on the vault racks, and the alarm meter up at SUSPICIOUS.
 */
function stageCover(world) {
  world.loadLevel(0);
  world.setElapsed(42);
  world.setAlarm(45); // SUSPICIOUS band
  world.giveLoot('gems'); // one case already in the bag
  world.placePlayer(650, 275, 0.15); // crossing the gallery rug, heading right toward the gem case
  world.setGuard(1, 495, 395, -0.85, 0.5, 'investigate'); // gallery guard turning toward the thief, "?" up
  world.state.guards[1].investigatePoint = { x: 650, y: 275 };
  world.setGuard(0, 210, 300, Math.PI / 2, 0.1, 'patrol'); // lobby guard mid-patrol
  world.setGuard(2, 1060, 150, 2.6, 0.0, 'patrol'); // vault guard
  aimCamera(world, 0, 0.25); // lobby camera sweeping the teller line
  aimCamera(world, 1, 0.3); // gallery camera sweeping toward the thief
  aimCamera(world, 2, -0.5); // vault camera
  aimCamera(world, 3, 0.3); // office camera (fully visible mid-frame)
  run(world, 14);
  return { screen: SCREEN_PLAY, best: 6500, rating: null };
}

/**
 * CAMERA — the thief caught in a surveillance cone: red camera cone, alarm at HUNTED,
 * laser tripwires armed across the doorways, a guard radioed to investigate.
 */
function stageCamera(world) {
  world.loadLevel(0);
  world.setElapsed(96);
  world.setAlarm(68); // HUNTED band: lasers armed
  world.giveLoot('cash');
  // In the VAULT, dead centre under the vault camera: CCTV cone ON the thief,
  // alarm climbing, the armed laser across the vault doorway at frame left.
  // (1010,205) keeps the thief + YOU tag clear of the minimap in the corner.
  world.placePlayer(1010, 205, -Math.PI / 2);
  world.setGuard(2, 950, 330, -1.1, 0.55, 'investigate'); // vault guard radioed in
  world.state.guards[2].investigatePoint = { x: 1010, y: 205 };
  world.setGuard(1, 700, 150, 0.4, 0.0, 'patrol'); // gallery guard, cone sweeping away
  aimCamera(world, 2, 0.31); // vault camera aimed at the thief's bearing
  aimCamera(world, 1, -0.4); // gallery camera sweeping the cases
  run(world, 10); // short run: the sweep has not yet carried the cone off the thief
  return { screen: SCREEN_PLAY, best: 6500, rating: null };
}

/**
 * LOOT — floor 2, the vault annex: the thief mid-grab on gold bars inside the vault core,
 * progress ring turning, the core guard's cone sweeping past, armed lasers on both doors.
 */
function stageLoot(world) {
  world.loadLevel(1);
  world.setElapsed(130);
  world.setAlarm(60); // HUNTED band
  world.giveLoot('gems');
  world.placePlayer(555, 372, -Math.PI / 2); // beside the gold bars, facing them
  world.setGuard(4, 700, 450, -2.6, 0.2, 'patrol'); // core guard, cone sweeping away
  world.setGuard(0, 500, 120, 0, 0.0, 'patrol'); // top corridor guard
  aimCamera(world, 0, -0.4);
  run(world, 66, HOLD); // hold E: the grab ring fills to about half
  return { screen: SCREEN_PLAY, best: 6500, rating: null };
}

/**
 * EXTRACT — the payoff: a real extraction channel completed at the van, ending on the
 * CLEAN GETAWAY report with haul, time and ghost rating.
 */
function stageExtract(world) {
  world.loadLevel(0);
  world.setElapsed(184);
  world.setAlarm(12);
  world.giveLoot('gems');
  world.giveLoot('gold');
  world.giveLoot('cash'); // $6,000 in the bag
  world.placePlayer(110, 640, Math.PI); // at the van
  world.setGuard(0, 210, 180, -Math.PI / 2, 0.0, 'patrol'); // lobby guard far north
  run(world, 210, HOLD); // hold E through the 3s channel -> extracted
  const over = world.state.caught;
  return {
    screen: over ? SCREEN_OVER : SCREEN_WIN,
    best: Math.max(6500, world.state.player.haul),
    rating: world.ghostRating(),
  };
}

export function stageShot(name, world) {
  if (name === 'camera') return stageCamera(world);
  if (name === 'loot') return stageLoot(world);
  if (name === 'extract') return stageExtract(world);
  return stageCover(world);
}
