// ============================================================
//  Rendering: world pass -> darkness mask -> emissive pass
// ============================================================
const canvas = $('c'), ctx = canvas.getContext('2d', { alpha: false });
const mask = document.createElement('canvas'), mctx = mask.getContext('2d');
let W = 0, H = 0, DPR = 1;
const MS = 0.5; // light-mask resolution scale
let vignette = null, redVignette = null;
const SNOW = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), z: rnd(0.25, 1), s: rnd(0.6, 1.8) }));
const BOKEH = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), z: rnd(0.1, 0.35), s: rnd(2, 5), c: pick(['#6ff7ff', '#ff6ad5', '#7dffb2', '#b98cff']), p: rnd(0, TAU) }));
const INK_SPRITE = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const g = c.getContext('2d'), gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  gr.addColorStop(0, 'rgba(3,0,8,0.95)'); gr.addColorStop(0.6, 'rgba(3,0,8,0.7)'); gr.addColorStop(1, 'rgba(3,0,8,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 96, 96); return c;
})();

function resize() {
  const q = save.settings.quality;
  DPR = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'med' ? 1.5 : 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  mask.width = Math.ceil(W * MS); mask.height = Math.ceil(H * MS);
  const mk = (col, inner) => {
    const v = document.createElement('canvas'); v.width = 256; v.height = 256;
    const g = v.getContext('2d'), gr = g.createRadialGradient(128, 128, 128 * inner, 128, 128, 182);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, col); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return v;
  };
  vignette = mk('rgba(0,0,0,0.75)', 0.45); redVignette = mk('rgba(255,20,50,0.9)', 0.4);
}
window.addEventListener('resize', resize);

function keyedRGB(keys, m) {
  if (m <= keys[0][0]) return hexRgb(keys[0][1]);
  for (let i = 1; i < keys.length; i++) if (m <= keys[i][0]) {
    const t = (m - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]), a = hexRgb(keys[i - 1][1]), b = hexRgb(keys[i][1]);
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }
  return hexRgb(keys[keys.length - 1][1]);
}
const rgbStr = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function updateCamera(dt) {
  const P = G.P, c = G.cam;
  const base = clamp(Math.min(W / 370, H / 640), 0.6, 1.8);
  let zt = base * Math.pow(11 / P.r, 0.5);
  if (G.boss) zt *= 0.8;
  c.zoom = c.zoom ? lerp(c.zoom, zt, Math.min(1, dt * 2)) : zt;
  c.vw = W / c.zoom; c.vh = H / c.zoom;
  const tx = P.x + clamp(P.vx * 0.25, -80, 80), ty = P.y + clamp(P.vy * 0.4, -90, 180) + c.vh * 0.06;
  c.x = lerp(c.x, tx, Math.min(1, dt * 4)); c.y = lerp(c.y, ty, Math.min(1, dt * 4));
}

function worldTransform(sx = 0, sy = 0) {
  const c = G.cam;
  ctx.setTransform(DPR * c.zoom, 0, 0, DPR * c.zoom, DPR * (W / 2 - c.x * c.zoom + sx), DPR * (H / 2 - c.y * c.zoom + sy));
}
function inView(x, y, m) { const c = G.cam; return Math.abs(x - c.x) < c.vw / 2 + m && Math.abs(y - c.y) < c.vh / 2 + m; }

