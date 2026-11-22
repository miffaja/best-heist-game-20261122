// Keyboard and mouse input. Held keys give a movement vector; one-shot presses (confirm,
// pause, mute) are queued as bit flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice. The mouse aims the thief's facing and a
// click tosses a distraction coin toward the pointer.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE', 'KeyF']);
const CROUCH = new Set(['KeyC', 'ControlLeft', 'ControlRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(target, toField) {
  const held = { up: false, down: false, left: false, right: false, interact: false, crouch: false, sprint: false };
  let actions = 0;
  let mouse = { x: 640, y: 360, seen: false };
  let toss = null; // {x, y} in field coords, set by a click, taken once by the loop

  function setHeld(event, value) {
    const code = event.code;
    if (UP.has(code)) held.up = value;
    else if (DOWN.has(code)) held.down = value;
    else if (LEFT.has(code)) held.left = value;
    else if (RIGHT.has(code)) held.right = value;
    else if (INTERACT.has(code)) held.interact = value;
    else if (CROUCH.has(code)) held.crouch = value;
    else if (SPRINT.has(code)) held.sprint = value;
    else return false;
    return true;
  }

  window.addEventListener('keydown', (event) => {
    if (setHeld(event, true)) { event.preventDefault(); return; }
    if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (event.code === 'KeyM') { if (!event.repeat) actions |= ACTION_MUTE; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { setHeld(event, false); });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    for (const key of Object.keys(held)) held[key] = false;
  });

  target.addEventListener('pointermove', (event) => {
    const point = toField(event.clientX, event.clientY);
    mouse = { x: point.x, y: point.y, seen: true };
  });
  target.addEventListener('pointerdown', (event) => {
    const point = toField(event.clientX, event.clientY);
    mouse = { x: point.x, y: point.y, seen: true };
    actions |= ACTION_CONFIRM; // a click also starts / restarts from menu screens
    toss = { x: point.x, y: point.y };
  });

  return {
    /** The held-keys snapshot the world steps with: movement vector plus stance flags. */
    snapshot() {
      return {
        mx: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        my: (held.down ? 1 : 0) - (held.up ? 1 : 0),
        interact: held.interact,
        crouch: held.crouch,
        sprint: held.sprint && !held.crouch,
      };
    },
    /** Where the mouse points, in field coordinates (the thief faces it). */
    mouse() { return mouse; },
    /** A pending coin toss from a click, or null; consumed once. */
    takeToss() { const t = toss; toss = null; return t; },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() { const taken = actions; actions = 0; return taken; },
  };
}
