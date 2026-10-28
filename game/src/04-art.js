// ============================================================
//  Procedural art: glow sprites, creatures, player
//  Creatures are drawn in local space: radius 10, facing +x.
// ============================================================
const glowCache = new Map();
function glowSprite(color) {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 96;
  const g = c.getContext('2d'), gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  gr.addColorStop(0, rgbaHex(color, 1)); gr.addColorStop(0.18, rgbaHex(color, 0.6));
  gr.addColorStop(0.45, rgbaHex(color, 0.18)); gr.addColorStop(1, rgbaHex(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
  glowCache.set(color, c); return c;
}
const LIGHT_SPRITE = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c;
})();
function glow(ctx, x, y, r, color, a = 1) {
  if (a <= 0.01 || r <= 0.5) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
}
function dot(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

function fishShape(ctx, L, H, wag) {
  ctx.beginPath();
  ctx.moveTo(L, 0);
  ctx.bezierCurveTo(L * 0.6, -H * 1.15, -L * 0.4, -H * 0.95, -L * 0.82, -H * 0.2 + wag * 0.3);
  ctx.lineTo(-L * 0.82, H * 0.2 + wag * 0.3);
  ctx.bezierCurveTo(-L * 0.4, H * 0.95, L * 0.6, H * 1.15, L, 0);
  ctx.closePath(); ctx.fill();
  const tx = -L * 0.78, ty = wag * 0.3;
  ctx.beginPath(); ctx.moveTo(tx, ty);
  ctx.lineTo(tx - L * 0.5, ty - H * 1.0 + wag);
  ctx.quadraticCurveTo(tx - L * 0.28, ty + wag * 0.6, tx - L * 0.5, ty + H * 1.0 + wag);
  ctx.closePath(); ctx.fill();
}
function eyeColor(c) { return c.edible ? '#7dffb2' : c.threat ? '#ff4a5a' : '#ffe9a8'; }

const ART = {
  sardine: {
    body(ctx, c, t) {
      const wag = Math.sin(t * 14 + c.ph) * 2.2;
      const g = ctx.createLinearGradient(0, -5, 0, 5); g.addColorStop(0, '#2f5d78'); g.addColorStop(0.45, '#a9d6ea'); g.addColorStop(1, '#eaf7ff');
      ctx.fillStyle = g; fishShape(ctx, 12, 4.4, wag);
    },
    emit(ctx, c) { dot(ctx, 7.5, -1.2, 1.3, eyeColor(c)); },
  },
  lantern: {
    body(ctx, c, t) { const wag = Math.sin(t * 12 + c.ph) * 2; ctx.fillStyle = '#1f3850'; fishShape(ctx, 11, 4.8, wag); },
    emit(ctx, c, t) {
      for (let i = 0; i < 5; i++) { const x = 6 - i * 3.2; glow(ctx, x, 3.2, 3.2, '#7ff3ff', 0.9); dot(ctx, x, 3.2, 0.8, '#e6ffff'); }
      ctx.globalAlpha = 1; dot(ctx, 7, -1.4, 1.8, eyeColor(c));
    },
  },
  hatchet: {
    body(ctx, c, t) {
      const wag = Math.sin(t * 10 + c.ph) * 1.6;
      const g = ctx.createLinearGradient(0, -7, 0, 9); g.addColorStop(0, '#3d4a63'); g.addColorStop(0.5, '#c7d6ec'); g.addColorStop(1, '#8fa6c4');
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(9, -1); ctx.quadraticCurveTo(4, -8, -4, -6.5); ctx.lineTo(-7, -2 + wag * 0.2);
      ctx.lineTo(-12, -5 + wag); ctx.lineTo(-11, 3 + wag); ctx.lineTo(-7, 2 + wag * 0.2);
      ctx.quadraticCurveTo(-1, 10, 6, 5); ctx.closePath(); ctx.fill();
    },
    emit(ctx, c) { for (let i = 0; i < 4; i++) glow(ctx, 3 - i * 2.6, 5.5 - i * 0.6, 2.6, '#a6c8ff', 0.8); ctx.globalAlpha = 1; dot(ctx, 5, -2.5, 2.2, eyeColor(c)); },
  },
  shrimp: {
    body(ctx, c, t) {
      ctx.fillStyle = 'rgba(159,232,212,0.55)';
      const k = Math.sin(t * 8 + c.ph) * 0.15;
      for (let i = 0; i < 5; i++) { const a = -0.5 + i * 0.32 + k; ctx.beginPath(); ctx.ellipse(8 - i * 4.2, Math.sin(a) * 3, 3.6, 3.2 - i * 0.3, a, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(200,255,240,0.5)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(10, -1); ctx.quadraticCurveTo(20, -8 + k * 10, 26, -3); ctx.moveTo(10, 0); ctx.quadraticCurveTo(18, 6, 25, 4 + k * 8); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(6 - i * 3, 2.5); ctx.lineTo(5 - i * 3 + Math.sin(t * 20 + i) * 1.5, 6.5); ctx.stroke(); }
    },
    emit(ctx, c) { glow(ctx, 2, 0, 9, '#8fffd2', 0.5); ctx.globalAlpha = 1; dot(ctx, 10, -1.5, 1.1, eyeColor(c)); },
  },
  jelly: {
    upright: true,
    body(ctx, c, t) {
      const p = Math.sin(t * 2.4 + c.ph), sx = 1 + p * 0.12, sy = 1 - p * 0.1;
      ctx.strokeStyle = 'rgba(210,180,255,0.45)'; ctx.lineWidth = 0.9;
      for (let i = 0; i < 6; i++) {
        const bx = -7 + i * 2.8; ctx.beginPath(); ctx.moveTo(bx * sx, 1);
        for (let s = 1; s <= 6; s++) ctx.lineTo(bx * sx + Math.sin(t * 3 + i + s * 0.8 + c.ph) * (1 + s * 0.5), 1 + s * 4.2);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(199,155,255,0.38)'; ctx.beginPath();
      ctx.ellipse(0, 0, 10 * sx, 9 * sy, 0, Math.PI, TAU); ctx.quadraticCurveTo(0, 3, -10 * sx, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(230,210,255,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
    },
    emit(ctx, c, t) {
      const p = 0.6 + 0.4 * Math.sin(t * 2.4 + c.ph);
      glow(ctx, 0, -3, 16, '#c99bff', 0.55 * p);
      for (let i = 0; i < 4; i++) glow(ctx, -4.5 + i * 3, -3.5, 2.5, '#f0d8ff', 0.8 * p);
      ctx.globalAlpha = 1;
    },
  },
  barracuda: {
    body(ctx, c, t) {
      const wag = Math.sin(t * 9 + c.ph) * 1.4;
      const g = ctx.createLinearGradient(0, -4, 0, 4); g.addColorStop(0, '#34444f'); g.addColorStop(0.5, '#90aab8'); g.addColorStop(1, '#d6e4ea');
      ctx.fillStyle = g; fishShape(ctx, 16, 3.4, wag);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5; ctx.beginPath();
      for (let i = 0; i < 5; i++) { ctx.moveTo(15 - i * 1.4, 0.6); ctx.lineTo(14.4 - i * 1.4, 1.6); }
      ctx.stroke();
      if (c.st === 1) { ctx.strokeStyle = 'rgba(255,74,90,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 14 + Math.sin(t * 40) * 1.5, 0, TAU); ctx.stroke(); }
    },
    emit(ctx, c, t) { dot(ctx, 11, -1, 1.4, c.st === 1 ? (Math.sin(t * 30) > 0 ? '#fff' : '#ff4a5a') : eyeColor(c)); },
  },
  angler: {
    body(ctx, c, t) {
      const m = 0.25 + 0.2 * Math.sin(t * 1.5 + c.ph) + (c.st === 1 ? 0.5 : 0);
      ctx.fillStyle = '#2a1c22'; ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-15, -5 + Math.sin(t * 5) * 1.5); ctx.lineTo(-15, 5 + Math.sin(t * 5) * 1.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.moveTo(10, -1); ctx.lineTo(2, 1.5); ctx.lineTo(10, 1 + m * 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#efe6d8';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(9 - i * 1.8, -0.6 + i * 0.6); ctx.lineTo(8.4 - i * 1.8, 2.5 + i * 0.6); ctx.lineTo(7.8 - i * 1.8, -0.2 + i * 0.6); ctx.fill(); }
      ctx.strokeStyle = '#3d2a30'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(2, -8.5);
      ctx.quadraticCurveTo(10, -18, 15 + Math.sin(t * 2) * 1.5, -9); ctx.stroke();
    },
    emit(ctx, c, t) {
      const lx = 15 + Math.sin(t * 2) * 1.5, ly = -9, p = 0.75 + 0.25 * Math.sin(t * 3 + c.ph);
      glow(ctx, lx, ly, 14, '#fff1a6', p); ctx.globalAlpha = 1; dot(ctx, lx, ly, 1.6, '#fffbe0');
      dot(ctx, 4, -4, 1.3, eyeColor(c));
    },
  },
  viper: {
    body(ctx, c, t) {
      const wag = Math.sin(t * 11 + c.ph) * 1.8;
      ctx.fillStyle = '#1a2440'; fishShape(ctx, 14, 3.8, wag);
      ctx.strokeStyle = '#e8eef8'; ctx.lineWidth = 0.7; ctx.beginPath();
      ctx.moveTo(12, 1.5); ctx.quadraticCurveTo(14, -2, 11.5, -5.5); ctx.moveTo(10, 1.8); ctx.quadraticCurveTo(12, -1, 9.6, -4.4);
      ctx.moveTo(13, -0.8); ctx.lineTo(14, 3.4); ctx.stroke();
    },
    emit(ctx, c) {
      for (let i = 0; i < 6; i++) glow(ctx, 7 - i * 3, 3, 2.4, '#8ab4ff', 0.85);
      ctx.globalAlpha = 1; dot(ctx, 9.5, -1.6, 1.6, eyeColor(c));
    },
  },
  dumbo: {
    upright: true,
    body(ctx, c, t) {
      const f = Math.sin(t * 5 + c.ph);
      ctx.fillStyle = '#e88a6c';
      ctx.save(); ctx.translate(-7, -5); ctx.rotate(-0.5 + f * 0.5); ctx.beginPath(); ctx.ellipse(-3, 0, 5, 2.6, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(7, -5); ctx.rotate(0.5 - f * 0.5); ctx.beginPath(); ctx.ellipse(3, 0, 5, 2.6, 0, 0, TAU); ctx.fill(); ctx.restore();
      const g = ctx.createRadialGradient(-2, -4, 1, 0, 0, 11); g.addColorStop(0, '#ffd0b8'); g.addColorStop(1, '#ff8a68');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -2, 8, 9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,150,120,.75)'; ctx.beginPath(); ctx.moveTo(-8, 3);
      for (let i = 0; i <= 8; i++) ctx.lineTo(-8 + i * 2, 8 + (i % 2 ? 4 : 0) + Math.sin(t * 4 + i) * 1.2);
      ctx.lineTo(8, 3); ctx.closePath(); ctx.fill();
    },
    emit(ctx, c) { glow(ctx, 0, -2, 18, '#ffcf9a', 0.35); ctx.globalAlpha = 1; dot(ctx, -3, 0, 1.4, eyeColor(c)); dot(ctx, 3, 0, 1.4, eyeColor(c)); },
  },
  gulper: {
    body(ctx, c, t) {
      const open = 0.35 + 0.35 * Math.sin(t * 2 + c.ph) + (c.st === 1 ? 0.5 : 0);
      ctx.strokeStyle = '#170f1d'; ctx.lineCap = 'round';
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-2, 0);
      for (let i = 1; i <= 8; i++) ctx.lineTo(-2 - i * 4.5, Math.sin(t * 5 + c.ph - i * 0.6) * i * 0.7);
      ctx.stroke();
      ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-36, Math.sin(t * 5 + c.ph - 8 * 0.6) * 5.6);
      for (let i = 9; i <= 14; i++) ctx.lineTo(-2 - i * 4.5, Math.sin(t * 5 + c.ph - i * 0.6) * i * 0.7);
      ctx.stroke();
      ctx.fillStyle = '#20142a'; ctx.beginPath();
      ctx.moveTo(-4, -3); ctx.lineTo(13, -7 - open * 5); ctx.lineTo(13, -5 - open * 4); ctx.lineTo(1, 0);
      ctx.lineTo(13, 5 + open * 4); ctx.lineTo(13, 7 + open * 5); ctx.lineTo(-4, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(80,20,60,.5)'; ctx.beginPath(); ctx.moveTo(12, -5 - open * 4); ctx.lineTo(1, 0); ctx.lineTo(12, 5 + open * 4); ctx.closePath(); ctx.fill();
    },
    emit(ctx, c, t) {
      const i = 14, tx = -2 - i * 4.5, ty = Math.sin(t * 5 + c.ph - i * 0.6) * i * 0.7;
      glow(ctx, tx, ty, 9, '#ff7ad9', 0.9 + 0.1 * Math.sin(t * 9)); ctx.globalAlpha = 1;
      dot(ctx, 0, -2.5, 1.2, eyeColor(c));
    },
  },
  vampire: {
    body(ctx, c, t) {
      const f = Math.sin(t * 6 + c.ph);
      ctx.fillStyle = '#5a0f1f'; ctx.beginPath(); ctx.ellipse(3, 0, 8, 5.2, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(8, -5, 3, 1.4, -0.6 + f * 0.4, 0, TAU); ctx.ellipse(8, 5, 3, 1.4, 0.6 - f * 0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(120,20,40,.85)'; ctx.beginPath(); ctx.moveTo(-3, -5);
      for (let i = 0; i <= 6; i++) ctx.lineTo(-10 - (i % 2 ? 3 : 0) + f * 1.5, -5 + i * 1.66);
      ctx.lineTo(-3, 5); ctx.closePath(); ctx.fill();
    },
    emit(ctx, c) { glow(ctx, 9, -4, 4, '#5fb3ff', 0.9); glow(ctx, 9, 4, 4, '#5fb3ff', 0.9); ctx.globalAlpha = 1; dot(ctx, 0, -2, 1.8, eyeColor(c)); },
  },
  sentinel: {
    body(ctx, c, t) {
      ctx.fillStyle = '#3a4452'; ctx.strokeStyle = '#7d8a9c'; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.52; ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0b0e14'; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,59,92,.4)'; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke();
    },
    emit(ctx, c, t) {
      const ex = Math.sin(t * 3 + c.ph) * 2.5, charge = c.st === 1 ? 1 : 0;
      glow(ctx, ex, 0, 9 + charge * 6, '#ff3b5c', 0.9); ctx.globalAlpha = 1; dot(ctx, ex, 0, 2.2, '#ffd0d8');
      for (let i = 0; i < 3; i++) { const a = Math.PI + (i - 1) * 0.7; glow(ctx, Math.cos(a) * 11, Math.sin(a) * 11, 3 + Math.random() * 2, '#5fd0ff', 0.7); }
    },
  },
  isopod: {
    body(ctx, c, t) {
      ctx.strokeStyle = '#8d7d70'; ctx.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(6 - i * 2.6, 5); ctx.lineTo(6 - i * 2.6 + Math.sin(t * 9 + i) * 1.4, 8.5); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(10, -1); ctx.quadraticCurveTo(16, -5, 18, -2); ctx.stroke();
      const g = ctx.createLinearGradient(0, -7, 0, 6); g.addColorStop(0, '#d7c7b8'); g.addColorStop(1, '#7c6c60');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 11, 6.5, 0, Math.PI, TAU); ctx.lineTo(11, 3); ctx.quadraticCurveTo(0, 6, -11, 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(70,55,48,.7)'; ctx.beginPath(); for (let i = 0; i < 6; i++) { const x = -8 + i * 3.2; ctx.moveTo(x, -Math.sqrt(Math.max(0, 1 - (x / 11) ** 2)) * 6.4); ctx.lineTo(x, 4.5); } ctx.stroke();
    },
    emit(ctx, c) { dot(ctx, 9, -1.5, 1.1, eyeColor(c)); },
  },
  wraith: {
    body(ctx, c, t) {
      const wag = Math.sin(t * 13 + c.ph) * 2;
      ctx.fillStyle = '#0d1a12'; fishShape(ctx, 13, 4.5, wag);
      if (Math.random() < 0.35) { ctx.fillStyle = 'rgba(198,255,77,.25)'; ctx.save(); ctx.translate(rnd(-3, 3), rnd(-2, 2)); fishShape(ctx, 13, 4.5, wag); ctx.restore(); }
    },
    emit(ctx, c, t) {
      ctx.globalAlpha = 0.7; ctx.fillStyle = '#c6ff4d';
      for (let i = 0; i < 4; i++) { const y = -3 + ((t * 9 + i * 2) % 6); ctx.fillRect(-9 + (i * 5) % 14, y, 6, 0.5); }
      glow(ctx, 8, -1.5, 6, '#c6ff4d', 0.9); ctx.globalAlpha = 1; dot(ctx, 8, -1.5, 1.5, eyeColor(c));
    },
  },
  squidling: {
    body(ctx, c, t) {
      ctx.fillStyle = '#8a3020'; ctx.beginPath(); ctx.ellipse(4, 0, 7, 4, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8a3020'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-2, -2 + i); ctx.quadraticCurveTo(-8, -3 + i * 1.5 + Math.sin(t * 9 + i) * 2, -14, -4 + i * 2 + Math.sin(t * 7 + i) * 2.5); ctx.stroke(); }
    },
    emit(ctx, c) { glow(ctx, 2, -1.5, 5, '#ff8a5c', 0.8); ctx.globalAlpha = 1; dot(ctx, 2, -1.5, 1.4, eyeColor(c)); },
  },
};

// ---------- player: LUMEN ----------
function drawPlayerBody(ctx, P, t) {
  const wag = Math.sin(t * (6 + P.spd * 0.04)) * 2;
  const finA = Math.sin(t * 7) * 0.35;
  // fins
  ctx.fillStyle = 'rgba(80,220,240,0.55)';
  ctx.beginPath(); ctx.moveTo(2, -6); ctx.quadraticCurveTo(-3, -14 - finA * 6, -8, -11 - finA * 4); ctx.quadraticCurveTo(-4, -7, -4, -5); ctx.fill();
  ctx.beginPath(); ctx.moveTo(2, 6); ctx.quadraticCurveTo(-3, 14 + finA * 6, -8, 11 + finA * 4); ctx.quadraticCurveTo(-4, 7, -4, 5); ctx.fill();
  // tail
  ctx.fillStyle = 'rgba(111,247,255,0.6)';
  ctx.beginPath(); ctx.moveTo(-9, 0); ctx.quadraticCurveTo(-16, -3 + wag, -22, -9 + wag * 1.4);
  ctx.quadraticCurveTo(-18, wag, -22, 9 + wag * 1.4); ctx.quadraticCurveTo(-16, 3 + wag, -9, 0); ctx.fill();
  // body
  const g = ctx.createLinearGradient(0, -9, 0, 9);
  g.addColorStop(0, '#0e5f78'); g.addColorStop(0.5, '#29c4df'); g.addColorStop(1, '#bff9ff');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(13, 0);
  ctx.bezierCurveTo(11, -10, -6, -11, -11, -2); ctx.quadraticCurveTo(-12, 0, -11, 2); ctx.bezierCurveTo(-6, 11, 11, 10, 13, 0); ctx.fill();
  // circuitry
  ctx.strokeStyle = 'rgba(220,255,255,0.45)'; ctx.lineWidth = 0.7; ctx.beginPath();
  ctx.moveTo(-8, -1); ctx.lineTo(-3, -1); ctx.lineTo(-1, -4); ctx.lineTo(3, -4);
  ctx.moveTo(-7, 3); ctx.lineTo(-2, 3); ctx.lineTo(0, 5); ctx.stroke();
  // antenna
  ctx.strokeStyle = 'rgba(160,240,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(4, -8); ctx.quadraticCurveTo(10, -19, 18 + Math.sin(t * 2.2) * 1.2, -12 + Math.cos(t * 2.2) * 1.2); ctx.stroke();
  // eye
  ctx.fillStyle = '#f2ffff'; ctx.beginPath(); ctx.arc(6, -2, 3.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#04202b'; ctx.beginPath(); ctx.arc(7 + P.lookX, -2 + P.lookY, 1.9, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7.6 + P.lookX, -2.8 + P.lookY, 0.7, 0, TAU); ctx.fill();
}
function drawPlayerEmit(ctx, P, t, frac) {
  const bx = 18 + Math.sin(t * 2.2) * 1.2, by = -12 + Math.cos(t * 2.2) * 1.2;
  const flick = frac < 0.2 ? (Math.random() < 0.15 ? 0.3 : 1) : 1;
  glow(ctx, bx, by, 16 * (0.5 + frac * 0.6), '#6ff7ff', flick);
  glow(ctx, bx, by, 5, '#ffffff', flick);
  glow(ctx, -3, 1, 14, '#22c6e0', 0.45 * flick);
  ctx.globalAlpha = 0.8 * flick; dot(ctx, -3, 1, 2.2, '#dfffff');
  ctx.globalAlpha = 1;
}

// bestiary thumbnails
function drawCodexThumb(canvas, key, known) {
  const g = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  g.clearRect(0, 0, w, h);
  const sp = SPECIES[key];
  g.save(); g.translate(w / 2, h / 2);
  if (!known) { g.fillStyle = 'rgba(111,247,255,.25)'; g.font = '700 22px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 0); g.restore(); return; }
  if (sp.boss) { glow(g, 0, 0, w * 0.45, sp.glow, 0.7); g.globalAlpha = 1; g.font = '26px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(key === 'boss_kraken' ? '🦑' : key === 'boss_leviathan' ? '🐉' : '👁️', 0, 1); g.restore(); return; }
  const art = ART[key], fake = { ph: 1, edible: true, threat: false, st: 0 };
  const s = key === 'gulper' ? 0.85 : key === 'shrimp' ? 1.3 : 1.6;
  g.scale(s, s); if (key === 'gulper') g.translate(10, 0);
  if (art.upright) g.translate(0, -2);
  art.body(g, fake, 1.3); g.globalCompositeOperation = 'lighter'; art.emit(g, fake, 1.3);
  g.restore(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
