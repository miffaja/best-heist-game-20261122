// The screenshot scenes behind ?shot=cover|caught|crack|extract. Each scene places real
// entities with the world's staging helpers and then runs the ordinary simulation forward
// for a fixed number of steps, so every frame is what the game itself renders — guards
// patrol, cones sweep, meters fill — and the same seed always gives the same frame.
//
// Staging rule for every scene: the thief stands in open floor with at most one cone
// touching him, cones point in different directions so they never stack into mud, and
// each frame shows one mechanic legibly — coin toss, the fair caught moment,
// VAULT-CRACKING (hold E to spin the dial, release in the green, three tumblers),
// extraction — instead of all of them at once. The four frames span all three floors.
import { CAMERA, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY } from './render.js';

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
  world.placePlayer(680, 235, 0); // east of the smoke, mid-crossing toward the vault door
  world.setGuard(1, 480, 385, Math.PI, 0.0, 'patrol'); // gallery guard, cone pointing left
  world.state.guards[1].wpIndex = 3; // waypoint at his feet: he scans in place, never walks at the thief
  world.setGuard(0, 210, 300, Math.PI / 2, 0.0, 'patrol'); // lobby guard mid-patrol
  world.setGuard(2, 1060, 150, -Math.PI / 2, 0.0, 'patrol'); // vault guard facing the top wall
  world.setGuard(3, 1050, 640, Math.PI, 0.0, 'patrol'); // service sweep, cone along the bottom
  aimCamera(world, 0, 0.85); // lobby camera sweeping down-left, away from its guard's cone
  aimCamera(world, 1, -0.9); // gallery camera sweeping down-right, off the thief
  aimCamera(world, 2, -0.85); // vault camera sweeping down-left
  aimCamera(world, 3, 0.85); // office camera sweeping down-left
  run(world, 2); // the gallery guard settles at his waypoint and starts scanning
  // He scans toward the crossing — where the thief's smoke bomb is about to hang.
  world.state.guards[1].scanBase = -0.76;
  world.state.guards[1].lookTimer = 99;
  run(world, 12, MOVE_EAST); // mid-stride crossing, boots swinging
  tossCoin(world, 465, 365); // first coin: lands at the gallery guard's feet, far from the thief
  run(world, 30); // coin lands, guard turns to investigate ("?" up)
  // A smoke bomb spent covering the crossing: the cloud hangs between the guard and
  // the thief, his cone stops dead at its edge, and the thief — already clear of it —
  // keeps crossing (SMOKE ×1 in the HUD, SMOKE! over the cloud).
  world.setTools(2, 1);
  world.dropSmoke(575, 295, 5);
  world.state.floaters.push({ x: 575, y: 248, text: 'SMOKE!', color: '#cfe4f7', life: 1.4 });
  tossCoin(world, 770, 175); // second coin: caught mid-arc in the frame
  run(world, 11);
  // Re-aim the gallery camera off the thief and settle the alarm back to the staged
  // SUSPICIOUS band (the sweep may have brushed him mid-staging): the cover thief
  // reads as crossing, not caught.
  aimCamera(world, 1, -0.9);
  world.setAlarm(45);
  world.state.floaters = world.state.floaters.filter((f) => f.text === 'SMOKE!');
  run(world, 1);
  return { screen: SCREEN_PLAY, best: 6500, rating: null };
}

/**
 * CAUGHT — the fair bust: LOCKDOWN, the vault guard's cone full red on the thief at
 * arm's length, a second guard converging, the armed doorway laser behind him, and
 * the CAUGHT report over it all. The moment is fair because the cone that made him
 * is right there in the frame.
 */
function stageCaught(world) {
  world.loadLevel(0);
  world.setElapsed(96);
  world.setAlarm(92); // LOCKDOWN band: lasers armed, extra guard deployed
  world.openVault(0); // he cracked in — and the vault camera had him the whole time
  world.giveLoot('gold');
  world.giveLoot('gems'); // $5,500 in the bag, about to be lost
  world.setTools(0, 1); // the EMP is spent: it bought the vault, not the exit
  world.state.detections = 2; // made twice on the way in — the report should say so
  world.placePlayer(1000, 150, Math.PI); // cornered in the vault's open north lane
  world.setGuard(2, 1062, 150, Math.PI, 1.0, 'chase'); // on him: cone red, "!" up
  world.setGuard(1, 700, 150, 0.4, 0.4, 'investigate'); // gallery guard converging
  world.state.guards[1].investigatePoint = { x: 1000, y: 150 };
  aimCamera(world, 2, 0.62); // vault camera still on the thief
  aimCamera(world, 1, -0.85);
  run(world, 90); // the guard closes the last steps and lays a hand on him
  return { screen: world.state.caught ? SCREEN_OVER : SCREEN_PLAY, best: 6500, rating: null };
}

