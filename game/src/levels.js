// The two bank floors the thief can rob. A level is plain data: room tints with a floor
// material each (marble lobby, carpet gallery, steel vault, wood office, concrete annex),
// walls (kind 'wall' and 'desk' block sight; kind 'low' is a planter or display case that
// hides a crouching thief), decorative props (statues, gem display cases, a security desk,
// potted trees — they dress the rooms, they do not block), loot placements, guard patrol
// routes, sweeping cameras, laser tripwires, and locked VAULT DOORS. A vault door seals a
// doorway until the thief cracks it (hold E to spin the dial, release in the green, three
// tumblers — see VAULT in config.js); the best loot sits behind them. Coordinates are
// pixels in the 1280x720 field. The vault annex (floor 2) unlocks after a clean extraction.

const T = 16; // interior wall thickness

/** A vertical wall at x from y1 to y2, with door gaps ([gapStart, gapEnd] pairs) left open. */
function vwall(x, y1, y2, gaps) {
  const rects = [];
  let cursor = y1;
  for (const [g1, g2] of gaps) {
    if (g1 > cursor) rects.push({ x, y: cursor, w: T, h: g1 - cursor, kind: 'wall' });
    cursor = Math.max(cursor, g2);
  }
  if (y2 > cursor) rects.push({ x, y: cursor, w: T, h: y2 - cursor, kind: 'wall' });
  return rects;
}

/** A horizontal wall at y from x1 to x2, with door gaps left open. */
function hwall(y, x1, x2, gaps) {
  const rects = [];
  let cursor = x1;
  for (const [g1, g2] of gaps) {
    if (g1 > cursor) rects.push({ x: cursor, y, w: g1 - cursor, h: T, kind: 'wall' });
    cursor = Math.max(cursor, g2);
  }
  if (x2 > cursor) rects.push({ x: cursor, y, w: x2 - cursor, h: T, kind: 'wall' });
  return rects;
}

/** The outer shell every floor shares: 24px border walls. */
function border() {
  return [
    { x: 0, y: 0, w: 1280, h: 24, kind: 'wall' },
    { x: 0, y: 696, w: 1280, h: 24, kind: 'wall' },
    { x: 0, y: 0, w: 24, h: 720, kind: 'wall' },
    { x: 1256, y: 0, w: 24, h: 720, kind: 'wall' },
  ];
}

