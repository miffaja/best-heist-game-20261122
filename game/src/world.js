// The heist simulation: pure rules, no drawing and no DOM, stepped at a fixed 1/60s.
// The thief moves with wall sliding; guards patrol waypoints with real vision cones
// (range + field of view + line of sight blocked by walls, and by low cover while the
// thief crouches); cameras sweep and feed the alarm meter; the alarm escalates through
// CALM -> SUSPICIOUS -> HUNTED -> LOCKDOWN, speeding guards, arming laser tripwires and
// slowing the getaway. Loot has weight: a heavy bag makes a slow thief. Escape means
// standing at the van with loot in the bag and holding the extraction channel.
//
// VAULT-CRACKING: locked vault doors seal the best loot. At a door, HOLD E to spin the
// combination dial (the thief stands still, exposed) and RELEASE E with the needle in
// the green zone to set a tumbler. Three tumblers swing the door open; a release outside
// the green jams the lock and raises the alarm. Progress on a door is kept if the thief
// steps away and comes back.
import { ALARM, CAMERA, FIELD, GUARD, LOOT_KINDS, NOISE, PLAYER, TOOLS, VAULT, VENT } from './config.js';
import { LEVELS } from './levels.js';
import { alarmLevelIndex, angleDelta, segmentHitsRect, segmentsCross } from './geometry.js';

