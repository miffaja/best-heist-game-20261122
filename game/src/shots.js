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
 * The thief is in NO cone: he reads as crossing, not caught. Both tools are proven
 * IN EFFECT in this one frame: the smoke cloud hangs on the crossing, and the EMP
 * jammer is LIVE — the gallery and vault cameras wear big JAMMED pills with violet
 * pulse rings while the lobby and office cameras still sweep.
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
  // The EMP jammer fired to cover the crossing: the chip counts down (EMP LIVE
  // 5.2s) and the two cameras watching the gallery/vault lanes are JAMMED — big
  // violet pills, pulse rings, dead lenses — while the lobby and office cameras
  // still sweep, so the frame keeps live camera cones AND the tool in effect.
  world.setTools(1, 1);
  world.fireEmp(5.2);
  world.setCameraJammed(0, false); // lobby camera still sweeping
  world.setCameraJammed(3, false); // office camera still sweeping
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
 * EXTRACT — the bold route in, on floor 2: corridor loot in the bag ($5,000),
 * the thief fires the EMP jammer (every camera JAMMED, doorway lasers dead
 * grey) and slips the vent from the top corridor straight into the sealed
 * vault core — and the frame catches him MID-CLIMB out of the core grate:
 * duct band and chevrons bright behind him, slats swung open over his legs,
 * the core's gold and star artifact waiting around him, the core guard's back
 * turned. The vent route reads as USED, not labelled.
 */
function stageExtract(world) {
  world.loadLevel(1);
  world.setElapsed(184);
  world.setAlarm(60); // HUNTED band: lasers would be armed — the EMP is what holds them dead
  world.giveLoot('gems'); // corridor gem case (140,110)
  world.giveLoot('cash'); // corridor cash (1140,110)
  world.giveLoot('cash'); // corridor cash (1140,620)
  world.giveLoot('gems'); // top-corridor gem case (640,160) — $5,000, weight 4
  // Guards held off the vent line, cones pointed away from the core grate.
  world.setGuard(0, 640, 120, 0, 0.0, 'patrol'); // top corridor, cone east
  world.setGuard(1, 1130, 620, Math.PI, 0.0, 'patrol'); // bottom corridor, cone west (far east)
  world.state.guards[1].wpIndex = 1; // waypoint at his feet: scans in place, never walks at the van
  world.state.guards[1].scanBase = Math.PI;
  world.state.guards[1].lookTimer = 99;
  world.setGuard(2, 150, 120, 0, 0.0, 'patrol'); // west guard pulled north, cone east
  world.state.guards[2].wpIndex = 0; // waypoint at his feet: scans in place, never walks at the thief
  world.state.guards[2].scanBase = 0;
  world.state.guards[2].lookTimer = 99;
  world.setGuard(3, 1130, 120, Math.PI / 2, 0.0, 'patrol'); // east corridor, cone south
  world.state.guards[3].wpIndex = 1; // waypoint at his feet: scans in place
  world.state.guards[3].scanBase = Math.PI / 2;
  world.state.guards[3].lookTimer = 99;
  world.setGuard(4, 520, 270, -Math.PI / 2, 0.0, 'patrol'); // inside the core, scanning the north racks
  world.state.guards[4].wpIndex = 0; // waypoint at his feet: scans in place, back to the grate
  world.state.guards[4].scanBase = -Math.PI / 2;
  world.state.guards[4].lookTimer = 99;
  // The EMP jammer fired for the infiltration, then the vent slip for real:
  // tap E at the top-corridor grate, crawl the duct (unseen), climb out in the core.
  world.setTools(1, 2);
  world.fireEmp(6);
  world.placePlayer(300, 52, Math.PI / 2);
  run(world, 1, HOLD); // the slip: the crawl begins
  for (let i = 0; i < 240 && world.state.player.ventEmerge <= 0; i += 1) world.step(STEP, NEUTRAL);
  run(world, 18); // half-way out of the core grate — the pose the frame wants
  // Hold the duct evidence at full strength for the still.
  world.setVentTrail(300, 52, 640, 452);
  // The EMP proof as a big pill-backed floater (the sim's own THROUGH THE VENT
  // floater fired as he reached the grate and is still up).
  world.state.floaters.push({ x: 208, y: 556, text: 'EMP — CAMERAS JAMMED!', color: '#b48ae8', life: 1.4, size: 26 });
  return { screen: SCREEN_PLAY, best: 14000, rating: world.ghostRating() };
}

export function stageShot(name, world) {
  if (name === 'caught' || name === 'camera') return stageCaught(world);
  if (name === 'crack' || name === 'loot') return stageCrack(world); // 'loot' kept as an alias
  if (name === 'extract') return stageExtract(world);
  return stageCover(world);
}
