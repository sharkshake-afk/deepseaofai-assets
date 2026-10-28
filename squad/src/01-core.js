'use strict';
// ============================================================
//  Helpers, save data, synth audio, input
// ============================================================
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const $ = id => document.getElementById(id);
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : String(Math.floor(n));

// ---------------- save ----------------
const SAVE_KEY = 'squad_surge_save_v1';
function defaultSave() {
  return {
    v: 1, coins: 0, stage: 1, stars: {}, endless: 0, daily: { date: '', best: 0 }, hq: {},
    stats: { runs: 0, kills: 0, bosses: 0, maxSquad: 0 },
    settings: { sound: true, music: true, haptics: true, shake: true, quality: 'high' }, tutorial: false,
  };
}
const save = (() => {
  const d = defaultSave();
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s) for (const k in d) { if (s[k] === undefined) continue; if (d[k] && typeof d[k] === 'object') d[k] = Object.assign(d[k], s[k]); else d[k] = s[k]; }
  } catch (e) { }
  return d;
})();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }
function haptic(p) { if (!save.settings.haptics) return; try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } }

// ---------------- audio ----------------
const Sound = (() => {
  let ctx = null, master, sfx, music, noiseBuf, step = 0, nextT = 0, intensity = 0, lastShot = 0, playing = false;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master); music = ctx.createGain(); music.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    apply();
  }
  function apply() { if (!ctx) return; sfx.gain.value = save.settings.sound ? 1 : 0; music.gain.value = save.settings.music ? 0.55 : 0; }
  const ok = () => ctx && ctx.state === 'running';
  function env(g, t, a, v, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(f, dur, type = 'square', vol = 0.1, slide = 0, delay = 0, bus) {
    if (!ok()) return; const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    env(g, t, 0.005, vol, dur); o.connect(g); g.connect(bus || sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, f0, f1, vol = 0.2, type = 'bandpass', q = 1, delay = 0, bus) {
    if (!ok()) return; const t = ctx.currentTime + delay, s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain(); env(g, t, 0.003, vol, dur); s.connect(f); f.connect(g); g.connect(bus || sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const BASS = [0, 0, 7, 0, 3, 0, 10, 7, 0, 0, 7, 0, 5, 3, 2, 3];
  return {
    init, apply, get ready() { return ok(); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }, resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setMusic(on, lvl = 0) { playing = on; intensity = lvl; },
    tick() {
      if (!ok() || !playing || !save.settings.music) return;
      const now = ctx.currentTime; if (nextT < now) nextT = now + 0.05;
      const spb = 60 / (intensity >= 2 ? 150 : 132) / 4;
      while (nextT < now + 0.2) {
        const s = step % 16, t0 = nextT - now;
        if (s % 4 === 0) { tone(110, 0.16, 'sine', 0.5, 40, t0, music); }
        if (s % 8 === 4) noise(0.14, 2200, 900, 0.22, 'bandpass', 0.8, t0, music);
        if (s % 2 === 1 || intensity >= 1) noise(0.04, 9000, 7000, intensity >= 1 ? 0.07 : 0.05, 'highpass', 1, t0, music);
        const root = intensity >= 2 ? 41.2 : 55, f = root * Math.pow(2, BASS[s] / 12);
        if (s % 2 === 0 || intensity >= 1) tone(f, spb * 1.6, 'sawtooth', intensity >= 1 ? 0.07 : 0.05, 0, t0, music);
        if (intensity >= 1 && s % 4 === 2) tone(f * 4, 0.08, 'square', 0.025, 0, t0, music);
        step++; nextT += spb;
      }
    },
    shot(tier) {
      const now = performance.now(); if (now - lastShot < 55) return; lastShot = now;
      if (tier >= 5) { tone(rnd(900, 1100), 0.09, 'sawtooth', 0.04, 200); return; }
      noise(0.06 + tier * 0.01, 3000 - tier * 300, 500, 0.11, 'bandpass', 0.7); tone(140 - tier * 10, 0.05, 'square', 0.04, 60);
    },
    hit() { noise(0.04, 1200, 600, 0.05, 'bandpass', 2); },
    zdie() { noise(0.12, 600, 200, 0.06, 'lowpass', 1); },
    lose() { tone(220, 0.08, 'square', 0.06, 160); },
    boom(big) { noise(big ? 1 : 0.5, 900, 40, big ? 0.55 : 0.35, 'lowpass', 0.7); tone(60, big ? 0.8 : 0.4, 'sine', 0.4, 25); },
    gateGood(mult) { [523, 659, 784, 1047].slice(0, mult ? 4 : 3).forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, 0, i * 0.05)); },
    gateBad() { [400, 300, 200].forEach((f, i) => tone(f, 0.2, 'sawtooth', 0.07, 0, i * 0.07)); },
    tick2() { tone(1400, 0.03, 'square', 0.03); },
    crate() { noise(0.25, 1500, 300, 0.25, 'bandpass', 0.6); tone(330, 0.1, 'triangle', 0.08, 660, 0.05); },
    coin() { tone(1318, 0.08, 'square', 0.04); tone(1760, 0.12, 'square', 0.04, 0, 0.06); },
    roar() { tone(80, 1.4, 'sawtooth', 0.25, 40); noise(1.2, 500, 80, 0.3, 'lowpass', 1); },
    jet() { noise(1.5, 300, 4000, 0.25, 'bandpass', 0.5); },
    shield() { tone(300, 0.6, 'sine', 0.15, 900); tone(450, 0.6, 'sine', 0.1, 1350, 0.05); },
    warn() { tone(880, 0.1, 'square', 0.06); tone(880, 0.1, 'square', 0.06, 0, 0.15); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.5, 'triangle', 0.12, 0, i * 0.1)); },
    fail() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.08, 0, i * 0.15)); },
    click() { tone(900, 0.04, 'square', 0.04); },
    upgrade() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.2, 'square', 0.05, 0, i * 0.05)); },
  };
})();

// ---------------- input: relative horizontal drag ----------------
const Input = { dx: 0, keyX: 0, active: false, id: null, lastX: 0, keys: {} };
(function () {
  const cv = $('c');
  cv.addEventListener('pointerdown', e => { e.preventDefault(); Sound.init(); if (Input.id !== null) return; Input.id = e.pointerId; Input.lastX = e.clientX; Input.active = true; try { cv.setPointerCapture(e.pointerId); } catch (_) { } }, { passive: false });
  cv.addEventListener('pointermove', e => { if (e.pointerId !== Input.id) return; Input.dx += e.clientX - Input.lastX; Input.lastX = e.clientX; });
  const up = e => { if (e.pointerId !== Input.id) return; Input.id = null; Input.active = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  window.addEventListener('keydown', e => { Input.keys[e.code] = true; Sound.init(); });
  window.addEventListener('keyup', e => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => { Input.keys = {}; Input.id = null; });
})();
