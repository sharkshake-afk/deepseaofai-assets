'use strict';
// ============================================================
//  Core helpers, save data, audio synth, input
// ============================================================
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const $ = id => document.getElementById(id);
const M_PER_UNIT = 0.1; // 10 world units = 1 metre
const toM = y => Math.max(0, Math.floor(y * M_PER_UNIT));

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hash2(a, b) { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function makeNoise(rng) {
  const N = 1024, p = new Float32Array(N);
  for (let i = 0; i < N; i++) p[i] = rng() * 2 - 1;
  return x => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    const a = p[((i % N) + N) % N], b = p[(((i + 1) % N) + N) % N];
    return a + (b - a) * u;
  };
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixHex(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; }
function rgbaHex(h, a) { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fmtTime(s) { s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

// ------------------------------------------------------------
//  Save
// ------------------------------------------------------------
const SAVE_KEY = 'lumen_deepsea_save_v1';
function defaultSave() {
  return {
    v: 1, pearls: 0, best: 0, bestZen: 0,
    daily: { date: '', best: 0, runs: 0 },
    meta: {}, codex: {}, lore: {}, ach: {}, bosses: {},
    stats: { runs: 0, eaten: 0, pearlsTotal: 0, deaths: 0, time: 0, zenTime: 0 },
    settings: { sound: true, music: true, haptics: true, quality: 'high', lefty: false, shake: true },
    tutorial: false,
  };
}
function loadSave() {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return d;
    const s = JSON.parse(raw);
    for (const k in d) {
      if (s[k] === undefined) continue;
      if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) d[k] = Object.assign(d[k], s[k]);
      else d[k] = s[k];
    }
  } catch (e) { /* storage unavailable: play with defaults */ }
  return d;
}
const save = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }

function haptic(p) {
  if (!save.settings.haptics) return;
  try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { }
}

