// ============================================================
//  Rendering: pseudo-3D highway, sprite cache, effects
// ============================================================
const canvas = $('c'), ctx = canvas.getContext('2d', { alpha: false });
let W = 0, H = 0, DPR = 1, F = 300, HOR = 200, CAMH = 10;
const CAMD = 11, FAR = 110;
const THEMES = [
  { sky: ['#1d1430', '#6b2f4a', '#ff8a4c'], sun: '#ffd27a', ground: '#3a2a22', road: '#2e2a2f', fog: '#c9704a', city: '#2a1a26' },
  { sky: ['#070d1f', '#1b2c55', '#4f78b8'], sun: '#cfe4ff', ground: '#1d2228', road: '#26282f', fog: '#3e5b8a', city: '#0d1424' },
  { sky: ['#0f1a10', '#2f4a1c', '#a7c94a'], sun: '#efffa0', ground: '#2a2b1b', road: '#2b2c28', fog: '#6f8a3a', city: '#141c10' },
  { sky: ['#1a0606', '#5a1410', '#ff5a2a'], sun: '#ffb24a', ground: '#341a14', road: '#2f2523', fog: '#a33a22', city: '#200a08' },
];
const theme = () => THEMES[(G.mode === 'endless' || G.mode === 'demo' ? Math.floor(G.z / 520) : G.mode === 'daily' ? 2 : G.stage - 1) % THEMES.length];

function resize() {
  const q = save.settings.quality;
  DPR = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : 1.25);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  F = Math.min(W, H * 0.62) * 0.78; HOR = H * 0.22; CAMH = (H * 0.8 - HOR) * CAMD / F;
  city = null;
}
window.addEventListener('resize', resize);

let camX = 0, camZ = 0, shx = 0, shy = 0;
function proj(x, y, z) {
  const dz = z - camZ; if (dz < 0.35) return null;
  const s = F / dz; return [W / 2 + (x - camX) * s + shx, HOR + (CAMH - y) * s + shy, s, dz];
}

