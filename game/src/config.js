// VAULT ZERO — The Silent Extraction. Every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area (one bank floor, seen from above);
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  walkSpeed: 168,          // px/s unencumbered
  sprintSpeed: 252,        // Shift: fast but loud and easy to spot
  crouchSpeed: 92,         // C / Ctrl: slow, small profile, hidden behind low cover
  weightSlowdown: 0.045,   // each unit of carried loot weight cuts speed by this fraction
  minSpeedFactor: 0.45,    // a full bag never slows the thief below this
  grabSeconds: 1.6,        // hold E beside loot to take it
  extractSeconds: 3.0,     // hold E at the van to escape (longer in lockdown)
  extractLockdownSeconds: 6.0,
  bagCapacity: 10,         // total loot weight the bag holds
  coins: 3,                // distraction coins per floor (mouse click tosses one)
};

export const GUARD = {
  radius: 16,
  patrolSpeed: 74,
  investigateSpeed: 104,
  chaseSpeed: 196,         // a touch slower than a sprinting thief, faster than a laden one
  viewRange: 248,
  viewHalfAngle: 0.62,     // radians either side of facing (~71 degree cone)
  detectFill: 1.35,        // meter fill per second at point blank, scaled by distance
  detectDecay: 0.45,
  catchDistance: 30,
  lookSeconds: 1.6,        // pause-and-scan at each waypoint
  loseSightSeconds: 2.6,   // chase gives up after this long without a sighting
};

export const CAMERA = {
  viewRange: 230,
  viewHalfAngle: 0.5,
  sweepHalfAngle: 0.95,    // how far either side of its mount direction it sweeps
  sweepSpeed: 0.55,        // rad/s at CALM; faster as the alarm rises
  alarmRate: 26,           // alarm points per second while the thief is in frame
};

export const ALARM = {
  max: 100,
  decay: 1.6,              // points per second cooling while nobody sees the thief
  guardSightingRate: 30,   // points per second while a guard's meter is full
  laserSpike: 24,          // points added for crossing an armed laser tripwire
  artifactPulse: 18,       // points added the moment the artifact leaves its pedestal
  // Escalation thresholds: guards hurry, cameras sweep faster, lasers arm, extraction drags.
  levels: [
    { at: 0, name: 'CALM', guardSpeedMul: 1.0, sweepMul: 1.0, lasersArmed: false },
    { at: 25, name: 'SUSPICIOUS', guardSpeedMul: 1.12, sweepMul: 1.35, lasersArmed: false },
    { at: 55, name: 'HUNTED', guardSpeedMul: 1.28, sweepMul: 1.8, lasersArmed: true },
    { at: 85, name: 'LOCKDOWN', guardSpeedMul: 1.45, sweepMul: 2.4, lasersArmed: true },
  ],
};

/** Loot kinds: what a thief can carry out, what it is worth, and what it weighs. */
export const LOOT_KINDS = {
  cash: { value: 500, weight: 1, label: 'Cash bundle', grabSeconds: 1.1 },
  gems: { value: 2000, weight: 1, label: 'Gem case', grabSeconds: 1.6 },
  gold: { value: 3500, weight: 3, label: 'Gold bars', grabSeconds: 2.2 },
  artifact: { value: 5000, weight: 2, label: 'Star artifact', grabSeconds: 2.6 },
};

export const NOISE = {
  sprintRadius: 128,       // guards this close hear a sprinting thief
  coinRadius: 190,         // guards this close hear a tossed coin land
};

export const PALETTE = {
  backdrop: '#0b0e14',
  floorLobby: '#232a38',
  floorGallery: '#262233',
  floorVault: '#1d2733',
  floorOffice: '#2a2620',
  floorAnnex: '#1f2a26',
  floorTileLine: 'rgba(255,255,255,0.045)',
  wall: '#3d4659',
  wallTop: '#5a6a86',
  wallEdge: '#141a24',
  cover: '#4a5a3a',        // planters and display cases you can crouch behind
  coverTop: '#67784e',
  desk: '#5a4632',
  deskTop: '#77593d',
  player: '#141a26',
  playerTrim: '#e8b23a',   // the thief's gold mask stripe
  playerBag: '#8a6a2f',
  guard: '#2e4a78',        // navy security uniform
  guardTrim: '#e8ecf2',    // white cap + badge
  guardCone: 'rgba(255,214,90,0.22)',
  guardConeHot: 'rgba(255,90,70,0.36)',
  camera: '#cfe4f7',
  cameraCone: 'rgba(140,205,255,0.20)',
  cameraConeHot: 'rgba(255,80,80,0.38)',
  lootCash: '#58c472',
  lootGems: '#5fd4e8',
  lootGold: '#f2c94c',
  lootArtifact: '#e88ae0',
  laser: '#ff4d5e',
  van: '#2e6f8e',
  vanTrim: '#bfe3f2',
  extractZone: 'rgba(88,220,160,0.16)',
  panel: 'rgba(13,17,26,0.92)',
  panelEdge: '#e8b23a',
  text: '#eef1f5',
  muted: '#93a0b4',
  alarmCalm: '#58c472',
  alarmWarn: '#f2c94c',
  alarmHot: '#ff7a4d',
  alarmLock: '#ff4d5e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best haul is kept between visits (this browser only). */
export const BEST_KEY = 'vault-zero.best-haul';