function render() {
  const c = G.cam, P = G.P, S = G.S, t = G.t, m = toM(c.y);
  const lowQ = save.settings.quality === 'low';
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // ---- background water
  const topY = c.y - c.vh / 2, botY = c.y + c.vh / 2;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, rgbStr(keyedRGB(BG_KEYS, Math.max(0, topY * M_PER_UNIT))));
  bg.addColorStop(1, rgbStr(keyedRGB(BG_KEYS, Math.max(0, botY * M_PER_UNIT))));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // god rays near the surface
  if (m < 320) {
    const a = (1 - m / 320) * 0.16;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const x = ((i * 0.17 + 0.05) * W + Math.sin(t * 0.3 + i) * 30 - c.x * 0.15 * c.zoom) % (W * 1.2);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(190,245,255,${a})`); g.addColorStop(1, 'rgba(190,245,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x + 40 + i * 6, -10); ctx.lineTo(x + 160 + i * 20, H); ctx.lineTo(x + 70, H); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // far parallax walls
  const rc = rockColors(m);
  ctx.fillStyle = rc.haze; ctx.globalAlpha = 0.55;
  for (const side of [0, 1]) {
    ctx.beginPath(); ctx.moveTo(side ? W + 10 : -10, -20);
    for (let sy = -20; sy <= H + 30; sy += 26) {
      const wy = c.y * 0.6 + (sy - H / 2) / (c.zoom * 0.75) + 50000;
      const w = G.world.walls(wy), wx = (lerp(c.x, w[side], 1.45) - c.x) * c.zoom * 0.75 + W / 2;
      ctx.lineTo(side ? Math.max(W * 0.55, wx) : Math.min(W * 0.45, wx), sy);
    }
    ctx.lineTo(side ? W + 10 : -10, H + 30); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // marine snow
  ctx.fillStyle = 'rgba(210,235,255,0.5)';
  for (const s of SNOW) {
    const x = ((s.x * W - c.x * s.z * 0.35 * c.zoom) % W + W) % W;
    const y = ((s.y * H - c.y * s.z * 0.6 * c.zoom - t * 10 * s.z) % H + H) % H;
    ctx.globalAlpha = 0.15 + 0.35 * s.z; ctx.fillRect(x, y, s.s * s.z * 1.6, s.s * s.z * 1.6);
  }
  ctx.globalAlpha = 1;

  const sh = save.settings.shake ? G.shake : 0;
  const shx = (Math.random() - 0.5) * sh, shy = (Math.random() - 0.5) * sh;
  worldTransform(shx, shy);
  // ---- surface
  if (topY < 0) {
    const sky = ctx.createLinearGradient(0, topY, 0, 0); sky.addColorStop(0, '#d8f6ff'); sky.addColorStop(1, '#7fd6f2');
    ctx.fillStyle = sky; ctx.fillRect(c.x - c.vw, topY - 10, c.vw * 2, -topY + 10);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(c.x - c.vw, 0);
    for (let x = c.x - c.vw; x <= c.x + c.vw; x += 20) ctx.lineTo(x, Math.sin(x * 0.03 + t * 2) * 4 + Math.sin(x * 0.011 - t) * 3);
    ctx.lineTo(c.x + c.vw, 14); ctx.lineTo(c.x - c.vw, 14); ctx.fill();
  }
  // ---- walls
  const y0 = topY - 80, y1 = botY + 80, step = Math.max(12, 16 / c.zoom);
  const samples = [];
  for (let y = Math.floor(y0 / step) * step; y <= y1 + step; y += step) samples.push([y, G.world.walls(y)]);
  const xL = c.x - c.vw - 300, xR = c.x + c.vw + 300;
  ctx.fillStyle = rc.fill; ctx.strokeStyle = rc.rim; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  for (const side of [0, 1]) {
    ctx.beginPath(); ctx.moveTo(side ? xR : xL, samples[0][0]);
    for (const s of samples) ctx.lineTo(s[1][side], s[0]);
    ctx.lineTo(side ? xR : xL, samples[samples.length - 1][0]); ctx.closePath(); ctx.fill();
    ctx.beginPath(); for (let i = 0; i < samples.length; i++) { const s = samples[i]; i ? ctx.lineTo(s[1][side], s[0]) : ctx.moveTo(s[1][side], s[0]); } ctx.stroke();
  }
  // ---- decorations
  const decos = [];
  const c0 = Math.floor((topY - 250) / DECO_CELL), c1 = Math.ceil((botY + 250) / DECO_CELL);
  for (let cell = Math.max(0, c0); cell <= c1; cell++) for (const side of [0, 1]) { const d = decoAt(cell, side, G.world); if (d) decos.push(d); }
  for (const d of decos) drawDeco(d, t);
  // ---- pickups (solid parts)
  for (const p of G.pickups) {
    if (!inView(p.x, p.y, 40)) continue;
    if (p.kind === 'pearl') {
      const g = ctx.createRadialGradient(p.x - 2, p.y - 2, 0.5, p.x, p.y, p.r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e8c98a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    } else if (p.kind === 'shard') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ph * 1.5);
      ctx.fillStyle = 'rgba(255,106,213,0.85)'; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(9, 0); ctx.lineTo(0, 14); ctx.lineTo(-9, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
    }
  }
  // ---- bubbles (only visible when lit)
  ctx.strokeStyle = 'rgba(210,245,255,0.55)'; ctx.lineWidth = 0.8;
  for (const p of G.parts) if (p.type === 'bubble' && inView(p.x, p.y, 20)) { ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5); ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // ---- creatures
  for (const cr of G.creatures) if (inView(cr.x, cr.y, cr.r * 4 + 40)) drawCreature(cr, false);
  if (G.boss) BOSS_AI[G.boss.kind].draw(ctx, G.boss);
  // ---- player
  if (!G.over) {
    ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.ang); if (Math.cos(P.ang) < 0) ctx.scale(1, -1); ctx.scale(P.r / 10, P.r / 10);
    if (P.inv > 0 && P.dashT <= 0 && Math.floor(t * 20) % 2) ctx.globalAlpha = 0.45;
    drawPlayerBody(ctx, P, t); ctx.restore(); ctx.globalAlpha = 1;
  }

  // ================= darkness =================
  const dark = keyed(DARK_KEYS, m);
  if (dark > 0.02) {
    const dc = keyedRGB(BG_KEYS, m);
    mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.globalCompositeOperation = 'source-over'; mctx.globalAlpha = 1;
    mctx.clearRect(0, 0, mask.width, mask.height);
    mctx.fillStyle = `rgba(${dc[0] * 0.18 | 0},${dc[1] * 0.18 | 0},${dc[2] * 0.22 | 0},${dark})`;
    mctx.fillRect(0, 0, mask.width, mask.height);
    mctx.globalCompositeOperation = 'destination-out';
    const k = c.zoom * MS, ox = (W / 2 - c.x * c.zoom + shx) * MS, oy = (H / 2 - c.y * c.zoom + shy) * MS;
    const L = (x, y, R, a) => {
      const sx = x * k + ox, sy = y * k + oy, r = R * k;
      if (sx + r < 0 || sy + r < 0 || sx - r > mask.width || sy - r > mask.height) return;
      mctx.globalAlpha = Math.min(1, a); mctx.drawImage(LIGHT_SPRITE, sx - r, sy - r, r * 2, r * 2);
    };
    if (!G.over) {
      const frac = P.light / P.maxLight, flick = frac < 0.15 && Math.random() < 0.08 ? 0.6 : 1;
      const R = S.lightR * (0.32 + 0.68 * frac) * Math.sqrt(P.r / 11) * flick;
      L(P.x, P.y, R, 1); L(P.x, P.y, R * 0.55, 1);
      L(P.x + Math.cos(P.ang) * R * 0.45, P.y + Math.sin(P.ang) * R * 0.45, R * 0.7, 0.7);
    }
    for (const cr of G.creatures) {
      const sp = SPECIES[cr.type];
      if (sp.glow && inView(cr.x, cr.y, 200)) L(cr.x, cr.y, cr.r * 3, 0.4);
      if (sp.beh === 'lure' && !cr.edible) L(cr.x + Math.cos(cr.ang) * cr.r * 1.5, cr.y + Math.sin(cr.ang) * cr.r * 1.5, cr.r * 3.2, 0.75);
    }
    let pc = 0;
    for (const p of G.pickups) {
      if (!inView(p.x, p.y, 60)) continue;
      if (p.kind === 'pl') { if (pc++ < 90 && !lowQ) L(p.x, p.y, 16, 0.3); }
      else if (p.kind === 'orb') L(p.x, p.y, 30, 0.5);
      else if (p.kind === 'pearl') L(p.x, p.y, 46, 0.6);
      else L(p.x, p.y, 110, 0.8);
    }
    for (const d of decos) if (d.type === 'crystal' || d.type === 'vent' || d.type === 'rack' || d.type === 'cable') L(d.x + d.dir * 22, d.y, 90 * d.size, 0.6);
    for (const q of G.projs) L(q.x, q.y, 50, 0.7);
    for (const p of G.parts) if (p.type === 'ring') L(p.x, p.y, p.size * (1 - p.life / p.max) + 20, 0.35 * p.life / p.max);
    for (const b of G.bolts) { L(b.a[0], b.a[1], 60, 0.6); L(b.b[0], b.b[1], 60, 0.6); }
    if (G.boss) BOSS_AI[G.boss.kind].lights(G.boss, L);
    if (G.sonar) {
      const so = G.sonar, R = so.t * 900, a = Math.max(0, 1 - R / so.R);
      mctx.globalAlpha = 0.65 * a; mctx.strokeStyle = '#fff'; mctx.lineWidth = 70 * k;
      mctx.beginPath(); mctx.arc(so.x * k + ox, so.y * k + oy, R * k, 0, TAU); mctx.stroke();
    }
    if (G.arena && G.boss) { const a = G.arena; L(a.cx, a.y0 + 40, 380, 0.3); L(a.cx, a.y1 - 40, 380, 0.3); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
    worldTransform(shx, shy);
  }

  // ================= emissive =================
  ctx.globalCompositeOperation = 'lighter';
  for (const d of decos) drawDecoEmit(d, t);
  // record markers
  drawMarker(save.best, 'BEST', '#ffd27a', G.mode === 'classic');
  drawMarker(save.daily.date === todayKey() ? save.daily.best : 0, 'TODAY', '#ff6ad5', G.mode === 'daily');
  for (const p of G.pickups) {
    if (!inView(p.x, p.y, 40)) continue;
    if (p.kind === 'pl') { glow(ctx, p.x, p.y, 7, p.col, 0.65 + 0.35 * Math.sin(p.ph * 3)); ctx.globalAlpha = 0.9; dot(ctx, p.x, p.y, 1.3, '#ffffff'); }
    else if (p.kind === 'orb') { glow(ctx, p.x, p.y, 14, p.col, 0.9); ctx.globalAlpha = 1; dot(ctx, p.x, p.y, 2.4, '#ffffff'); }
    else if (p.kind === 'pearl') { glow(ctx, p.x, p.y, 24 + 4 * Math.sin(p.ph * 4), '#ffd27a', 0.8); if (Math.sin(p.ph * 2.3) > 0.9) glow(ctx, p.x + 4, p.y - 4, 10, '#ffffff', 1); }
    else if (p.kind === 'shard') { glow(ctx, p.x, p.y, 50 + 8 * Math.sin(p.ph * 3), '#ff6ad5', 0.8); glow(ctx, p.x, p.y, 22, '#ffffff', 0.6); }
  }
  // threat auras + creature lights
  for (const cr of G.creatures) {
    if (!inView(cr.x, cr.y, cr.r * 4 + 40)) continue;
    if (cr.threat && Math.hypot(cr.x - P.x, cr.y - P.y) < S.lightR * 1.4) glow(ctx, cr.x, cr.y, cr.r * 2.2, '#ff2e4a', 0.13 + 0.07 * Math.sin(t * 6));
    drawCreature(cr, true);
    if (cr.stun > 0) for (let k = 0; k < 3; k++) { const a = t * 6 + k * TAU / 3; glow(ctx, cr.x + Math.cos(a) * cr.r, cr.y - cr.r * 1.1 + Math.sin(a) * cr.r * 0.3, 4, '#ffd27a', 0.9); }
  }
  if (G.boss) BOSS_AI[G.boss.kind].emit(ctx, G.boss);
  // projectiles
  for (const q of G.projs) { glow(ctx, q.x, q.y, q.r * 3.2, q.col, 0.95); ctx.globalAlpha = 1; dot(ctx, q.x, q.y, q.r * 0.55, '#ffffff'); }
  // player trail + emit
  if (!G.over) {
    const tr = P.trail;
    if (tr.length > 2) {
      ctx.lineCap = 'round';
      for (let i = 1; i < tr.length; i++) {
        const u = i / tr.length; ctx.globalAlpha = u * (P.dashT > 0 ? 0.7 : 0.28);
        ctx.strokeStyle = P.dashT > 0 ? '#e8ffff' : '#6ff7ff'; ctx.lineWidth = P.r * 0.9 * u;
        ctx.beginPath(); ctx.moveTo(tr[i - 1][0], tr[i - 1][1]); ctx.lineTo(tr[i][0], tr[i][1]); ctx.stroke();
      }
    }
    ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.ang); if (Math.cos(P.ang) < 0) ctx.scale(1, -1); ctx.scale(P.r / 10, P.r / 10);
    drawPlayerEmit(ctx, P, t, P.light / P.maxLight); ctx.restore();
    // drones
    for (let i = 0; i < S.drones; i++) {
      const a = G.t * 2.4 + i * TAU / S.drones, rr = P.r * 2.6 + 26;
      glow(ctx, P.x + Math.cos(a) * rr, P.y + Math.sin(a) * rr, 12, '#b8ffe6', 0.9); ctx.globalAlpha = 1; dot(ctx, P.x + Math.cos(a) * rr, P.y + Math.sin(a) * rr, 2.5, '#ffffff');
    }
    if (P.dashCd <= 0 && !G.demo && Math.sin(t * 4) > 0.6) glow(ctx, P.x, P.y, P.r * 2.6, '#6ff7ff', 0.12);
  }
  // particles
  for (const p of G.parts) {
    if (p.type === 'bubble' || !inView(p.x, p.y, 60)) continue;
    const u = p.life / p.max;
    if (p.type === 'dot') glow(ctx, p.x, p.y, p.size * 2.5, p.col, u);
    else if (p.type === 'streak') { ctx.globalAlpha = u; ctx.strokeStyle = p.col; ctx.lineWidth = p.size; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06); ctx.stroke(); }
    else if (p.type === 'ring') { ctx.globalAlpha = u * 0.9; ctx.strokeStyle = p.col; ctx.lineWidth = 3 * u + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - u * u) + 2, 0, TAU); ctx.stroke(); }
  }
  // lightning
  for (const b of G.bolts) {
    ctx.globalAlpha = b.life / 0.18; ctx.strokeStyle = '#d8ffff'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(b.a[0], b.a[1]);
    for (let i = 1; i < 7; i++) { const u = i / 7; ctx.lineTo(lerp(b.a[0], b.b[0], u) + rnd(-10, 10), lerp(b.a[1], b.b[1], u) + rnd(-10, 10)); }
    ctx.lineTo(b.b[0], b.b[1]); ctx.stroke();
    glow(ctx, b.b[0], b.b[1], 20, '#6ff7ff', 0.9);
  }
  // sonar
  if (G.sonar) {
    const so = G.sonar, R = so.t * 900, a = Math.max(0, 1 - R / so.R);
    ctx.globalAlpha = a; ctx.strokeStyle = '#ff6ad5'; ctx.lineWidth = 4 / c.zoom + 2;
    ctx.beginPath(); ctx.arc(so.x, so.y, R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = a * 0.4; ctx.lineWidth = 18; ctx.stroke();
  }
  // arena barriers
  if (G.boss && G.arena) {
    const a = G.arena;
    for (const y of [a.y0 + 40, a.y1 - 40]) {
      const [l, r] = G.world.walls(y);
      ctx.globalAlpha = 0.6 + 0.2 * Math.sin(t * 5); ctx.strokeStyle = '#ff2e4a'; ctx.lineWidth = 5;
      ctx.beginPath(); for (let x = l; x <= r; x += 16) { const yy = y + Math.sin(x * 0.04 + t * 4) * 6; x === l ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke();
      ctx.globalAlpha = 0.25; ctx.lineWidth = 22; ctx.stroke();
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // sonar-revealed silhouettes
  for (const cr of G.creatures) if (cr.reveal > 0 && inView(cr.x, cr.y, 80)) { ctx.globalAlpha = Math.min(1, cr.reveal / 1.5) * 0.85; drawCreature(cr, false); }
  ctx.globalAlpha = 1;
  // ink clouds
  for (const k of G.inks) {
    const u = k.t / k.life, a = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
    for (let i = 0; i < 5; i++) { const ang = i * 1.3 + k.t * 0.3, rr = k.r * (0.4 + u * 0.6); ctx.globalAlpha = a * 0.8; ctx.drawImage(INK_SPRITE, k.x + Math.cos(ang) * rr * 0.4 - rr, k.y + Math.sin(ang) * rr * 0.4 - rr, rr * 2, rr * 2); }
  }
  ctx.globalAlpha = 1;
  // floating texts
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const tx of G.texts) {
    const s = tx.size / c.zoom;
    ctx.globalAlpha = Math.min(1, tx.life * 2.5); ctx.font = `700 ${s}px ui-rounded,system-ui,sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(tx.txt, tx.x + 1 / c.zoom, tx.y + 1.5 / c.zoom);
    ctx.fillStyle = tx.col; ctx.fillText(tx.txt, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;

  // ================= screen space =================
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  if (m > 150) for (const b of BOKEH) {
    const x = ((b.x * W - c.x * b.z * c.zoom) % W + W) % W, y = ((b.y * H - c.y * b.z * c.zoom) % H + H) % H;
    glow(ctx, x, y, b.s * 3, b.c, (0.25 + 0.25 * Math.sin(t * 0.8 + b.p)) * Math.min(1, (m - 150) / 300));
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (vignette) ctx.drawImage(vignette, -W * 0.1, -H * 0.1, W * 1.2, H * 1.2);
  if (!G.demo && !G.zen && P) {
    const frac = P.light / P.maxLight;
    if (frac < 0.3) { ctx.globalAlpha = (0.3 - frac) / 0.3 * (0.45 + 0.3 * Math.sin(t * 7)); ctx.drawImage(redVignette, -W * 0.1, -H * 0.1, W * 1.2, H * 1.2); ctx.globalAlpha = 1; }
  }
  if (G.flash > 0) { ctx.globalAlpha = Math.min(0.6, G.flash); ctx.fillStyle = G.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  const j = Input.joy;
  if (j && G.state === 'play') {
    ctx.strokeStyle = 'rgba(111,247,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(j.ox, j.oy, 56, 0, TAU); ctx.stroke();
    const dx = j.x - j.ox, dy = j.y - j.oy, d = Math.hypot(dx, dy), k = d > 56 ? 56 / d : 1;
    ctx.fillStyle = 'rgba(111,247,255,0.35)'; ctx.beginPath(); ctx.arc(j.ox + dx * k, j.oy + dy * k, 20, 0, TAU); ctx.fill();
  }
}

function drawMarker(bestM, label, col, show) {
  if (!show || G.demo || bestM < 30) return;
  const y = bestM * 10; if (!inView(G.cam.x, y, 40)) return;
  const [l, r] = G.world.walls(y);
  ctx.globalAlpha = 0.55; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([14, 10]);
  ctx.beginPath(); ctx.moveTo(l, y); ctx.lineTo(r, y); ctx.stroke(); ctx.setLineDash([]);
  ctx.globalAlpha = 0.9; ctx.fillStyle = col; ctx.font = `700 ${12 / G.cam.zoom}px ui-rounded,system-ui,sans-serif`; ctx.textAlign = 'left';
  ctx.fillText(`${label} ${bestM} m`, l + 50, y - 8 / G.cam.zoom);
  ctx.globalAlpha = 1;
}

function drawCreature(cr, emissive) {
  const art = ART[cr.type]; if (!art) return;
  ctx.save(); ctx.translate(cr.x, cr.y);
  if (art.upright) ctx.rotate(clamp(cr.vx * 0.004, -0.4, 0.4));
  else { ctx.rotate(cr.ang); if (cr.flip) ctx.scale(1, -1); }
  ctx.scale(cr.r / 10, cr.r / 10);
  if (emissive) art.emit(ctx, cr, cr.t);
  else {
    art.body(ctx, cr, cr.t);
    if (cr.flash > 0) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill(); }
  }
  ctx.restore(); if (emissive) ctx.globalAlpha = 1;
}

function drawDeco(d, t) {
  const s = d.size, dir = d.dir;
  ctx.save(); ctx.translate(d.x, d.y);
  switch (d.type) {
    case 'kelp': {
      ctx.strokeStyle = '#2f8a5a'; ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.lineWidth = 5 - k; ctx.beginPath(); ctx.moveTo(k * 8 * dir, 0);
        for (let i = 1; i <= 8; i++) ctx.lineTo(k * 8 * dir + dir * i * 4 + Math.sin(t * 1.2 + i * 0.5 + k + d.seed * 9) * i * 2.2, -i * 18 * s);
        ctx.stroke();
      }
      break;
    }
    case 'coral': {
      ctx.strokeStyle = d.seed > 0.5 ? '#ff7f6b' : '#ffb36b'; ctx.lineCap = 'round';
      const br = (x, y, a, l, w) => { if (l < 6) return; const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); br(x2, y2, a - 0.45, l * 0.7, w * 0.7); br(x2, y2, a + 0.45, l * 0.7, w * 0.7); };
      br(0, 0, dir > 0 ? -0.5 : Math.PI + 0.5, 26 * s, 5);
      break;
    }
    case 'anemone': {
      ctx.fillStyle = '#7a3a6a'; ctx.beginPath(); ctx.arc(0, 0, 10 * s, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#d07ab8'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const a = (dir > 0 ? 0 : Math.PI) + (i - 4) * 0.28 + Math.sin(t * 2 + i) * 0.12; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8 * s, Math.sin(a) * 8 * s); ctx.lineTo(Math.cos(a) * 26 * s, Math.sin(a) * 26 * s); ctx.stroke(); }
      break;
    }
    case 'seapen': {
      ctx.strokeStyle = '#c9a36a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dir * 14 * s, -40 * s); ctx.stroke();
      ctx.lineWidth = 1;
      for (let i = 2; i < 10; i++) { const x = dir * 14 * s * i / 10, y = -40 * s * i / 10, w = Math.sin(t * 2 + i) * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8 + w, y - 4); ctx.moveTo(x, y); ctx.lineTo(x + 8 + w, y - 4); ctx.stroke(); }
      break;
    }
    case 'crystal': {
      ctx.fillStyle = rgbaHex(d.color, 0.55); ctx.strokeStyle = rgbaHex(d.color, 0.9); ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        const a = (dir > 0 ? 0 : Math.PI) + (i - 1.5) * 0.45, L = (26 + i * 9 * ((i * 7 + d.seed * 10) % 1.5)) * s, w = 6 * s;
        ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-4, -w); ctx.lineTo(L * 0.8, -w * 0.7); ctx.lineTo(L, 0); ctx.lineTo(L * 0.8, w * 0.7); ctx.lineTo(-4, w); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      break;
    }
    case 'vent': {
      ctx.fillStyle = '#1d1414'; ctx.beginPath(); ctx.moveTo(0, 18 * s); ctx.lineTo(dir * 46 * s, 8 * s); ctx.lineTo(dir * 52 * s, -10 * s); ctx.lineTo(0, -14 * s); ctx.fill();
      if (Math.random() < 0.08) addPart('bubble', d.x + dir * 50 * s, d.y, rnd(-5, 5), rnd(-60, -30), rnd(1, 2), rnd(1.5, 3.5), '#ffd0b0');
      break;
    }
    case 'worms': {
      for (let i = 0; i < 5; i++) {
        const y = (i - 2) * 7 * s, L = (20 + i * 5) * s, w = Math.sin(t * 2 + i) * 2;
        ctx.strokeStyle = '#d8d0c4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(dir * L, y + w); ctx.stroke();
        ctx.fillStyle = '#d0203a'; ctx.beginPath(); ctx.arc(dir * L, y + w, 3.5, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'rack': {
      ctx.fillStyle = '#141820'; ctx.strokeStyle = '#2c3442'; ctx.lineWidth = 2;
      ctx.fillRect(dir > 0 ? -10 : -50 * s + 10, -34 * s, 50 * s, 68 * s); ctx.strokeRect(dir > 0 ? -10 : -50 * s + 10, -34 * s, 50 * s, 68 * s);
      ctx.strokeStyle = '#232a36'; for (let i = 1; i < 6; i++) { ctx.beginPath(); const y = -34 * s + i * 68 * s / 6; ctx.moveTo(dir > 0 ? -10 : -50 * s + 10, y); ctx.lineTo(dir > 0 ? 50 * s - 10 : 10, y); ctx.stroke(); }
      break;
    }
    case 'cable': {
      ctx.strokeStyle = '#151a22'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -30 * s);
      ctx.quadraticCurveTo(dir * 90 * s, 20 * s + Math.sin(t * 0.7 + d.seed * 9) * 8, 0, 60 * s); ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
function drawDecoEmit(d, t) {
  const s = d.size, dir = d.dir;
  switch (d.type) {
    case 'crystal': glow(ctx, d.x + dir * 22 * s, d.y, 46 * s, d.color, 0.45 + 0.15 * Math.sin(t * 1.5 + d.seed * 9)); break;
    case 'vent': glow(ctx, d.x + dir * 50 * s, d.y - 2, 40 * s, '#ff8a3c', 0.7 + 0.2 * Math.sin(t * 6 + d.seed * 20)); break;
    case 'worms': for (let i = 0; i < 5; i++) glow(ctx, d.x + dir * (20 + i * 5) * s, d.y + (i - 2) * 7 * s, 6, '#ff5f7a', 0.6); break;
    case 'anemone': glow(ctx, d.x, d.y, 26 * s, '#d07ab8', 0.25); break;
    case 'rack':
      for (let i = 0; i < 6; i++) for (let k = 0; k < 3; k++) {
        const on = Math.sin(t * (2 + k) + i * 1.7 + d.seed * 30) > 0.2;
        if (on) glow(ctx, d.x + dir * (6 + k * 10) * s, d.y - 34 * s + (i + 0.5) * 68 * s / 6, 5, k === 2 ? '#ff3b5c' : i % 2 ? '#7dffb2' : '#6ff7ff', 0.9);
      }
      break;
    case 'cable': for (let i = 0; i < 3; i++) { const u = (t * 0.25 + i / 3 + d.seed) % 1, x = d.x + dir * 2 * (1 - u) * u * 90 * s, y = d.y + lerp(-30 * s, 60 * s, u); glow(ctx, x, y, 10, d.color, 0.9); } break;
  }
  ctx.globalAlpha = 1;
}