// ---------------- sprite cache ----------------
const SPR = new Map();
function sprite(key, w, h, draw) {
  let c = SPR.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); SPR.set(key, c); return c;
}
function flashVersion(key, base) {
  return sprite(key + ':f', base.width, base.height, g => { g.drawImage(base, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, 0, base.width, base.height); });
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
function soldierSprite(frame) {
  return sprite('sol' + frame, 48, 96, (g, w, h) => {
    const leg = [0, 1, 0, -1][frame] * 5;
    g.fillStyle = '#1f2a36'; rr(g, 13, 62 + Math.max(0, leg), 9, 30 - Math.max(0, leg), 3); g.fill(); rr(g, 26, 62 + Math.max(0, -leg), 9, 30 - Math.max(0, -leg), 3); g.fill();
    g.fillStyle = '#0f151c'; g.fillRect(12, 88 + Math.max(0, leg) * 0.2, 11, 6); g.fillRect(25, 88 + Math.max(0, -leg) * 0.2, 11, 6);
    const tg = g.createLinearGradient(0, 30, 0, 68); tg.addColorStop(0, '#4c8fd6'); tg.addColorStop(1, '#27578f');
    g.fillStyle = tg; rr(g, 9, 30, 30, 38, 8); g.fill();
    g.fillStyle = '#2c3a4a'; rr(g, 14, 36, 20, 22, 4); g.fill();
    g.fillStyle = '#3c4c5e'; g.fillRect(16, 40, 16, 3); g.fillRect(16, 47, 16, 3);
    g.fillStyle = '#d9a77a'; rr(g, 5, 36 + leg * 0.3, 7, 18, 3); g.fill(); rr(g, 36, 34 - leg * 0.3, 7, 16, 3); g.fill();
    g.fillStyle = '#16191e'; g.fillRect(37, 6, 5, 34);
    g.fillStyle = '#d9a77a'; g.beginPath(); g.arc(24, 24, 9, 0, TAU); g.fill();
    const hg = g.createLinearGradient(0, 8, 0, 28); hg.addColorStop(0, '#5aa0e6'); hg.addColorStop(1, '#2a5f98');
    g.fillStyle = hg; g.beginPath(); g.arc(24, 21, 12, Math.PI, 0); g.lineTo(36, 26); g.lineTo(12, 26); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(19, 14, 4, 2.5, -0.5, 0, TAU); g.fill();
  });
}
function zombieSprite(type, frame) {
  const T = ZTYPES[type];
  return sprite('z' + type + frame, 64, 100, (g, w, h) => {
    const bw = type === 'brute' ? 1.35 : type === 'exploder' ? 1.15 : 1, cx = 32, leg = [0, 1, 0, -1][frame] * 4;
    g.fillStyle = '#2b2522'; rr(g, cx - 12 * bw, 64 + leg, 10 * bw, 30 - leg, 3); g.fill(); rr(g, cx + 2 * bw, 64 - leg, 10 * bw, 30 + leg, 3); g.fill();
    const shirt = type === 'spitter' ? '#3e2a55' : type === 'exploder' ? '#6b4a1e' : type === 'brute' ? '#3b3226' : pick(['#5a4a3c', '#3f4a52', '#5b3a36']);
    g.fillStyle = shirt; rr(g, cx - 15 * bw, 30, 30 * bw, 38, 8); g.fill();
    if (type === 'exploder') { const bg = g.createRadialGradient(cx, 52, 2, cx, 52, 18); bg.addColorStop(0, '#ffe08a'); bg.addColorStop(1, '#c7782a'); g.fillStyle = bg; g.beginPath(); g.arc(cx, 52, 17, 0, TAU); g.fill(); g.fillStyle = 'rgba(120,50,0,.6)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx - 8 + i * 5, 46 + (i % 2) * 9, 2, 0, TAU); g.fill(); } }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(cx - 10, 40); g.lineTo(cx + 2, 56); g.lineTo(cx - 4, 60); g.fill();
    g.fillStyle = T.skin;
    const ay = 38 + frame % 2 * 2;
    rr(g, cx - 22 * bw, ay, 9 * bw, 20, 4); g.fill(); rr(g, cx + 13 * bw, ay + 2 - frame % 2 * 4, 9 * bw, 20, 4); g.fill();
    g.beginPath(); g.arc(cx - 17.5 * bw, ay + 22, 5.5 * bw, 0, TAU); g.arc(cx + 17.5 * bw, ay + 22 - frame % 2 * 4, 5.5 * bw, 0, TAU); g.fill();
    const hr = type === 'brute' ? 10 : type === 'spitter' ? 13 : 11.5;
    g.fillStyle = T.skin; g.beginPath(); g.ellipse(cx, 20, hr, hr * 1.08, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(cx + 4, 24, hr * 0.6, hr * 0.5, 0, 0, TAU); g.fill();
    g.fillStyle = '#1a0b0b'; g.beginPath(); g.ellipse(cx - 4.5, 18, 3.4, 3, 0, 0, TAU); g.ellipse(cx + 4.5, 18, 3.4, 3, 0, 0, TAU); g.fill();
    g.fillStyle = '#ff3a2a'; g.beginPath(); g.arc(cx - 4.5, 18, 1.6, 0, TAU); g.arc(cx + 4.5, 18, 1.6, 0, TAU); g.fill();
    g.fillStyle = '#2a0d0d'; rr(g, cx - 5, 25, 10, 5 + frame % 2 * 2, 2); g.fill();
    g.fillStyle = '#e8e0c8'; g.fillRect(cx - 4, 25, 2, 2); g.fillRect(cx + 1, 25, 2, 2);
    if (type === 'spitter') { g.fillStyle = '#9cff4a'; g.fillRect(cx - 1, 30, 3, 8); }
    if (type === 'brute') { g.fillStyle = '#6a6056'; g.fillRect(cx - 20, 30, 40, 7); }
  });
}
const SHADOW = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 24; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 12, 0, 32, 12, 32); gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.scale(1, 24 / 64); g.fillRect(0, 0, 64, 64); return c; })();
const GLOW = new Map();
function glowSpr(col) { let c = GLOW.get(col); if (c) return c; c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, col); gr.addColorStop(0.3, col + '88'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); GLOW.set(col, c); return c; }

let city = null;
function cityLayer(th) {
  const w = Math.ceil(W * 1.6), h = Math.ceil(H * 0.16), key = th.city + w;
  if (city && city.key === key) return city.c;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), r = mulberry32(7);
  g.fillStyle = th.city;
  for (let x = 0; x < w;) { const bw = 14 + r() * 40, bh = h * (0.25 + r() * 0.75); g.fillRect(x, h - bh, bw, bh); if (r() < 0.3) g.fillRect(x + bw * 0.4, h - bh - 10, 3, 10);
    g.fillStyle = 'rgba(255,190,110,.35)'; for (let k = 0; k < bh / 9; k++) if (r() < 0.12) g.fillRect(x + 3 + r() * (bw - 6), h - bh + 4 + k * 9, 2, 3); g.fillStyle = th.city; x += bw + r() * 6; }
  city = { key, c }; return c;
}