const groundFloor = {
  name: 'MERIDIAN TRUST — GROUND FLOOR',
  subtitle: 'Floor 1 · lobby, gallery, vault and records office',
  spawn: { x: 110, y: 630 },
  extract: { x: 36, y: 592, w: 150, h: 92 }, // the getaway van idling by the rear door
  rooms: [
    { x: 24, y: 24, w: 376, h: 672, tint: 'floorLobby', label: 'LOBBY', floor: 'marble' },
    { x: 416, y: 24, w: 444, h: 416, tint: 'floorGallery', label: 'GALLERY', floor: 'carpet' },
    { x: 876, y: 24, w: 380, h: 416, tint: 'floorVault', label: 'VAULT', floor: 'steel' },
    { x: 416, y: 456, w: 444, h: 240, tint: 'floorOffice', label: 'RECORDS OFFICE', floor: 'wood' },
    { x: 876, y: 456, w: 380, h: 240, tint: 'floorVault', label: 'SERVICE', floor: 'steel' },
  ],
  // Decorative set dressing (no collision): statues, gem cases, the security desk, trees.
  props: [
    { kind: 'statue', x: 62, y: 160 },
    { kind: 'statue', x: 362, y: 62 },
    { kind: 'tree', x: 62, y: 520 },
    { kind: 'tree', x: 362, y: 640 },
    { kind: 'security', x: 330, y: 560 },
    { kind: 'statue', x: 448, y: 62 },
    { kind: 'case', x: 826, y: 120 },
    { kind: 'case', x: 448, y: 402 },
    { kind: 'tree', x: 826, y: 402 },
    { kind: 'case', x: 910, y: 62 },
    { kind: 'statue', x: 1222, y: 62 },
    { kind: 'tree', x: 910, y: 402 },
    { kind: 'tree', x: 448, y: 660 },
    { kind: 'case', x: 826, y: 490 },
    { kind: 'security', x: 1066, y: 640 },
  ],
  // The ground-floor vault door seals the gallery→vault doorway (gap y 180–236 at x=860).
  vaultDoors: [
    { x: 868, y: 208, blocker: { x: 860, y: 180, w: 16, h: 56, kind: 'wall' } },
  ],
  walls: [
    ...border(),
    ...vwall(400, 24, 696, [[300, 356], [540, 596]]),   // lobby | gallery + office
    ...vwall(860, 24, 696, [[180, 236], [540, 596]]),   // gallery | vault, office | service
    ...hwall(440, 416, 1256, [[600, 656], [1020, 1076]]), // gallery | office, vault | service
    // Lobby furniture: a teller desk (blocks sight) and planters (crouch cover).
    { x: 120, y: 96, w: 200, h: 34, kind: 'desk' },
    { x: 90, y: 300, w: 90, h: 26, kind: 'low' },
    { x: 250, y: 430, w: 90, h: 26, kind: 'low' },
    // Gallery display cases: low cover in the middle of the room the thief must cross.
    { x: 500, y: 210, w: 110, h: 28, kind: 'low' },
    { x: 680, y: 300, w: 110, h: 28, kind: 'low' },
    { x: 560, y: 110, w: 28, h: 70, kind: 'low' },
    // Vault racks: tall, they break the room into lanes.
    { x: 960, y: 210, w: 120, h: 26, kind: 'desk' },
    { x: 1080, y: 330, w: 120, h: 26, kind: 'desk' },
    // Office desks and a service counter.
    { x: 470, y: 540, w: 130, h: 30, kind: 'desk' },
    { x: 700, y: 610, w: 130, h: 30, kind: 'desk' },
    { x: 980, y: 540, w: 160, h: 28, kind: 'desk' },
  ],
  loot: [
    { kind: 'cash', x: 220, y: 150 },      // teller register
    { kind: 'gems', x: 545, y: 250 },      // gallery case A
    { kind: 'gems', x: 735, y: 340 },      // gallery case B
    { kind: 'gold', x: 1020, y: 110 },     // vault rack
    { kind: 'gold', x: 1140, y: 280 },     // vault rack
    { kind: 'artifact', x: 630, y: 520 },  // office pedestal (trips a silent pulse)
    { kind: 'cash', x: 1060, y: 600 },     // service safe
  ],
  guards: [
    { path: [[210, 180], [210, 520]] },                                   // lobby patrol
    { path: [[480, 110], [800, 110], [800, 380], [480, 380]] },           // gallery loop
    { path: [[950, 120], [1190, 120], [1190, 380], [950, 380]] },         // vault loop
    { path: [[500, 640], [1180, 640]] },                                  // office/service sweep
  ],
  cameras: [
    { x: 212, y: 32, baseAngle: Math.PI / 2 },   // over the lobby, looking down
    { x: 640, y: 32, baseAngle: Math.PI / 2 },   // over the gallery
    { x: 1066, y: 32, baseAngle: Math.PI / 2 },  // over the vault
    { x: 628, y: 466, baseAngle: Math.PI / 2 },  // office door camera
  ],
  lasers: [
    { x1: 868, y1: 184, x2: 868, y2: 232 },  // vault doorway beam
    { x1: 604, y1: 448, x2: 652, y2: 448 },  // gallery-to-office beam
  ],
};