export const EVENT_LOOT = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_EXTRACTED = 4;
export const EVENT_LASER = 8;
export const EVENT_CAMERA = 16;
export const EVENT_COIN_LAND = 32;
export const EVENT_ALARM_UP = 64;
export const EVENT_GUARD_ALERT = 128;
export const EVENT_VAULT_TUMBLER = 256; // a tumbler clicked into place
export const EVENT_VAULT_FAIL = 512;    // a jammed release: alarm up
export const EVENT_VAULT_OPEN = 1024;   // the vault door swung open
export const EVENT_EMP = 2048;          // the EMP jammer fired: cameras + lasers dead
export const EVENT_SMOKE = 4096;        // a smoke bomb popped: sight blocked in the cloud
export const EVENT_VENT = 8192;         // the thief slipped through a vent grate

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: null,
    walls: [],
    vaultDoors: [], // {x, y, blocker, open, tumblers, needle, greenCenter, spinning}
    crackDoor: -1,  // index into vaultDoors the thief is cracking (or last cracked at), -1 = none
    prevInteract: false,
    player: null,
    guards: [],
    cameras: [],
    loot: [],
    lasers: [],
    particles: [],
    floaters: [],   // {x, y, text, life} rising labels ("+$2,000", "BAG FULL")
    coinsInFlight: [],
    vents: [],      // paired wall grates from the level (index pairs 0<->1, 2<->3)
    ventTrail: null, // {x1, y1, x2, y2, life} — the duct path of the last vent slip, fading
    smokeClouds: [], // {x, y, life} — sight is blocked inside a cloud
    empTimer: 0,    // >0 while the EMP jammer holds cameras + lasers dead
    alarm: 0,
    alarmPeak: 0,
    alarmLevel: 0,
    elapsed: 0,
    detections: 0,
    caught: false,
    extracted: false,
    lockdownGuardSpawned: false,
    hintCooldown: 0,
  };

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      state.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0.5 + random() * 0.5, maxLife: 1, color, size: 2 + random() * 2.5,
      });
    }
  }

  function floater(x, y, text, color) {
    // Keep labels inside the field so edge events (west-wall vents, the van) stay readable.
    const cx = Math.max(110, Math.min(FIELD.width - 110, x));
    state.floaters.push({ x: cx, y, text, color, life: 1.4 });
  }

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    // A copy: locked vault doors add their blocker slabs here, cracking removes them.
    state.walls = level.walls.slice();
    state.vaultDoors = (level.vaultDoors || []).map((d) => {
      const blocker = { ...d.blocker };
      state.walls.push(blocker);
      return {
        x: d.x, y: d.y, blocker, open: false, tumblers: 0,
        needle: 0, greenCenter: random() * Math.PI * 2, spinning: false,
      };
    });
    state.crackDoor = -1;
    state.prevInteract = false;
    state.player = {
      x: level.spawn.x, y: level.spawn.y, angle: -Math.PI / 2,
      crouch: false, sprint: false, moving: false,
      weight: 0, haul: 0, coins: PLAYER.coins,
      emp: TOOLS.empCharges, smoke: TOOLS.smokeCharges,
      grabProgress: 0, grabTarget: null, extractProgress: 0,
    };
    state.vents = (level.vents || []).map((v) => ({ x: v.x, y: v.y }));
    state.ventTrail = null;
    state.smokeClouds = [];
    state.empTimer = 0;
    state.guards = level.guards.map((g) => ({
      x: g.path[0][0], y: g.path[0][1],
      angle: Math.atan2(g.path[1][1] - g.path[0][1], g.path[1][0] - g.path[0][0]),
      path: g.path, wpIndex: 1 % g.path.length,
      meter: 0, mode: 'patrol', // patrol | investigate | chase
      lastSeen: null, investigatePoint: null,
      loseTimer: 0, lookTimer: 0, scanBase: 0, seeing: false, wasChasing: false,
    }));
    state.cameras = level.cameras.map((c, i) => ({
      x: c.x, y: c.y, baseAngle: c.baseAngle, angle: c.baseAngle,
      phase: i * 1.7, seeing: false, wasSeeing: false, alertTimer: 0,
    }));
    state.loot = level.loot.map((l) => ({
      kind: l.kind, x: l.x, y: l.y, taken: false,
      value: LOOT_KINDS[l.kind].value, weight: LOOT_KINDS[l.kind].weight,
    }));
    state.lasers = level.lasers.map((l) => ({ ...l, cooldown: 0 }));
    state.particles = [];
    state.floaters = [];
    state.coinsInFlight = [];
    state.alarm = 0;
    state.alarmPeak = 0;
    state.alarmLevel = 0;
    state.elapsed = 0;
    state.detections = 0;
    state.caught = false;
    state.extracted = false;
    state.lockdownGuardSpawned = false;
    state.hintCooldown = 0;
  }

  /** Circle vs walls: try X then Y so the thief slides along walls instead of sticking. */
  function moveCircle(entity, dx, dy, radius) {
    entity.x += dx;
    for (const rect of state.walls) {
      const cx = Math.max(rect.x, Math.min(entity.x, rect.x + rect.w));
      const cy = Math.max(rect.y, Math.min(entity.y, rect.y + rect.h));
      const ddx = entity.x - cx;
      const ddy = entity.y - cy;
      if (ddx * ddx + ddy * ddy < radius * radius) {
        entity.x = dx > 0 ? rect.x - radius : rect.x + rect.w + radius;
      }
    }
    entity.y += dy;
    for (const rect of state.walls) {
      const cx = Math.max(rect.x, Math.min(entity.x, rect.x + rect.w));
      const cy = Math.max(rect.y, Math.min(entity.y, rect.y + rect.h));
      const ddx = entity.x - cx;
      const ddy = entity.y - cy;
      if (ddx * ddx + ddy * ddy < radius * radius) {
        entity.y = dy > 0 ? rect.y - radius : rect.y + rect.h + radius;
      }
    }
    entity.x = Math.max(radius, Math.min(FIELD.width - radius, entity.x));
    entity.y = Math.max(radius, Math.min(FIELD.height - radius, entity.y));
  }

  /** Is the thief standing inside a smoke cloud? Sight stops at the cloud's edge. */
  function thiefInSmoke() {
    const p = state.player;
    return state.smokeClouds.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < TOOLS.smokeRadius);
  }

  /** Can an observer at (x,y) facing `angle` see the thief right now? */
  function canSeeThief(x, y, angle, range, halfAngle) {
    const p = state.player;
    if (thiefInSmoke()) return false; // a smoke cloud hides the thief from everyone
    const dx = p.x - x;
    const dy = p.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist > range) return false;
    if (dist > 30 && Math.abs(angleDelta(angle, Math.atan2(dy, dx))) > halfAngle) return false;
    for (const rect of state.walls) {
      if (rect.kind === 'low' && !p.crouch) continue; // low cover only hides a crouching thief
      if (segmentHitsRect(x, y, p.x, p.y, rect)) return false;
    }
    return true;
  }

  function guardSpeed(guard) {
    const mul = ALARM.levels[state.alarmLevel].guardSpeedMul;
    if (guard.mode === 'chase') return GUARD.chaseSpeed * mul;
    if (guard.mode === 'investigate') return GUARD.investigateSpeed * mul;
    return GUARD.patrolSpeed * mul;
  }

  function stepGuard(guard, dt) {
    const p = state.player;
    const distToPlayer = Math.hypot(p.x - guard.x, p.y - guard.y);
    guard.seeing = canSeeThief(guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle);

    if (guard.seeing) {
      const stanceMul = p.crouch ? 0.45 : p.sprint ? 1.5 : 1.0;
      const distMul = 1 - 0.6 * (distToPlayer / GUARD.viewRange);
      guard.meter = Math.min(1, guard.meter + GUARD.detectFill * stanceMul * distMul * dt);
      guard.lastSeen = { x: p.x, y: p.y };
      guard.loseTimer = 0;
      if (guard.meter >= 1 && guard.mode !== 'chase') {
        guard.mode = 'chase';
        state.detections += 1;
      }
      if (guard.mode === 'chase') state.alarm = Math.min(ALARM.max, state.alarm + ALARM.guardSightingRate * dt);
    } else {
      guard.meter = Math.max(0, guard.meter - GUARD.detectDecay * dt);
      if (guard.mode === 'chase') {
        guard.loseTimer += dt;
        if (guard.loseTimer > GUARD.loseSightSeconds) {
          guard.mode = 'investigate';
          guard.investigatePoint = guard.lastSeen;
          guard.lookTimer = 0;
        }
      }
    }
    // A sprinting thief is heard through walls at close range.
    if (p.sprint && p.moving && distToPlayer < NOISE.sprintRadius && guard.mode === 'patrol') {
      guard.mode = 'investigate';
      guard.investigatePoint = { x: p.x, y: p.y };
      guard.meter = Math.max(guard.meter, 0.35);
    }

    let target = null;
    if (guard.mode === 'chase') target = guard.seeing ? p : guard.lastSeen;
    else if (guard.mode === 'investigate') target = guard.investigatePoint;
    else target = { x: guard.path[guard.wpIndex][0], y: guard.path[guard.wpIndex][1] };

    if (guard.lookTimer > 0) {
      guard.lookTimer -= dt;
      guard.angle = guard.scanBase + Math.sin(state.elapsed * 2.2 + guard.x) * 0.75;
      if (guard.lookTimer <= 0 && guard.mode === 'investigate') {
        guard.mode = 'patrol';
        // Resume from the nearest waypoint.
        let best = 0;
        let bestDist = Infinity;
        guard.path.forEach((wp, i) => {
          const d = Math.hypot(wp[0] - guard.x, wp[1] - guard.y);
          if (d < bestDist) { bestDist = d; best = i; }
        });
        guard.wpIndex = best;
      }
      return;
    }
    if (!target) return;
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const dist = Math.hypot(dx, dy);
    const arriveDist = guard.mode === 'patrol' ? 8 : 16;
    if (dist < arriveDist) {
      if (guard.mode === 'patrol') {
        guard.wpIndex = (guard.wpIndex + 1) % guard.path.length;
        guard.lookTimer = GUARD.lookSeconds;
        guard.scanBase = guard.angle;
      } else if (guard.mode === 'investigate') {
        guard.lookTimer = 2.0;
        guard.scanBase = guard.angle;
      }
      return;
    }
    const wanted = Math.atan2(dy, dx);
    guard.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, angleDelta(guard.angle, wanted)));
    const speed = guardSpeed(guard);
    moveCircle(guard, Math.cos(wanted) * speed * dt, Math.sin(wanted) * speed * dt, GUARD.radius);
  }

  function stepCamera(camera, dt, events) {
    const sweepMul = ALARM.levels[state.alarmLevel].sweepMul;
    camera.angle = camera.baseAngle + Math.sin(state.elapsed * CAMERA.sweepSpeed * sweepMul + camera.phase) * CAMERA.sweepHalfAngle;
    // An EMP pulse freezes the sweep and blinds the lens until the timer runs out.
    camera.jammed = state.empTimer > 0;
    camera.seeing = !camera.jammed && canSeeThief(camera.x, camera.y, camera.angle, CAMERA.viewRange, CAMERA.viewHalfAngle);
    if (camera.seeing) {
      state.alarm = Math.min(ALARM.max, state.alarm + CAMERA.alarmRate * dt);
      if (!camera.wasSeeing) events.value |= EVENT_CAMERA;
      camera.alertTimer -= dt;
      if (camera.alertTimer <= 0) {
        camera.alertTimer = 1.2;
        // The camera operator radios the nearest guard to the thief's position.
        let nearest = null;
        let best = Infinity;
        for (const guard of state.guards) {
          const d = Math.hypot(guard.x - state.player.x, guard.y - state.player.y);
          if (d < best) { best = d; nearest = guard; }
        }
        if (nearest && nearest.mode === 'patrol') {
          nearest.mode = 'investigate';
          nearest.investigatePoint = { x: state.player.x, y: state.player.y };
          nearest.meter = Math.max(nearest.meter, 0.5);
          events.value |= EVENT_GUARD_ALERT;
        }
      }
    }
    camera.wasSeeing = camera.seeing;
  }

  /**
   * One fixed step. `input` is {mx, my, interact, crouch, sprint, aimAngle, toss}.
   * Returns EVENT_* flags for sound and screen changes.
   */
  function step(dt, input) {
    const events = { value: 0 };
    if (state.caught || state.extracted) return 0;
    state.elapsed += dt;
    const p = state.player;
    const prevX = p.x;
    const prevY = p.y;

    // --- Vault-cracking target: the nearest LOCKED vault door in reach. While E is held
    // at one, the dial spins and the thief stands still (willSpin locks movement below).
    let nearDoor = -1;
    let nearDoorDist = Infinity;
    state.vaultDoors.forEach((door, i) => {
      if (door.open) return;
      const d = Math.hypot(door.x - p.x, door.y - p.y);
      if (d < VAULT.crackRange && d < nearDoorDist) { nearDoor = i; nearDoorDist = d; }
    });
    const willSpin = !!input.interact && nearDoor >= 0;
    if (willSpin) state.crackDoor = nearDoor;
    else if (!input.interact && nearDoor < 0) state.crackDoor = -1; // walked away; tumblers persist

    // --- Thief movement: stance and bag weight set the speed. ---
    p.crouch = !!input.crouch;
    p.sprint = !!input.sprint && !p.crouch;
    const len = willSpin ? 0 : Math.hypot(input.mx, input.my);
    p.moving = len > 0;
    const weightFactor = Math.max(PLAYER.minSpeedFactor, 1 - p.weight * PLAYER.weightSlowdown);
    const baseSpeed = p.crouch ? PLAYER.crouchSpeed : p.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const speed = baseSpeed * weightFactor;
    if (p.moving) {
      moveCircle(p, (input.mx / len) * speed * dt, (input.my / len) * speed * dt, PLAYER.radius);
      p.angle = Math.atan2(input.my, input.mx);
    }
    if (typeof input.aimAngle === 'number') p.angle = input.aimAngle;

    // --- Coin toss: a distraction that pulls guards to where it lands. ---
    if (input.toss && p.coins > 0) {
      p.coins -= 1;
      state.coinsInFlight.push({ x: p.x, y: p.y, tx: input.toss.x, ty: input.toss.y, t: 0 });
    }
    for (let i = state.coinsInFlight.length - 1; i >= 0; i -= 1) {
      const coin = state.coinsInFlight[i];
      coin.t += dt / 0.45;
      if (coin.t >= 1) {
        state.coinsInFlight.splice(i, 1);
        events.value |= EVENT_COIN_LAND;
        burst(coin.tx, coin.ty, '#f2c94c', 6, 60);
        for (const guard of state.guards) {
          if (Math.hypot(guard.x - coin.tx, guard.y - coin.ty) < NOISE.coinRadius && guard.mode !== 'chase') {
            guard.mode = 'investigate';
            guard.investigatePoint = { x: coin.tx, y: coin.ty };
          }
        }
      }
    }

    // --- Tools at a cost: EMP jammer (Q) and smoke bomb (R), scarce per floor. ---
    state.empTimer = Math.max(0, state.empTimer - dt);
    if (input.emp && p.emp > 0 && state.empTimer === 0) {
      p.emp -= 1;
      state.empTimer = TOOLS.empSeconds;
      events.value |= EVENT_EMP;
      burst(p.x, p.y, '#b48ae8', 20, 160);
      floater(p.x, p.y - 34, 'EMP — CAMERAS JAMMED!', '#b48ae8');
    }
    if (input.smoke && p.smoke > 0) {
      p.smoke -= 1;
      state.smokeClouds.push({ x: p.x, y: p.y, life: TOOLS.smokeSeconds });
      events.value |= EVENT_SMOKE;
      burst(p.x, p.y, '#b4becd', 16, 70);
      floater(p.x, p.y - 34, 'SMOKE!', '#cfe4f7');
    }
    for (let i = state.smokeClouds.length - 1; i >= 0; i -= 1) {
      state.smokeClouds[i].life -= dt;
      if (state.smokeClouds[i].life <= 0) state.smokeClouds.splice(i, 1);
    }

    // --- Vents: tap E at a grate to slip to its pair (a second route past doors). ---
    if (input.interact && !state.prevInteract && nearDoor < 0) {
      const vi = state.vents.findIndex((v) => Math.hypot(v.x - p.x, v.y - p.y) < VENT.useRange);
      if (vi >= 0) {
        const dest = state.vents[vi % 2 === 0 ? vi + 1 : vi - 1];
        if (dest) {
          burst(p.x, p.y, '#9fb4c8', 10, 60);
          // The duct path stays drawn for a moment so the route taken reads on screen.
          state.ventTrail = { x1: p.x, y1: p.y, x2: dest.x, y2: dest.y, life: 2.6 };
          p.x = dest.x;
          p.y = dest.y;
          burst(p.x, p.y, '#9fb4c8', 10, 60);
          floater(p.x, p.y - 30, 'THROUGH THE VENT', '#cfe4f7');
          events.value |= EVENT_VENT;
        }
      }
    }

    // --- Guards and cameras perceive, then move. ---
    for (const guard of state.guards) stepGuard(guard, dt);
    for (const camera of state.cameras) stepCamera(camera, dt, events);

    // --- Caught: a guard who has made the thief lays hands on them. ---
    for (const guard of state.guards) {
      const d = Math.hypot(guard.x - p.x, guard.y - p.y);
      if (d < GUARD.catchDistance && (guard.mode === 'chase' || guard.meter > 0.55)) {
        if (guard.mode !== 'chase') state.detections += 1; // walked into a guard who had made you
        state.caught = true;
        events.value |= EVENT_CAUGHT;
        burst(p.x, p.y, '#ff4d5e', 18, 130);
        return events.value;
      }
    }

    // --- Laser tripwires (armed from HUNTED up; an EMP pulse kills them too). ---
    const lasersArmed = ALARM.levels[state.alarmLevel].lasersArmed && state.empTimer === 0;
    for (const laser of state.lasers) {
      laser.cooldown = Math.max(0, laser.cooldown - dt);
      if (lasersArmed && laser.cooldown === 0 && (prevX !== p.x || prevY !== p.y)) {
        if (segmentsCross(prevX, prevY, p.x, p.y, laser.x1, laser.y1, laser.x2, laser.y2)) {
          state.alarm = Math.min(ALARM.max, state.alarm + ALARM.laserSpike);
          laser.cooldown = 3;
          events.value |= EVENT_LASER;
          floater(p.x, p.y - 26, 'LASER TRIPPED!', '#ff4d5e');
        }
      }
    }

    // --- VAULT-CRACKING: hold E spins the dial; releasing E sets (or jams) a tumbler. ---
    if (willSpin) {
      const door = state.vaultDoors[state.crackDoor];
      door.spinning = true;
      door.needle = (door.needle + VAULT.needleSpeed * dt) % (Math.PI * 2);
    } else if (!input.interact && state.prevInteract && state.crackDoor >= 0) {
      const door = state.vaultDoors[state.crackDoor];
      door.spinning = false;
      if (!door.open) {
        const off = Math.abs(angleDelta(door.greenCenter, door.needle));
        if (off <= VAULT.greenHalf) {
          door.tumblers += 1;
          events.value |= EVENT_VAULT_TUMBLER;
          burst(door.x, door.y, '#58dc9c', 10, 80);
          if (door.tumblers >= VAULT.tumblers) {
            door.open = true;
            state.walls = state.walls.filter((w) => w !== door.blocker);
            events.value |= EVENT_VAULT_OPEN;
            floater(door.x, door.y - 30, 'VAULT OPEN!', '#58dc9c');
            burst(door.x, door.y, '#f2c94c', 22, 130);
          } else {
            floater(door.x, door.y - 30, `TUMBLER SET! ${door.tumblers}/${VAULT.tumblers}`, '#58dc9c');
            door.greenCenter = random() * Math.PI * 2; // next tumbler hides elsewhere
          }
        } else {
          state.alarm = Math.min(ALARM.max, state.alarm + VAULT.wrongAlarm);
          events.value |= EVENT_VAULT_FAIL;
          floater(door.x, door.y - 30, 'VAULT JAMMED! +ALARM', '#ff4d5e');
          burst(door.x, door.y, '#ff4d5e', 10, 90);
        }
      }
    } else if (state.crackDoor >= 0) {
      state.vaultDoors[state.crackDoor].spinning = false;
    }
    if (nearDoor >= 0 && !input.interact && state.hintCooldown <= 0) {
      floater(p.x, p.y - 30, 'HOLD E — CRACK THE VAULT', '#f2c94c');
      state.hintCooldown = 2.5;
    }
    state.prevInteract = !!input.interact;

    // --- Loot: hold interact beside a target; the bag fills and the thief slows.
    // (Skipped while the vault dial spins: E belongs to the lock then.) ---
    if (!willSpin) {
    let nearLoot = null;
    for (const item of state.loot) {
      if (!item.taken && Math.hypot(item.x - p.x, item.y - p.y) < 36) { nearLoot = item; break; }
    }
    if (input.interact && nearLoot) {
      if (p.weight + nearLoot.weight > PLAYER.bagCapacity) {
        if (state.hintCooldown <= 0) { floater(p.x, p.y - 26, 'BAG FULL', '#f2c94c'); state.hintCooldown = 1.2; }
        p.grabProgress = 0;
        p.grabTarget = null;
      } else {
        p.grabTarget = nearLoot;
        p.grabProgress += dt / LOOT_KINDS[nearLoot.kind].grabSeconds;
        if (p.grabProgress >= 1) {
          nearLoot.taken = true;
          p.haul += nearLoot.value;
          p.weight += nearLoot.weight;
          p.grabProgress = 0;
          p.grabTarget = null;
          events.value |= EVENT_LOOT;
          floater(nearLoot.x, nearLoot.y - 20, `+$${nearLoot.value.toLocaleString('en-US')}`, '#7de8a0');
          burst(nearLoot.x, nearLoot.y, '#f2c94c', 14, 90);
          if (nearLoot.kind === 'artifact') {
            state.alarm = Math.min(ALARM.max, state.alarm + ALARM.artifactPulse);
            floater(nearLoot.x, nearLoot.y - 40, 'SILENT PULSE!', '#e88ae0');
          }
        }
      }
    } else {
      p.grabProgress = Math.max(0, p.grabProgress - dt * 2.5);
      if (p.grabProgress === 0) p.grabTarget = null;
    }

    // --- Extraction: stand at the van with loot and hold the channel. ---
    const zone = state.level.extract;
    const inZone = p.x > zone.x && p.x < zone.x + zone.w && p.y > zone.y && p.y < zone.y + zone.h;
    if (inZone && input.interact) {
      if (p.haul > 0) {
        const needed = state.alarmLevel >= 3 ? PLAYER.extractLockdownSeconds : PLAYER.extractSeconds;
        p.extractProgress += dt / needed;
        if (p.extractProgress >= 1) {
          state.extracted = true;
          events.value |= EVENT_EXTRACTED;
          burst(p.x, p.y, '#7de8a0', 26, 150);
          return events.value;
        }
      } else if (state.hintCooldown <= 0) {
        floater(p.x, p.y - 26, 'GRAB LOOT FIRST', '#f2c94c');
        state.hintCooldown = 1.2;
      }
    } else {
      p.extractProgress = Math.max(0, p.extractProgress - dt * 1.5);
    }
    } // end !willSpin (loot + extraction)
    state.hintCooldown = Math.max(0, state.hintCooldown - dt);

    // --- Alarm cooling and escalation bookkeeping. ---
    const anyChase = state.guards.some((g) => g.mode === 'chase' && g.seeing);
    const anyCamera = state.cameras.some((c) => c.seeing);
    if (!anyChase && !anyCamera) state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
    state.alarmPeak = Math.max(state.alarmPeak, state.alarm);
    const newLevel = alarmLevelIndex(state.alarm);
    if (newLevel > state.alarmLevel) {
      events.value |= EVENT_ALARM_UP;
      floater(p.x, p.y - 44, `ALARM: ${ALARM.levels[newLevel].name}`, '#ff7a4d');
      if (newLevel >= 3 && !state.lockdownGuardSpawned) {
        state.lockdownGuardSpawned = true;
        // Lockdown calls in one more guard, posted on the run to the van.
        state.guards.push({
          x: 640, y: 640, angle: Math.PI,
          path: [[640, 640], [240, 640]], wpIndex: 1,
          meter: 0.4, mode: 'patrol', lastSeen: null, investigatePoint: null,
          loseTimer: 0, lookTimer: 0, scanBase: 0, seeing: false, wasChasing: false,
        });
        floater(640, 610, 'EXTRA GUARD DEPLOYED', '#ff4d5e');
      }
    }
    state.alarmLevel = newLevel;

    // --- Particles and floating labels. ---
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { state.particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.life -= dt;
      f.y -= 22 * dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
    if (state.ventTrail) {
      state.ventTrail.life -= dt;
      if (state.ventTrail.life <= 0) state.ventTrail = null;
    }
    return events.value;
  }

  /** Ghost rating for the extraction report: S is a true ghost, C is a smash-and-grab. */
  function ghostRating() {
    if (state.detections === 0 && state.alarmPeak < 25) return 'S';
    if (state.detections <= 1 && state.alarmPeak < 55) return 'A';
    if (state.detections <= 3) return 'B';
    return 'C';
  }

  loadLevel(0);
  return {
    state,
    step,
    loadLevel,
    ghostRating,
    reset() { loadLevel(state.levelIndex); },
    // Staging helpers for the screenshot scenes (shots.js): they place real entities and
    // let the ordinary step() run, so every frame is the game's own simulation.
    placePlayer(x, y, angle) { state.player.x = x; state.player.y = y; state.player.angle = angle; },
    setGuard(index, x, y, angle, meter, mode) {
      const g = state.guards[index];
      if (!g) return;
      g.x = x; g.y = y; g.angle = angle; g.meter = meter; g.mode = mode; g.lookTimer = 0;
      if (mode === 'chase') { g.lastSeen = { x: state.player.x, y: state.player.y }; }
    },
    setAlarm(value) { state.alarm = value; state.alarmPeak = Math.max(state.alarmPeak, value); state.alarmLevel = alarmLevelIndex(value); },
    giveLoot(kind) {
      const item = state.loot.find((l) => l.kind === kind && !l.taken);
      if (!item) return;
      item.taken = true;
      state.player.haul += item.value;
      state.player.weight += item.weight;
    },
    setElapsed(seconds) { state.elapsed = seconds; },
    /** Stage a vault-crack in progress: `tumblers` already set, needle `needleOffset` rad
     *  from the green zone's centre (0 = dead centre), dial spinning with E held. */
    setVaultCrack(doorIndex, tumblers, needleOffset) {
      const door = state.vaultDoors[doorIndex];
      if (!door) return;
      door.tumblers = tumblers;
      door.needle = (door.greenCenter + needleOffset + Math.PI * 2) % (Math.PI * 2);
      door.spinning = true;
      state.crackDoor = doorIndex;
      state.prevInteract = true;
    },
    /** Stage the gadget belt (staging / tests): charges left, EMP window, a live cloud. */
    setTools(emp, smoke) { state.player.emp = emp; state.player.smoke = smoke; },
    fireEmp(seconds) { state.empTimer = seconds; for (const c of state.cameras) c.jammed = true; },
    /** Stage one camera's jammed flag (staging / tests): lets a frame show the EMP
     *  window killing some cameras while others still sweep. */
    setCameraJammed(index, jammed) { const c = state.cameras[index]; if (c) c.jammed = jammed; },
    /** Stage the vent-slip duct trail at full brightness (staging / tests). */
    setVentTrail(x1, y1, x2, y2) { state.ventTrail = { x1, y1, x2, y2, life: 1.8 }; },
    dropSmoke(x, y, life) { state.smokeClouds.push({ x, y, life }); },
    /** Swing a vault door open outright (staging / tests). */
    openVault(doorIndex) {
      const door = state.vaultDoors[doorIndex];
      if (!door || door.open) return;
      door.open = true;
      door.tumblers = VAULT.tumblers;
      door.spinning = false;
      state.walls = state.walls.filter((w) => w !== door.blocker);
      if (state.crackDoor === doorIndex) state.crackDoor = -1;
    },
  };
}