// ------------------------------------------------------------
//  Audio: everything synthesized, no files needed
// ------------------------------------------------------------
const Sound = (() => {
  let ctx = null, master, musicBus, sfxBus, revIn, drones = [], droneFilter, noiseGain, plinkTimer = 0;
  let zoneIdx = -1, bossOn = false, bossStep = 0, bossNext = 0, heartT = 0, lastEat = 0;
  const CHORDS = [ // root-relative chords per zone (Hz)
    [110, 164.81, 220, 277.18], [98, 146.83, 196, 233.08], [82.41, 123.47, 164.81, 196],
    [73.42, 110, 146.83, 174.61], [65.41, 98, 130.81, 155.56], [55, 82.41, 110, 130.81],
  ];
  const SCALES = [
    [440, 493.88, 554.37, 659.25, 739.99, 880], [392, 440, 466.16, 587.33, 698.46, 783.99],
    [329.63, 392, 440, 493.88, 587.33, 659.25], [293.66, 349.23, 392, 440, 523.25, 587.33],
    [261.63, 311.13, 349.23, 392, 466.16, 523.25], [220, 261.63, 293.66, 329.63, 392, 440],
  ];
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    // generated reverb impulse
    const conv = ctx.createConvolver();
    const len = ctx.sampleRate * 3.2, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    conv.buffer = buf;
    revIn = ctx.createGain(); revIn.gain.value = 0.55;
    revIn.connect(conv); conv.connect(master);
    // drone pad
    droneFilter = ctx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 700; droneFilter.Q.value = 2;
    const padGain = ctx.createGain(); padGain.gain.value = 0.11;
    droneFilter.connect(padGain); padGain.connect(musicBus); padGain.connect(revIn);
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 260; lfo.connect(lfoG); lfoG.connect(droneFilter.frequency); lfo.start();
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = CHORDS[0][i]; o.detune.value = (i - 1.5) * 6;
      const g = ctx.createGain(); g.gain.value = i === 0 ? 0.5 : 0.28;
      o.connect(g); g.connect(droneFilter); o.start(); drones.push(o);
    }
    // ocean rumble
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
    let last = 0; for (let i = 0; i < nd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; nd[i] = last * 3.5; }
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 380;
    noiseGain = ctx.createGain(); noiseGain.gain.value = 0.22;
    ns.connect(nf); nf.connect(noiseGain); noiseGain.connect(musicBus); ns.start();
    applySettings();
  }
  function applySettings() {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicBus.gain.setTargetAtTime(save.settings.music ? 1 : 0, t, 0.3);
    sfxBus.gain.setTargetAtTime(save.settings.sound ? 1 : 0, t, 0.05);
  }
  function setZone(i) {
    if (!ctx || i === zoneIdx) return;
    zoneIdx = i; const ch = CHORDS[Math.min(i, CHORDS.length - 1)], t = ctx.currentTime;
    drones.forEach((o, k) => o.frequency.setTargetAtTime(ch[k], t, 2.5));
  }
  function setDepth(m) {
    if (!ctx || !Number.isFinite(m)) return;
    const f = clamp(900 - m * 0.12, 180, 900);
    droneFilter.frequency.setTargetAtTime(f, ctx.currentTime, 1);
  }
  function env(node, t, a, peak, d) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(f, dur, type = 'sine', vol = 0.2, slide = 0, rev = 0.25, delay = 0, bus) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    env(g, t, 0.008, vol, dur);
    o.connect(g); g.connect(bus || sfxBus);
    if (rev) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(revIn); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, f0, f1, vol = 0.2, q = 1, delay = 0) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + delay, len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain(); env(g, t, 0.01, vol, dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t);
  }
  const api = {
    init, applySettings, setZone, setDepth,
    get ready() { return !!ctx && ctx.state === 'running'; },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    tick(dt, game) {
      if (!ctx || ctx.state !== 'running') return;
      plinkTimer -= dt;
      if (plinkTimer <= 0 && save.settings.music) {
        plinkTimer = rnd(1.4, 4.2) * (bossOn ? 3 : 1);
        const sc = SCALES[Math.max(0, Math.min(zoneIdx, SCALES.length - 1))];
        const f = pick(sc) * (Math.random() < 0.3 ? 0.5 : 1);
        tone(f, 2.6, 'sine', 0.05, 0, 0.9, 0, musicBus);
        if (Math.random() < 0.35) tone(f * 1.5, 2.2, 'sine', 0.025, 0, 0.9, 0.18, musicBus);
      }
      if (bossOn && save.settings.music) {
        const now = ctx.currentTime;
        if (bossNext < now) bossNext = now + 0.05;
        while (bossNext < now + 0.2) {
          const pat = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1];
          const root = CHORDS[Math.min(zoneIdx, 5)][0] / 2;
          if (pat[bossStep % 16]) {
            const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
            o.type = 'sawtooth'; o.frequency.value = root * (bossStep % 32 >= 24 ? 1.189 : 1);
            f.type = 'lowpass'; f.frequency.setValueAtTime(900, bossNext); f.frequency.exponentialRampToValueAtTime(120, bossNext + 0.18);
            env(g, bossNext, 0.005, 0.16, 0.2);
            o.connect(f); f.connect(g); g.connect(musicBus); o.start(bossNext); o.stop(bossNext + 0.25);
          }
          if (bossStep % 4 === 0) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.frequency.setValueAtTime(120, bossNext); o.frequency.exponentialRampToValueAtTime(40, bossNext + 0.15);
            env(g, bossNext, 0.003, 0.35, 0.18); o.connect(g); g.connect(musicBus); o.start(bossNext); o.stop(bossNext + 0.2);
          }
          bossStep++; bossNext += 60 / 128 / 4;
        }
      }
      if (game && game.player && !game.over) {
        const frac = game.player.light / game.player.maxLight;
        if (frac < 0.25 && !game.zen) {
          heartT -= dt;
          if (heartT <= 0) { heartT = 0.55 + frac * 2.4; tone(62, 0.18, 'sine', 0.32, 40, 0); tone(58, 0.16, 'sine', 0.24, 38, 0, 0.17); }
        }
      }
    },
    boss(on) { bossOn = on; bossStep = 0; if (ctx) bossNext = ctx.currentTime + 0.1; },
    eat(combo) {
      const now = performance.now(); if (now - lastEat < 35) return; lastEat = now;
      const f = 520 * Math.pow(1.059463, Math.min(combo, 24));
      tone(f, 0.12, 'sine', 0.16, f * 1.6, 0.2);
    },
    plankton() { const now = performance.now(); if (now - lastEat < 45) return; lastEat = now; tone(rnd(1300, 1700), 0.06, 'sine', 0.045, 0, 0.3); },
    pearl() { [1318, 1760, 2637].forEach((f, i) => tone(f, 0.5, 'sine', 0.1, 0, 0.6, i * 0.06)); },
    dash() { noise(0.32, 2400, 300, 0.22, 0.8); tone(200, 0.18, 'triangle', 0.08, 90, 0); },
    sonar() { tone(1450, 1.4, 'sine', 0.2, 900, 1); tone(725, 1.2, 'sine', 0.08, 450, 1, 0.05); },
    hurt() { tone(140, 0.3, 'sawtooth', 0.2, 50, 0.1); noise(0.2, 800, 200, 0.25, 0.6); },
    bite() { noise(0.09, 1800, 600, 0.18, 1.5); },
    hit() { tone(260, 0.12, 'square', 0.08, 110, 0.15); noise(0.1, 1500, 400, 0.15); },
    kill() { tone(330, 0.25, 'triangle', 0.12, 660, 0.4); noise(0.2, 3000, 800, 0.08); },
    zap() { noise(0.12, 5000, 2000, 0.1, 3); tone(1800, 0.08, 'square', 0.03, 600, 0); },
    levelup() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.6, 'triangle', 0.1, 0, 0.6, i * 0.07)); },
    pick() { tone(880, 0.15, 'sine', 0.12, 1320, 0.4); },
    shard() { [440, 554, 659, 880, 1108].forEach((f, i) => tone(f, 1.2, 'sine', 0.07, 0, 0.9, i * 0.11)); },
    zone() { tone(220, 3, 'sine', 0.12, 0, 0.9); tone(330, 3, 'sine', 0.08, 0, 0.9, 0.3); tone(440, 3, 'sine', 0.06, 0, 0.9, 0.6); },
    roar() { tone(70, 1.8, 'sawtooth', 0.28, 35, 0.6); noise(1.6, 400, 60, 0.35, 0.5); },
    warn() { tone(600, 0.14, 'square', 0.07, 0, 0.1); tone(600, 0.14, 'square', 0.07, 0, 0.1, 0.22); },
    laser() { tone(90, 0.6, 'sawtooth', 0.12, 160, 0.2); noise(0.6, 600, 2400, 0.08, 4); },
    die() { tone(440, 1.6, 'triangle', 0.18, 55, 0.8); noise(1.2, 1200, 80, 0.2, 0.5); },
    victory() { [392, 523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => tone(f, 1.6, 'triangle', 0.1, 0, 0.8, i * 0.12)); },
    click() { tone(1200, 0.05, 'sine', 0.06, 900, 0.1); },
  };
  return api;
})();

