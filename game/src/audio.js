// WebAudio sound effects, synthesised live — no audio files, no network. A tiny blip
// vocabulary: loot sparkle, camera chirp, laser buzz, the two-tone alarm, the caught sting
// and the extraction jingle. Everything is best-effort: if the browser has no AudioContext
// (or it stays suspended), the game simply plays silent.

export function createAudio() {
  let context = null;
  let muted = false;
  let alarmOsc = null;
  let alarmGain = null;
  let alarmTimer = 0;

  function ensure() {
    if (context) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, seconds, type, volume, slideTo) {
    if (muted || !ensure()) return;
    try {
      if (context.state === 'suspended') context.resume();
      const osc = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + seconds);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      osc.connect(gain).connect(context.destination);
      osc.start(now);
      osc.stop(now + seconds);
    } catch {
      // Sound is decoration; never let it break the game.
    }
  }

  function sequence(notes, stepSeconds, type, volume) {
    notes.forEach((freq, index) => {
      setTimeout(() => tone(freq, stepSeconds * 1.6, type, volume), index * stepSeconds * 1000);
    });
  }

  return {
    /** Call from a user gesture (start click / key) so the context may start. */
    unlock() { ensure(); if (context && context.state === 'suspended') context.resume().catch(() => {}); },
    toggleMute() { muted = !muted; if (muted) this.setAlarmLevel(0); return muted; },
    isMuted() { return muted; },
    lootGrab() { sequence([880, 1174, 1568], 0.07, 'triangle', 0.16); },
    coinToss() { tone(1320, 0.18, 'sine', 0.12, 660); },
    coinLand() { tone(2093, 0.12, 'sine', 0.14); },
    cameraSpot() { tone(1568, 0.1, 'square', 0.08); setTimeout(() => tone(1568, 0.1, 'square', 0.08), 130); },
    laserTrip() { tone(220, 0.3, 'sawtooth', 0.16, 110); },
    guardAlert() { tone(392, 0.16, 'square', 0.12); },
    caught() { sequence([330, 262, 196, 147], 0.16, 'sawtooth', 0.18); },
    extracted() { sequence([523, 659, 784, 1046, 1318], 0.11, 'triangle', 0.18); },
    doorTick() { tone(740, 0.05, 'sine', 0.06); },
    /**
     * The looping two-tone alarm. Level 0 = silent, 1 = suspicious (slow, quiet),
     * 2 = hunted, 3 = lockdown (fast, loud). Driven by the world's alarm meter.
     */
    setAlarmLevel(level) {
      if (muted) level = 0;
      if (level === 0) {
        if (alarmOsc) { try { alarmOsc.stop(); } catch { /* already stopped */ } alarmOsc = null; alarmGain = null; }
        if (alarmTimer) { clearInterval(alarmTimer); alarmTimer = 0; }
        return;
      }
      if (!ensure()) return;
      if (!alarmOsc) {
        try {
          alarmOsc = context.createOscillator();
          alarmGain = context.createGain();
          alarmOsc.type = 'square';
          alarmGain.gain.value = 0.05;
          alarmOsc.connect(alarmGain).connect(context.destination);
          alarmOsc.start();
          let high = false;
          alarmTimer = setInterval(() => {
            if (!alarmOsc) return;
            high = !high;
            alarmOsc.frequency.setValueAtTime(high ? 880 : 659, context.currentTime);
          }, 420);
        } catch { alarmOsc = null; return; }
      }
      if (alarmGain) alarmGain.gain.value = level === 1 ? 0.035 : level === 2 ? 0.06 : 0.085;
    },
  };
}