// ---------------- frame ----------------
function render() {
  const th = theme();
  const sh = save.settings.shake ? G.shake : 0; shx = (Math.random() - 0.5) * sh; shy = (Math.random() - 0.5) * sh;
  camZ = G.z - CAMD; camX = G.x * 0.45;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, HOR); sky.addColorStop(0, th.sky[0]); sky.addColorStop(0.6, th.sky[1]); sky.addColorStop(1, th.sky[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HOR + 2);
  const sunX = W * 0.32 - camX * 4;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9; ctx.drawImage(glowSpr(th.sun), sunX - H * 0.22, HOR - H * 0.2, H * 0.44, H * 0.44); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = th.sun; ctx.beginPath(); ctx.arc(sunX, HOR - H * 0.035, H * 0.04, Math.PI, 0); ctx.fill();
  const cl = cityLayer(th); ctx.drawImage(cl, -W * 0.3 - camX * 6 + shx, HOR - cl.height + 1 + shy);
  // ground
  const gg = ctx.createLinearGradient(0, HOR, 0, H); gg.addColorStop(0, th.fog); gg.addColorStop(0.12, th.ground); gg.addColorStop(1, th.ground);
  ctx.fillStyle = gg; ctx.fillRect(0, HOR, W, H - HOR);
  // road surface
  const nearZ = camZ + 0.5, farZ = camZ + FAR;
  const pL0 = proj(-ROAD, 0, nearZ), pR0 = proj(ROAD, 0, nearZ), pL1 = proj(-ROAD, 0, farZ), pR1 = proj(ROAD, 0, farZ);
  const rg = ctx.createLinearGradient(0, pL1[1], 0, H); rg.addColorStop(0, th.fog); rg.addColorStop(0.22, th.road); rg.addColorStop(1, th.road);
  ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(pL0[0], pL0[1]); ctx.lineTo(pL1[0], pL1[1]); ctx.lineTo(pR1[0], pR1[1]); ctx.lineTo(pR0[0], pR0[1]); ctx.fill();
  // bands, curbs, centre line
  const z0 = Math.floor(nearZ / 2) * 2;
  for (let z = z0; z < camZ + 70; z += 2) {
    const a = proj(-ROAD, 0, Math.max(z, nearZ)), b = proj(-ROAD, 0, z + 2); if (!a || !b) continue;
    const ar = proj(ROAD, 0, Math.max(z, nearZ)), br = proj(ROAD, 0, z + 2);
    const fog = clamp((z - camZ - 30) / 45, 0, 1);
    if ((z / 2) % 4 === 0) { ctx.fillStyle = `rgba(255,255,255,${0.025 * (1 - fog)})`; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(br[0], br[1]); ctx.lineTo(ar[0], ar[1]); ctx.fill(); }
    const cw = 0.45;
    ctx.fillStyle = (z / 2) % 2 ? `rgba(230,60,50,${1 - fog})` : `rgba(240,236,228,${1 - fog})`;
    for (const sx of [-1, 1]) {
      const p1 = proj(sx * ROAD, 0, Math.max(z, nearZ)), p2 = proj(sx * ROAD, 0, z + 2), p3 = proj(sx * (ROAD + cw), 0, z + 2), p4 = proj(sx * (ROAD + cw), 0, Math.max(z, nearZ));
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.lineTo(p4[0], p4[1]); ctx.fill();
    }
    if ((z / 2) % 3 === 0) {
      const c1 = proj(-0.08, 0, Math.max(z, nearZ)), c2 = proj(-0.08, 0, z + 2.6), c3 = proj(0.08, 0, z + 2.6), c4 = proj(0.08, 0, Math.max(z, nearZ));
      ctx.fillStyle = `rgba(255,200,61,${0.75 * (1 - fog)})`; ctx.beginPath(); ctx.moveTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(c3[0], c3[1]); ctx.lineTo(c4[0], c4[1]); ctx.fill();
    }
  }
  // splats and hazard markers on the road
  for (const s of G.splats) {
    const p = proj(s.x, 0, s.z); if (!p) continue;
    ctx.globalAlpha = 0.55; ctx.fillStyle = s.col; ctx.beginPath(); ctx.ellipse(p[0], p[1], s.r * p[2], s.r * p[2] * CAMH / p[3] * 0.9, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const h of G.hazards) {
    const p = proj(h.x, 0, h.z); if (!p) continue;
    const u = clamp(h.t / h.land, 0, 1), rx = h.r * p[2], ry = rx * CAMH / p[3] * 0.9;
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(G.time * 18); ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(p[0], p[1], rx, ry, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.ellipse(p[0], p[1], rx * u, ry * u, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // side props
  drawProps();
  // ---- sorted entities
  const list = [];
  for (const zb of G.zombies) if (zb.z - camZ < FAR) list.push([zb.z, 0, zb]);
  for (const g of G.gates) if (g.side === -1) list.push([g.z, 1, g]);
  for (const c of G.crates) list.push([c.z, 2, c]);
  for (const b of G.barrels) list.push([b.z, 3, b]);
  if (G.boss) list.push([G.boss.z, 4, G.boss]);
  for (const s of G.soldiers) list.push([G.z + s.oz, 5, s]);
  list.sort((a, b) => b[0] - a[0]);
  for (const [z, k, o] of list) {
    if (k === 0) drawZombie(o); else if (k === 1) drawGatePair(o); else if (k === 2) drawCrate(o); else if (k === 3) drawBarrel(o); else if (k === 4) drawBoss(o); else drawSoldier(o);
  }
  // shield dome
  if (G.shieldT > 0) {
    const p = proj(G.x, 0, G.z); if (p) { const r = (G.R + 0.6) * p[2]; ctx.globalAlpha = 0.25 + 0.1 * Math.sin(G.time * 10); ctx.fillStyle = '#6fd8ff'; ctx.beginPath(); ctx.ellipse(p[0], p[1] - r * 0.25, r * 1.1, r * 0.75, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.8; ctx.strokeStyle = '#bff0ff'; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; }
  }
  // bullets & glows
  ctx.globalCompositeOperation = 'lighter';
  const Wp = WEAPONS[G.tier];
  ctx.strokeStyle = Wp.col; ctx.lineCap = 'round';
  for (const b of G.bullets) {
    const a = proj(b.x, 0.62, b.z), c = proj(b.x, 0.62, b.z - 1.1); if (!a || !c) continue;
    ctx.lineWidth = Math.max(1, a[2] * 0.045 * Wp.w); ctx.globalAlpha = clamp(1 - (a[3] - 40) / 30, 0, 1);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of G.parts) {
    const q = proj(p.x, p.y, p.z); if (!q) continue;
    const u = p.life / p.max;
    if (p.ring) { ctx.globalAlpha = u; ctx.drawImage(glowSpr('#fff1c0'), q[0] - p.size * q[2], q[1] - p.size * q[2], p.size * q[2] * 2, p.size * q[2] * 2); }
    else if (p.glow) { const s = p.size * q[2] * 2.5; ctx.globalAlpha = u; ctx.drawImage(glowSpr(p.col), q[0] - s, q[1] - s, s * 2, s * 2); }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  for (const p of G.parts) {
    if (p.glow || p.ring) continue;
    const q = proj(p.x, p.y, p.z); if (!q) continue;
    const u = p.life / p.max, s = Math.max(1, p.size * q[2]);
    if (p.smoke) { ctx.globalAlpha = u * 0.5; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(q[0], q[1], s * (2 - u), 0, TAU); ctx.fill(); }
    else { ctx.globalAlpha = Math.min(1, u * 2); ctx.fillStyle = p.col; ctx.fillRect(q[0] - s / 2, q[1] - s / 2, s, s); }
  }
  ctx.globalAlpha = 1;
  // projectiles in the air
  for (const h of G.hazards) {
    const u = clamp(h.t / h.land, 0, 1); if (h.t < 0) continue;
    let x, y, z;
    if (h.kind === 'missile') { x = h.x; z = h.z; y = (1 - u) * 16; }
    else { x = lerp(h.fromX, h.x, u); z = lerp(h.fromZ, h.z, u); y = Math.sin(Math.PI * u) * 7 + (h.kind === 'rock' ? 3 * (1 - u) : 1 - u); }
    const p = proj(x, y, z); if (!p) continue;
    const s = (h.kind === 'rock' ? 0.9 : 0.45) * p[2];
    if (h.kind === 'rock') { ctx.fillStyle = '#5a4a3e'; ctx.beginPath(); ctx.arc(p[0], p[1], s, 0, TAU); ctx.fill(); }
    else { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSpr(h.kind === 'acid' ? '#9cff4a' : '#ff8a2e'), p[0] - s * 2, p[1] - s * 2, s * 4, s * 4); ctx.globalCompositeOperation = 'source-over'; if (h.kind === 'missile') { ctx.fillStyle = '#ddd'; ctx.fillRect(p[0] - s * 0.2, p[1] - s * 1.6, s * 0.4, s * 1.4); } }
  }
  // count badge
  if (G.soldiers.length && !G.over) {
    const p = proj(G.x, 1.5, G.z + G.RZ + 0.4);
    if (p) {
      const sc = 1 + G.badgePop * 0.35, txt = fmt(Math.round(G.shownN)), fs = 22 * sc;
      ctx.font = `900 ${fs}px "Avenir Next Condensed","Roboto Condensed","Arial Narrow",Impact,sans-serif`;
      const tw = ctx.measureText(txt).width + 22 * sc, by = p[1] - 46;
      ctx.fillStyle = G.badgeBad > 0.3 ? '#d8352a' : '#1b6fd1'; rr(ctx, p[0] - tw / 2, by - fs * 0.62, tw, fs * 1.24, 8 * sc); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(p[0] - tw / 2 + 4, by - fs * 0.62 + 3, tw - 8, 2);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, p[0], by + 1);
      ctx.beginPath(); ctx.fillStyle = G.badgeBad > 0.3 ? '#d8352a' : '#1b6fd1'; ctx.moveTo(p[0] - 6, by + fs * 0.6); ctx.lineTo(p[0] + 6, by + fs * 0.6); ctx.lineTo(p[0], by + fs * 0.6 + 7); ctx.fill();
    }
  }
  // floating texts
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of G.texts) {
    const p = proj(t.x, t.y, t.z); if (!p) continue;
    const fs = clamp(p[2] * 0.75, 16, 40);
    ctx.font = `900 ${fs}px "Avenir Next Condensed","Roboto Condensed","Arial Narrow",Impact,sans-serif`;
    ctx.globalAlpha = Math.min(1, t.life * 2); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(t.txt, p[0] + 2, p[1] + 3); ctx.fillStyle = t.col; ctx.fillText(t.txt, p[0], p[1]);
  }
  ctx.globalAlpha = 1;
  // jet flyover
  if (G.jet) {
    const u = G.jet.t / 1.2, x = lerp(-W * 0.2, W * 1.2, u), y = lerp(H * 0.95, -H * 0.1, u);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.atan2(H * 1.05, W * 1.4) + Math.PI / 2); const s = Math.min(W, H) * 0.0022;
    ctx.scale(s * 60, s * 60);
    ctx.fillStyle = '#2b3138'; ctx.beginPath(); ctx.moveTo(0, -1.2); ctx.lineTo(0.18, -0.2); ctx.lineTo(1, 0.35); ctx.lineTo(0.2, 0.3); ctx.lineTo(0.35, 0.9); ctx.lineTo(0, 0.75); ctx.lineTo(-0.35, 0.9); ctx.lineTo(-0.2, 0.3); ctx.lineTo(-1, 0.35); ctx.lineTo(-0.18, -0.2); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSpr('#ff9a3d'), -0.3, 0.7, 0.6, 0.9); ctx.restore(); ctx.globalCompositeOperation = 'source-over';
  }
  // screen fx
  if (G.flash > 0) { ctx.globalAlpha = Math.min(0.7, G.flash); ctx.fillStyle = '#fff6e0'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (G.badgeBad > 0.25 && !G.over) { const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); v.addColorStop(0, 'rgba(200,0,0,0)'); v.addColorStop(1, `rgba(200,0,0,${G.badgeBad * 0.35})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); }
}

function drawSoldier(s) {
  const x = G.x + s.ox, z = G.z + s.oz, p = proj(x, 0, z); if (!p) return;
  const h = p[2] * 1.0, w = h * 0.5;
  ctx.drawImage(SHADOW, p[0] - w * 0.7, p[1] - w * 0.18, w * 1.4, w * 0.4);
  ctx.drawImage(soldierSprite(Math.floor(s.ph) % 4), p[0] - w / 2, p[1] - h, w, h);
}
function drawZombie(zb) {
  const p = proj(zb.x, 0, zb.z); if (!p) return;
  const T = ZTYPES[zb.type], h = p[2] * 1.08 * T.scale, w = h * 0.64;
  const fog = clamp((p[3] - 60) / 40, 0, 1);
  ctx.globalAlpha = 1 - fog;
  ctx.drawImage(SHADOW, p[0] - w * 0.6, p[1] - w * 0.15, w * 1.2, w * 0.35);
  let spr = zombieSprite(zb.type, Math.floor(zb.ph) % 4); if (zb.flash > 0) spr = flashVersion('z' + zb.type + Math.floor(zb.ph) % 4, spr);
  const bob = Math.abs(Math.sin(zb.ph * Math.PI / 2)) * h * 0.03;
  ctx.drawImage(spr, p[0] - w / 2, p[1] - h - bob, w, h);
  if (zb.type === 'brute' && zb.hp < zb.max) { ctx.fillStyle = '#000a'; ctx.fillRect(p[0] - w * 0.4, p[1] - h - 8, w * 0.8, 5); ctx.fillStyle = '#ff4b3e'; ctx.fillRect(p[0] - w * 0.4, p[1] - h - 8, w * 0.8 * zb.hp / zb.max, 5); }
  ctx.globalAlpha = 1;
}
function gateText(g) { return g.op === '+' ? '+' + g.val : g.op === '-' ? '−' + g.val : g.op === 'x' ? '×' + g.val : g.op === '/' ? '÷' + g.val : '▲ ' + (WEAPONS[Math.min(5, G.tier + 1)] || WEAPONS[5]).name.toUpperCase(); }
function drawGatePair(left) {
  const pair = G.gates.filter(o => o.pair === left.pair);
  for (const g of pair) {
    if (g.pair.passed && !g.taken) continue;
    const x0 = g.side < 0 ? -ROAD : 0.05, x1 = g.side < 0 ? -0.05 : ROAD;
    const a = proj(x0, 2.7, g.z), b = proj(x1, 0, g.z); if (!a || !b) continue;
    const fade = g.pair.passed ? clamp(1 - (G.z - g.z) / 2, 0, 1) : 1 - clamp((a[3] - 70) / 30, 0, 1);
    if (fade <= 0) continue;
    const good = g.op === '+' || g.op === 'x', wpn = g.op === 'W';
    const col = wpn ? [255, 200, 61] : good ? [63, 169, 255] : [255, 75, 62];
    ctx.globalAlpha = fade;
    const gr = ctx.createLinearGradient(0, a[1], 0, b[1]);
    gr.addColorStop(0, `rgba(${col},0.45)`); gr.addColorStop(1, `rgba(${col},0.8)`);
    ctx.fillStyle = gr; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    ctx.strokeStyle = g.flash > 0 ? '#ffffff' : `rgb(${col})`; ctx.lineWidth = Math.max(2, a[2] * 0.12); ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    ctx.fillStyle = `rgb(${col.map(c => c * 0.6 | 0)})`; const pw = Math.max(3, a[2] * 0.22); ctx.fillRect(a[0] - pw / 2, a[1], pw, b[1] - a[1]); ctx.fillRect(b[0] - pw / 2, a[1], pw, b[1] - a[1]);
    const fs = (b[1] - a[1]) * (wpn ? 0.22 : 0.42) * (1 + g.pop * 0.25);
    ctx.font = `900 ${fs}px "Avenir Next Condensed","Roboto Condensed","Arial Narrow",Impact,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillText(gateText(g), cx + fs * 0.05, cy + fs * 0.07);
    ctx.fillStyle = '#fff'; ctx.fillText(gateText(g), cx, cy);
    if (!g.pair.passed && (g.op === '-' || g.op === '/') && fs > 14) {
      const need = g.op === '/' ? gateStep() * expSquad(diff()) * 0.5 : gateStep();
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(cx - fs, cy + fs * 0.6, fs * 2, fs * 0.12);
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - fs, cy + fs * 0.6, fs * 2 * clamp(g.prog / need, 0, 1), fs * 0.12);
    }
  }
  ctx.globalAlpha = 1;
}
function drawCrate(c) {
  const a = proj(c.x - 0.7, 1.35, c.z), b = proj(c.x + 0.7, 0, c.z), t1 = proj(c.x - 0.7, 1.35, c.z + 1.2), t2 = proj(c.x + 0.7, 1.35, c.z + 1.2); if (!a || !b || !t1) return;
  const fog = clamp((a[3] - 60) / 40, 0, 1); ctx.globalAlpha = 1 - fog;
  ctx.fillStyle = '#c8924f'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(t1[0], t1[1]); ctx.lineTo(t2[0], t2[1]); ctx.lineTo(b[0], a[1]); ctx.fill();
  ctx.fillStyle = c.flash > 0 ? '#fff' : '#a8733a'; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  ctx.strokeStyle = '#6e4620'; ctx.lineWidth = Math.max(1.5, a[2] * 0.08); ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(b[0], a[1]); ctx.lineTo(a[0], b[1]); ctx.stroke();
  const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, fs = (b[1] - a[1]) * 0.42, rw = c.reward;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = rw.type === 'troops' ? '+' + rw.val : rw.type === 'weapon' ? '🔫' : rw.type === 'strike' ? '✈️' : '●';
  ctx.fillStyle = '#1b6fd1'; rr(ctx, cx - fs * 0.95, cy - fs * 0.62, fs * 1.9, fs * 1.24, 6); ctx.fill();
  ctx.font = `900 ${fs}px "Avenir Next Condensed","Roboto Condensed","Arial Narrow",Impact,sans-serif`; ctx.fillStyle = rw.type === 'coins' ? '#ffc83d' : '#fff'; ctx.fillText(label, cx, cy + 1);
  if (fs > 10) { ctx.font = `800 ${fs * 0.5}px system-ui`; ctx.fillStyle = '#fff'; ctx.fillText(Math.ceil(c.hp), cx, a[1] - fs * 0.45); }
  ctx.globalAlpha = 1;
}
function drawBarrel(b) {
  const p = proj(b.x, 0, b.z); if (!p) return;
  const h = p[2] * 1.1, w = h * 0.7;
  ctx.fillStyle = b.flash > 0 ? '#fff' : '#c7261c'; rr(ctx, p[0] - w / 2, p[1] - h, w, h, w * 0.2); ctx.fill();
  ctx.fillStyle = '#ffc83d'; ctx.fillRect(p[0] - w / 2, p[1] - h * 0.62, w, h * 0.16);
  ctx.fillStyle = '#8e1a13'; ctx.fillRect(p[0] - w / 2, p[1] - h * 0.9, w, h * 0.05); ctx.fillRect(p[0] - w / 2, p[1] - h * 0.22, w, h * 0.05);
  ctx.fillStyle = '#222'; ctx.font = `900 ${h * 0.2}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('☢', p[0], p[1] - h * 0.54);
}
function drawBoss(b) {
  const p = proj(b.x, 0, b.z); if (!p) return;
  const s = p[2], hgt = 5.5 * s, t = G.time;
  ctx.save(); ctx.translate(p[0], p[1]);
  if (b.dead) { ctx.globalAlpha = clamp(1 - b.deadT / 1.6, 0, 1); ctx.rotate(Math.sin(b.deadT * 30) * 0.05); }
  ctx.drawImage(SHADOW, -hgt * 0.5, -hgt * 0.07, hgt, hgt * 0.18);
  if (b.kind === 'titan') {
    let spr = zombieSprite('brute', Math.floor(t * 3) % 4); if (b.flash > 0) spr = flashVersion('zbrute' + Math.floor(t * 3) % 4, spr);
    ctx.drawImage(spr, -hgt * 0.32, -hgt, hgt * 0.64, hgt);
    ctx.fillStyle = '#c9c2b0'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-hgt * 0.12 + i * hgt * 0.08, -hgt * 0.93); ctx.lineTo(-hgt * 0.09 + i * hgt * 0.08, -hgt * 1.04); ctx.lineTo(-hgt * 0.06 + i * hgt * 0.08, -hgt * 0.93); ctx.fill(); }
  } else if (b.kind === 'mech') {
    const u = hgt / 10, step = Math.sin(t * 4) * u * 0.4, f = b.flash > 0;
    ctx.fillStyle = f ? '#fff' : '#3a3e48'; ctx.fillRect(-u * 3, -u * 4 + step, u * 1.4, u * 4 - step); ctx.fillRect(u * 1.6, -u * 4 - step, u * 1.4, u * 4 + step);
    ctx.fillStyle = f ? '#fff' : '#5b5f6b'; rr(ctx, -u * 3.6, -u * 8.5, u * 7.2, u * 4.8, u * 0.8); ctx.fill();
    ctx.fillStyle = '#2a2d34'; ctx.fillRect(-u * 5, -u * 8, u * 1.6, u * 3.4); ctx.fillRect(u * 3.4, -u * 8, u * 1.6, u * 3.4);
    ctx.fillStyle = '#1a1c21'; ctx.fillRect(-u * 4.6, -u * 9.6, u * 0.8, u * 1.8); ctx.fillRect(u * 3.8, -u * 9.6, u * 0.8, u * 1.8);
    ctx.fillStyle = '#ff2e2e'; ctx.fillRect(-u * 2, -u * 7.6, u * 4, u * 0.8);
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSpr('#ff2e2e'), -u * 3, -u * 9, u * 6, u * 3); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffc83d'; ctx.fillRect(-u * 3.6, -u * 4.6, u * 7.2, u * 0.4);
  } else {
    const u = hgt / 10, puls = 1 + Math.sin(t * 3) * 0.04, f = b.flash > 0;
    ctx.strokeStyle = f ? '#fff' : '#4a2a63'; ctx.lineWidth = u * 0.6; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const a = -Math.PI * 0.1 - i * Math.PI * 0.16; ctx.beginPath(); ctx.moveTo(0, -u * 3); ctx.quadraticCurveTo(Math.cos(a) * u * 4 + Math.sin(t * 2 + i) * u, -u * 3 + Math.sin(a) * u * 2, Math.cos(a) * u * 6, -u * 0.2); ctx.stroke(); }
    const bg = ctx.createRadialGradient(-u, -u * 6, u, 0, -u * 5, u * 4.5); bg.addColorStop(0, f ? '#fff' : '#b989e0'); bg.addColorStop(1, '#4a2a63');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, -u * 5, u * 3.6 * puls, u * 3.4 * puls, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9cff4a'; for (let i = 0; i < 5; i++) { ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(Math.sin(i * 2.1) * u * 2, -u * 5 + Math.cos(i * 1.7) * u * 2, u * 0.4, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = b.dead ? clamp(1 - b.deadT / 1.6, 0, 1) : 1;
    ctx.fillStyle = '#a77fd6'; ctx.beginPath(); ctx.arc(0, -u * 8.7, u * 1.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.arc(-u * 0.5, -u * 8.8, u * 0.25, 0, TAU); ctx.arc(u * 0.5, -u * 8.8, u * 0.25, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function drawProps() {
  const z0 = Math.floor(camZ / 7) * 7;
  for (let z = z0 + 70 * 1; z > z0; z -= 7) {
    for (const side of [-1, 1]) {
      const hsh = ((Math.imul(z * 31 + (side > 0 ? 7 : 0), 2654435761) >>> 0) % 1000) / 1000;
      if (hsh < 0.35) continue;
      const x = side * (ROAD + 1.3 + hsh * 2.5), p = proj(x, 0, z); if (!p) continue;
      const fog = clamp((p[3] - 45) / 40, 0, 1), s = p[2];
      ctx.globalAlpha = 1 - fog;
      if (hsh < 0.55) { // lamp post
        ctx.fillStyle = '#3a3438'; ctx.fillRect(p[0] - s * 0.08, p[1] - s * 4, s * 0.16, s * 4); ctx.fillRect(p[0] - (side > 0 ? s * 0.9 : -s * 0.1) , p[1] - s * 4, s * 0.8, s * 0.12);
        if (hsh > 0.45) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSpr('#ffc870'), p[0] - side * s * 0.55 - s * 0.6, p[1] - s * 4.2, s * 1.2, s * 1.2); ctx.globalCompositeOperation = 'source-over'; }
      } else if (hsh < 0.75) { // wrecked car
        ctx.fillStyle = pick(['#4a3f3a']); rr(ctx, p[0] - s * 1.1, p[1] - s * 0.85, s * 2.2, s * 0.7, s * 0.15); ctx.fill();
        ctx.fillStyle = '#2d2828'; rr(ctx, p[0] - s * 0.7, p[1] - s * 1.3, s * 1.4, s * 0.5, s * 0.15); ctx.fill();
        ctx.fillStyle = '#6b8794'; ctx.fillRect(p[0] - s * 0.55, p[1] - s * 1.2, s * 1.1, s * 0.3);
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(p[0] - s * 0.65, p[1] - s * 0.15, s * 0.22, 0, TAU); ctx.arc(p[0] + s * 0.65, p[1] - s * 0.15, s * 0.22, 0, TAU); ctx.fill();
        if (hsh > 0.7) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - fog) * (0.7 + 0.3 * Math.sin(G.time * 12 + z)); ctx.drawImage(glowSpr('#ff7a2a'), p[0] - s * 0.8, p[1] - s * 2.2, s * 1.6, s * 1.6); ctx.globalCompositeOperation = 'source-over'; }
      } else if (hsh < 0.9) { // concrete barrier
        ctx.fillStyle = '#8a8580'; ctx.beginPath(); ctx.moveTo(p[0] - s * 0.9, p[1]); ctx.lineTo(p[0] - s * 0.5, p[1] - s * 0.8); ctx.lineTo(p[0] + s * 0.5, p[1] - s * 0.8); ctx.lineTo(p[0] + s * 0.9, p[1]); ctx.fill();
        ctx.fillStyle = '#d23a2a'; ctx.fillRect(p[0] - s * 0.6, p[1] - s * 0.6, s * 1.2, s * 0.12);
      } else { // sandbags
        ctx.fillStyle = '#8e7a58'; for (let i = 0; i < 3; i++) { rr(ctx, p[0] - s * 0.9 + i * s * 0.6, p[1] - s * 0.35, s * 0.6, s * 0.35, s * 0.15); ctx.fill(); }
        rr(ctx, p[0] - s * 0.6, p[1] - s * 0.68, s * 0.6, s * 0.35, s * 0.15); ctx.fill(); rr(ctx, p[0], p[1] - s * 0.68, s * 0.6, s * 0.35, s * 0.15); ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}