/**
 * CRACK — floor 3, the penthouse SKY VAULT: VAULT-CRACKING at the data core's north
 * door, server racks humming in their lanes around him. The thief stands at the steel
 * door with E held and the combination dial spinning, needle inside the green zone,
 * two of three tumblers already set — CRACKING VAULT… 2/3 on the big overlay. The
 * core's gold bars and second star artifact wait behind the door; the core guard's
 * cone points at the far wall. One more clean release and the vault swings open; a
 * jammed one raises the alarm.
 */
function stageCrack(world) {
  world.loadLevel(2);
  world.setElapsed(130);
  world.setAlarm(60); // HUNTED band: lasers armed, cameras sweeping fast
  world.giveLoot('gems'); // a lane gem case already in the bag
  world.placePlayer(828, 300, 0); // at the core's north vault door, facing into the core
  world.setGuard(4, 1140, 300, Math.PI, 0.0, 'patrol'); // core guard, cone along the racks
  world.setGuard(3, 800, 560, -Math.PI / 2, 0.0, 'patrol'); // approach sweep, still short of him
  world.setGuard(0, 180, 200, Math.PI / 2, 0.0, 'patrol'); // west lane, far away
  aimCamera(world, 2, -0.85); // core camera sweeping away from the door
  aimCamera(world, 0, 0.85);
  aimCamera(world, 1, -0.85);
  aimCamera(world, 3, 0.85);
  run(world, 2, HOLD); // E held: the dial starts spinning for real
  world.setVaultCrack(0, 2, 0.12); // two tumblers set, needle inside the green zone
  return { screen: SCREEN_PLAY, best: 14000, rating: null };
}

/**
 * EXTRACT — the getaway in motion, on floor 2: the annex core cracked and emptied
 * ($14,000 in the bag), the EMP jammer LIVE — every camera JAMMED with violet pulse
 * rings, the doorway lasers dead grey — and the thief mid-vent-slip, emerging from
 * the west corridor grate (duct trail still drawn to the east grate he came from)
 * on his way to the van. Pure gameplay: tools proven in effect, no report panel.
 */
function stageExtract(world) {
  world.loadLevel(1);
  world.setElapsed(184);
  world.setAlarm(60); // HUNTED band: lasers would be armed — the EMP is what holds them dead
  world.openVault(0); // the core was cracked on the way through — the gold is his
  world.giveLoot('gold');
  world.giveLoot('gold');
  world.giveLoot('artifact');
  world.giveLoot('gems'); // $14,000 in the bag, weight 9 of 10
  // Guards held far off the west corridor, cones pointed away from the getaway line.
  world.setGuard(0, 640, 120, 0, 0.0, 'patrol'); // top corridor, cone east
  world.setGuard(1, 1130, 620, Math.PI, 0.0, 'patrol'); // bottom corridor, cone west (far east)
  world.setGuard(2, 150, 120, 0, 0.0, 'patrol'); // west guard pulled north, cone east
  world.state.guards[2].wpIndex = 0; // waypoint at his feet: scans in place, never walks at the thief
  world.state.guards[2].scanBase = 0;
  world.state.guards[2].lookTimer = 99;
  world.setGuard(3, 1130, 120, Math.PI / 2, 0.0, 'patrol'); // east corridor, cone south
  world.state.guards[3].wpIndex = 1; // waypoint at his feet: scans in place
  world.state.guards[3].scanBase = Math.PI / 2;
  world.state.guards[3].lookTimer = 99;
  world.setGuard(4, 640, 300, -Math.PI / 2, 0.0, 'patrol'); // inside the core, cone north
  // The EMP jammer fired for the getaway: cameras JAMMED, lasers dead, chip counting down.
  world.setTools(1, 2);
  world.fireEmp(6);
  world.state.floaters.push({ x: 150, y: 300, text: 'EMP — CAMERAS JAMMED!', color: '#b48ae8', life: 1.4 });
  // Vent transit for real: tap E at the east corridor grate, slip to the west one.
  world.placePlayer(1228, 360, Math.PI);
  run(world, 1, HOLD); // the slip: duct trail + THROUGH THE VENT floater at the west grate
  run(world, 8, MOVE_EAST); // step clear of the west wall first (the grate hugs it)
  run(world, 42, { mx: 0.5, my: 1, interact: false, crouch: false, sprint: false }); // mid-stride to the van
  return { screen: SCREEN_PLAY, best: 14000, rating: null };
}

export function stageShot(name, world) {
  if (name === 'caught' || name === 'camera') return stageCaught(world);
  if (name === 'crack' || name === 'loot') return stageCrack(world); // 'loot' kept as an alias
  if (name === 'extract') return stageExtract(world);
  return stageCover(world);
}
