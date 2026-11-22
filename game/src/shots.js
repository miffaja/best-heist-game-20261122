// The screenshot scenes behind ?shot=cover|camera|crack|extract. Each scene places real
// entities with the world's staging helpers and then runs the ordinary simulation forward
// for a fixed number of steps, so every frame is what the game itself renders — guards
// patrol, cones sweep, meters fill — and the same seed always gives the same frame.
//
// Staging rule for every scene: the thief stands in open floor with at most one cone
// touching him, cones point in different directions so they never stack into mud, and
// each frame shows one mechanic legibly — coin toss, camera + lasers, VAULT-CRACKING
// (hold E to spin the dial, release in the green, three tumblers), extraction —
// instead of all of them at once.
import { CAMERA, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_WIN } from './render.js';

const NEUTRAL = { mx: 0, my: 0, interact: false, crouch: false, sprint: false };
const HOLD = { mx: 0, my: 0, interact: true, crouch: false, sprint: false };
const MOVE_EAST = { mx: 1, my: 0, interact: false, crouch: false, sprint: false };

function run(world, steps, input) {
  for (let i = 0; i < steps; i += 1) world.step(STEP, input || NEUTRAL);
}

/** Toss one coin toward (x, y) — a single step, so exactly one coin leaves the hand. */
function tossCoin(world, x, y) {
  world.step(STEP, { ...NEUTRAL, toss: { x, y } });
}

/** Aim a camera's sweep so that, at the world's current elapsed time, it points `offset` rad off its mount direction. */
function aimCamera(world, index, offset) {
  const camera = world.state.cameras[index];
  const sweepMul = [1.0, 1.35, 1.8, 2.4][world.state.alarmLevel];
  const ratio = Math.max(-1, Math.min(1, offset / CAMERA.sweepHalfAngle));
  camera.phase = Math.asin(ratio) - world.state.elapsed * CAMERA.sweepSpeed * sweepMul;
}

/**
 * COVER — the brief's one-frame summary: the thief mid-stride crossing the gallery rug
 * toward a gem case, heavy bag on his back, a coin arcing toward the gallery guard who
 * is already investigating the first coin ("?" up), cameras sweeping overhead with their
 * cones pointed away, loot on the vault racks, and the alarm meter at SUSPICIOUS.
 * The thief is in NO cone: he reads as crossing, not caught.
 */
function stageCover(world) {
  world.loadLevel(0);
  world.setElapsed(42);
  world.setAlarm(45); // SUSPICIOUS band
  world.openVault(0); // the vault door was cracked earlier: the gold below is already his
  world.giveLoot('cash'); // teller register already in the bag
  world.giveLoot('gold'); // vault bars too: weight 4, the HEAVY tag shows
  world.placePlayer(610, 245, 0); // on the gallery rug, heading right toward the gem case
  world.setGuard(1, 480, 385, Math.PI, 0.0, 'patrol'); // gallery guard, cone pointing left
  world.state.guards[1].wpIndex = 3; // waypoint at his feet: he scans in place, never walks at the thief
  world.setGuard(0, 210, 300, Math.PI / 2, 0.0, 'patrol'); // lobby guard mid-patrol
  world.setGuard(2, 1060, 150, -Math.PI / 2, 0.0, 'patrol'); // vault guard facing the top wall
  world.setGuard(3, 1050, 640, Math.PI, 0.0, 'patrol'); // service sweep, cone along the bottom
  aimCamera(world, 0, 0.85); // lobby camera sweeping down-left, away from its guard's cone
  aimCamera(world, 1, -0.9); // gallery camera sweeping down-right, off the thief
  aimCamera(world, 2, -0.85); // vault camera sweeping down-left
  aimCamera(world, 3, 0.85); // office camera sweeping down-left
  run(world, 12, MOVE_EAST); // mid-stride crossing, boots swinging
  tossCoin(world, 465, 365); // first coin: lands at the gallery guard's feet, far from the thief
  run(world, 30); // coin lands, guard turns to investigate ("?" up)
  tossCoin(world, 770, 175); // second coin: caught mid-arc in the frame
  run(world, 12);
  return { screen: SCREEN_PLAY, best: 6500, rating: null };
}

/**
 * CAMERA — the thief caught in a surveillance cone inside the vault: red camera cone ON
 * the thief, alarm at HUNTED, the armed laser tripwire glowing across the vault doorway
 * beside him, and the vault guard radioed in to investigate.
 */
function stageCamera(world) {
  world.loadLevel(0);
  world.setElapsed(96);
  world.setAlarm(68); // HUNTED band: lasers armed
  world.openVault(0); // cracked his way into the vault — now the camera has him
  world.giveLoot('cash');
  // In the VAULT beside the doorway laser (x=868), under the vault camera: the CCTV
  // cone is on the thief and the LASER beam is in frame at his left.
  world.placePlayer(955, 208, -Math.PI / 2);
  world.setGuard(2, 1030, 330, -1.9, 0.55, 'investigate'); // vault guard radioed in
  world.state.guards[2].investigatePoint = { x: 955, y: 208 };
  world.setGuard(1, 700, 150, 0.4, 0.0, 'patrol'); // gallery guard, cone sweeping away
  aimCamera(world, 2, 0.62); // vault camera aimed at the thief's bearing
  aimCamera(world, 1, -0.85); // gallery camera sweeping away from the cases
  run(world, 10); // short run: the sweep has not yet carried the cone off the thief
  return { screen: SCREEN_PLAY, best: 6500, rating: null };
}

/**
 * CRACK — floor 2, the vault annex: VAULT-CRACKING at the sealed core's north door.
 * The thief stands at the steel vault door with E held and the combination dial
 * spinning, needle inside the green zone, two of three tumblers already set —
 * CRACKING VAULT… 2/3 on the big overlay, VAULT ●●○ on the door itself. The core's
 * gold bars and star artifact wait behind the door; the core guard's cone points at
 * the far wall and the corridor guard has not reached him yet. One more clean
 * release and the vault swings open; a jammed one raises the alarm.
 */
function stageCrack(world) {
  world.loadLevel(1);
  world.setElapsed(130);
  world.setAlarm(60); // HUNTED band: lasers armed, cameras sweeping fast
  world.giveLoot('gems'); // corridor gem case already in the bag
  world.placePlayer(640, 196, Math.PI / 2); // at the north vault door, facing into the core
  world.setGuard(4, 740, 440, 0.8, 0.0, 'patrol'); // core guard, cone at the far wall
  world.setGuard(0, 300, 120, 0, 0.0, 'patrol'); // top corridor guard, still short of him
  aimCamera(world, 0, -0.85); // top camera sweeping away from the core door
  aimCamera(world, 1, 0.85); // bottom camera sweeping away from the core
  aimCamera(world, 2, 0.85); // west camera sweeping south, off the thief
  aimCamera(world, 3, -0.85); // east camera sweeping south, off the thief
  run(world, 2, HOLD); // E held: the dial starts spinning for real
  world.setVaultCrack(0, 2, 0.12); // two tumblers set, needle inside the green zone
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
  world.openVault(0); // the vault was cracked on the way through — the gold is his
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
  if (name === 'crack' || name === 'loot') return stageCrack(world); // 'loot' kept as an alias
  if (name === 'extract') return stageExtract(world);
  return stageCover(world);
}