// ------------------------------------------------------------
//  Input: floating joystick on any touch, tap = dash
// ------------------------------------------------------------
const Input = {
  x: 0, y: 0, mag: 0, dash: false, sonar: false,
  joy: null, keys: {}, autopilot: false,
  consume() { const d = this.dash, s = this.sonar; this.dash = false; this.sonar = false; return { d, s }; },
};
(function setupInput() {
  const canvas = $('c');
  const JOY_R = 56;
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    Sound.init();
    if (Input.joy) { Input.dash = true; return; } // second finger = dash
    Input.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0 };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
  }, { passive: false });
  canvas.addEventListener('pointermove', e => {
    const j = Input.joy; if (!j || j.id !== e.pointerId) return;
    j.x = e.clientX; j.y = e.clientY;
    let dx = j.x - j.ox, dy = j.y - j.oy, d = Math.hypot(dx, dy);
    j.moved = Math.max(j.moved, d);
    if (d > JOY_R * 1.6) { // drag the origin along so direction changes stay snappy
      const k = (d - JOY_R * 1.6) / d; j.ox += dx * k; j.oy += dy * k;
      dx = j.x - j.ox; dy = j.y - j.oy; d = Math.hypot(dx, dy);
    }
  });
  const end = e => {
    const j = Input.joy; if (!j || j.id !== e.pointerId) return;
    if (performance.now() - j.t0 < 220 && j.moved < 14) Input.dash = true;
    Input.joy = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  window.addEventListener('keydown', e => {
    Input.keys[e.code] = true;
    if (e.code === 'Space') { Input.dash = true; e.preventDefault(); }
    if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') Input.sonar = true;
    Sound.init();
  });
  window.addEventListener('keyup', e => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => { Input.keys = {}; Input.joy = null; });
  Input.update = function () {
    const k = this.keys;
    let kx = (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0);
    let ky = (k.ArrowDown || k.KeyS ? 1 : 0) - (k.ArrowUp || k.KeyW ? 1 : 0);
    if (kx || ky) { const l = Math.hypot(kx, ky); this.x = kx / l; this.y = ky / l; this.mag = 1; return; }
    const j = this.joy;
    if (j) {
      const dx = j.x - j.ox, dy = j.y - j.oy, d = Math.hypot(dx, dy);
      if (d > 4) { this.x = dx / d; this.y = dy / d; this.mag = clamp(d / JOY_R, 0, 1); }
      else this.mag = 0;
    } else this.mag = 0;
  };
})();
