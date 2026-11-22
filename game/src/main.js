// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. Screens: title, play, paused, caught (game over) and the getaway report (win).
// Winning floor 1 unlocks floor 2, the vault annex.
//
// ?seed=N fixes the particle/scan randomness. ?shot=cover|camera|loot|extract (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { LEVELS } from './levels.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_ALARM_UP, EVENT_CAMERA, EVENT_CAUGHT, EVENT_COIN_LAND,
  EVENT_EXTRACTED, EVENT_GUARD_ALERT, EVENT_LASER, EVENT_LOOT,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best haul then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, scene.rating);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.toField);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let rating = null;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startFloor(index) {
    world.loadLevel(index);
    rating = null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Heist started. ${LEVELS[index].name}. Grab loot and reach the van.`);
  }

  function endCaught() {
    screen = SCREEN_OVER;
    audio.setAlarmLevel(0);
    audio.caught();
    announce(`Caught. Haul lost ${world.state.player.haul} dollars.`);
  }

  function endExtracted() {
    screen = SCREEN_WIN;
    rating = world.ghostRating();
    if (world.state.player.haul > best) {
      best = world.state.player.haul;
      saveBest(best);
    }
    audio.setAlarmLevel(0);
    audio.extracted();
    announce(`Clean getaway. Haul ${world.state.player.haul} dollars. Ghost rating ${rating}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) startFloor(0);
      else if (screen === SCREEN_OVER) startFloor(world.state.levelIndex);
      else if (screen === SCREEN_WIN) {
        if (world.state.levelIndex + 1 < LEVELS.length) startFloor(world.state.levelIndex + 1);
        else { world.loadLevel(0); screen = SCREEN_TITLE; }
      } else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; audio.setAlarmLevel(0); announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
  }

  function playEvents(events) {
    if (events & EVENT_LOOT) audio.lootGrab();
    if (events & EVENT_LASER) audio.laserTrip();
    if (events & EVENT_CAMERA) audio.cameraSpot();
    if (events & EVENT_GUARD_ALERT) audio.guardAlert();
    if (events & EVENT_COIN_LAND) audio.coinLand();
    if (events & EVENT_ALARM_UP) audio.guardAlert();
  }

  function step() {
    const snap = input.snapshot();
    const mouse = input.mouse();
    const p = world.state.player;
    const aimAngle = mouse.seen ? Math.atan2(mouse.y - p.y, mouse.x - p.x) : undefined;
    const toss = input.takeToss();
    if (toss) audio.coinToss();
    const events = world.step(STEP, { ...snap, aimAngle, toss });
    playEvents(events);
    if (events & EVENT_CAUGHT) endCaught();
    else if (events & EVENT_EXTRACTED) endExtracted();
    audio.setAlarmLevel(screen === SCREEN_PLAY ? world.state.alarmLevel : 0);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      // Living backdrop: guards patrol behind the title panel; if one somehow catches
      // the idle thief at spawn, quietly reset the floor.
      while (accumulator >= STEP) {
        world.step(STEP, { mx: 0, my: 0, interact: false, crouch: false, sprint: false });
        if (world.state.caught) world.loadLevel(0);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, rating);
  }

  // Leaving the tab pauses a running heist rather than letting guards wander unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.setAlarmLevel(0);
      announce('Paused.');
    }
  });

  announce('Vault Zero. Press Space or click to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