const vaultAnnex = {
  name: 'VAULT ANNEX — BASEMENT',
  subtitle: 'Floor 2 · a ring corridor around the sealed vault core',
  spawn: { x: 110, y: 630 },
  extract: { x: 36, y: 592, w: 150, h: 92 },
  rooms: [
    { x: 24, y: 24, w: 1232, h: 672, tint: 'floorAnnex', label: 'RING CORRIDOR', floor: 'concrete' },
    { x: 456, y: 236, w: 368, h: 248, tint: 'floorVault', label: 'VAULT CORE', floor: 'steel' },
  ],
  props: [
    { kind: 'statue', x: 62, y: 150 },
    { kind: 'statue', x: 1218, y: 62 },
    { kind: 'statue', x: 1218, y: 540 },
    { kind: 'tree', x: 320, y: 62 },
    { kind: 'tree', x: 960, y: 62 },
    { kind: 'tree', x: 320, y: 658 },
    { kind: 'tree', x: 960, y: 658 },
    { kind: 'security', x: 480, y: 650 },
    { kind: 'case', x: 480, y: 452 },
    { kind: 'case', x: 800, y: 452 },
    { kind: 'case', x: 480, y: 268 },
    { kind: 'case', x: 800, y: 268 },
  ],
  // The vault core is sealed by TWO vault doors (north + south). Crack either one to get
  // in at the gold bars and the star artifact; the other stays locked until cracked too.
  vaultDoors: [
    { x: 640, y: 228, blocker: { x: 612, y: 220, w: 56, h: 16, kind: 'wall' } },
    { x: 640, y: 492, blocker: { x: 612, y: 484, w: 56, h: 16, kind: 'wall' } },
  ],
  walls: [
    ...border(),
    // The vault core: a sealed box with one door top and one door bottom.
    ...hwall(220, 440, 840, [[612, 668]]),
    ...hwall(484, 440, 840, [[612, 668]]),
    ...vwall(440, 220, 500, []),
    ...vwall(824, 220, 500, []),
    // Corridor pillars and crates break up the ring's sightlines.
    { x: 240, y: 160, w: 34, h: 90, kind: 'desk' },
    { x: 1006, y: 160, w: 34, h: 90, kind: 'desk' },
    { x: 240, y: 470, w: 34, h: 90, kind: 'desk' },
    { x: 1006, y: 470, w: 34, h: 90, kind: 'desk' },
    { x: 560, y: 110, w: 160, h: 26, kind: 'low' },
    { x: 560, y: 584, w: 160, h: 26, kind: 'low' },
    { x: 120, y: 330, w: 90, h: 26, kind: 'low' },
    { x: 1070, y: 330, w: 90, h: 26, kind: 'low' },
    // Core racks.
    { x: 500, y: 300, w: 110, h: 24, kind: 'desk' },
    { x: 670, y: 300, w: 110, h: 24, kind: 'desk' },
    { x: 585, y: 410, w: 110, h: 24, kind: 'desk' },
  ],
  loot: [
    { kind: 'gems', x: 140, y: 110 },
    { kind: 'cash', x: 1140, y: 110 },
    { kind: 'cash', x: 1140, y: 620 },
    { kind: 'gems', x: 640, y: 160 },
    { kind: 'gold', x: 555, y: 340 },
    { kind: 'gold', x: 725, y: 340 },
    { kind: 'artifact', x: 640, y: 380 },
  ],
  guards: [
    { path: [[150, 120], [1130, 120]] },                        // top corridor
    { path: [[1130, 620], [150, 620]] },                        // bottom corridor (counter-phase)
    { path: [[150, 120], [150, 620]] },                         // west corridor
    { path: [[1130, 620], [1130, 120]] },                       // east corridor
    { path: [[520, 270], [760, 270], [760, 450], [520, 450]] }, // inside the core
  ],
  cameras: [
    { x: 640, y: 32, baseAngle: Math.PI / 2 },
    { x: 640, y: 688, baseAngle: -Math.PI / 2 },
    { x: 32, y: 360, baseAngle: 0 },
    { x: 1248, y: 360, baseAngle: Math.PI },
  ],
  lasers: [
    { x1: 616, y1: 228, x2: 664, y2: 228 },  // core north door
    { x1: 616, y1: 492, x2: 664, y2: 492 },  // core south door
    { x1: 640, y1: 60, x2: 640, y2: 180 },   // top corridor beam
  ],
};

export const LEVELS = [groundFloor, vaultAnnex];
