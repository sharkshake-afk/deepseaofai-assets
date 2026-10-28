// ============================================================
//  Simulation
// ============================================================
const G = {
  state: 'title', mode: 'demo', stage: 1, mod: null,
  z: 0, x: 0, tx: 0, n: 0, shownN: 0, maxN: 0, tier: 0, speed: 9, baseSpeed: 9,
  soldiers: [], zombies: [], bullets: [], gates: [], crates: [], barrels: [], parts: [], texts: [], hazards: [], splats: [],
  events: [], genZ: 0, len: 600, boss: null, bossesBeaten: 0, nextBossZ: 0,
  strike: 0, shieldCd: 0, shieldT: 0, lastStandUsed: false, bombs: [], jet: null,
  kills: 0, coinsRun: 0, time: 0, shake: 0, slow: 1, slowT: 0, flash: 0, over: false, fireAcc: 0, badgePop: 0, badgeBad: 0,
  rng: Math.random, R: 1,
};

// difficulty at a point on the road: campaign stages ramp up from their start to their boss
const diffAt = z => G.mode === 'endless' || G.mode === 'demo' ? 1 + z / 230 : (G.stage + (G.mode === 'daily' ? 2 : 0)) * (0.62 + 0.45 * clamp(z / G.len, 0, 1));
const diff = () => diffAt(G.z);
const dmgMul = () => (1 + 0.1 * hqLv('firepower')) * (G.mod === 'brutes' ? 1.3 : 1);
const rofMul = () => 1 + 0.07 * hqLv('rof');
const coinMul = () => 0.7 * (1 + 0.15 * hqLv('salvage')) * (G.mod === 'acid' ? 2 : 1);

function newRun(mode, stage) {
  G.mode = mode; G.stage = stage || 1; G.mod = mode === 'daily' ? dailyMod().id : null;
  const seed = mode === 'daily' ? hashStr('surge' + todayKey()) : mode === 'campaign' ? hashStr('stage' + G.stage) : (Math.random() * 1e9) | 0;
  G.rng = mulberry32(seed);
  G.z = 0; G.x = 0; G.tx = 0; G.over = false; G.time = 0; G.kills = 0; G.coinsRun = 0;
  G.n = mode === 'demo' ? 24 : 8 + hqLv('recruits') * 3; G.shownN = G.n; G.maxN = G.n;
  G.tier = Math.min(5, hqLv('armory') + (G.mod === 'armory' ? 2 : 0));
  G.baseSpeed = 9 * (G.mod === 'rush' ? 1.3 : 1); G.speed = G.baseSpeed;
  G.soldiers = []; G.zombies = []; G.bullets = []; G.gates = []; G.crates = []; G.barrels = []; G.parts = []; G.texts = []; G.hazards = []; G.splats = []; G.bombs = [];
  G.events = []; G.genZ = 70;
  if (mode !== 'demo') { // a friendly opening: two good gate choices before the first horde
    const E0 = expSquad(diff());
    G.events.push({ t: 'gates', z: 32, a: { op: '+', val: Math.round(E0 * 0.35) }, b: { op: '+', val: Math.round(E0 * 0.6) } });
    G.events.push({ t: 'gates', z: 52, a: { op: 'x', val: 2 }, b: { op: '+', val: Math.round(E0 * 0.5) } });
  } G.boss = null; G.bossesBeaten = 0; G.jet = null;
  G.len = mode === 'campaign' || mode === 'daily' ? Math.min(980, 430 + G.stage * 28) : Infinity;
  G.nextBossZ = mode === 'endless' ? 520 : G.len;
  G.loss = {}; G.strike = 0; G.shieldCd = 0; G.shieldT = 0; G.lastStandUsed = false; G.recShown = false; G.slow = 1; G.slowT = 0; G.flash = 0; G.fireAcc = 0;
  syncSoldiers(true);
}

// ---------------- stage generation ----------------
function gateVal(op, d) {
  const r = G.rng;
  const E = expSquad(d);
  if (op === '+') return Math.max(3, Math.round(E * (0.18 + r() * 0.24)));
  if (op === '-') return Math.max(3, Math.round(E * (0.28 + r() * 0.3)));
  if (op === 'x') return G.mod === 'double' ? 3 : 2;
  if (op === '/') return 2;
  return 1;
}
function genChunk(toZ) {
  const r = G.rng;
  while (G.genZ < toZ) {
    let z = G.genZ; const d = diffAt(z);
    if (z >= G.nextBossZ - 30 && G.mode !== 'demo') { G.genZ = G.nextBossZ + (G.mode === 'endless' ? 60 : 1e9); continue; }
    const roll = r();
    if (roll < 0.27) {
      // gate pair
      const kind = r(), canW = G.tier < 5 && d > 0.8 && G.mod !== 'armory';
      let a, b;
      if (kind < 0.36) { a = { op: '+' }; b = { op: '-' }; }
      else if (kind < 0.46 && G.time > 0) { a = { op: '+' }; b = { op: 'x' }; }
      else if (kind < 0.62) { a = { op: '-' }; b = { op: '/' }; }
      else if (kind < 0.8 && canW) { a = { op: 'W' }; b = { op: '+' }; }
      else { a = { op: '+' }; b = { op: '+' }; }
      a.val = gateVal(a.op, d); b.val = gateVal(b.op, d);
      if (a.op === '+' && b.op === '+') b.val = Math.round(b.val * 1.5);
      if (b.op === 'x') a.val = Math.round(a.val * 1.4);
      if (r() < 0.5) [a, b] = [b, a];
      G.events.push({ t: 'gates', z, a, b });
      G.genZ += 22 + r() * 8;
    } else if (roll < 0.76) {
      const size = Math.round(expSquad(d) * (0.28 + r() * 0.24) * (G.mod === 'double' ? 1.5 : 1));
      G.events.push({ t: 'horde', z, size, d, spread: 6 + size * 0.22 });
      G.genZ += 18 + size * 0.35 + r() * 8;
    } else if (roll < 0.87) {
      const rw = r(), reward = rw < 0.5 ? { type: 'troops', val: Math.round(expSquad(d) * (0.2 + r() * 0.15)) } : rw < 0.72 && G.tier < 5 ? { type: 'weapon' } : rw < 0.86 ? { type: 'strike' } : { type: 'coins', val: Math.round(15 + d * 8) };
      G.events.push({ t: 'crate', z, x: (r() * 2 - 1) * (ROAD - 1.2), reward, d });
      if (r() < 0.5) G.events.push({ t: 'horde', z: z + 8, size: Math.round(expSquad(d) * 0.2), d, spread: 5 });
      G.genZ += 20 + r() * 6;
    } else {
      const k = 1 + Math.floor(r() * 2);
      for (let i = 0; i < k; i++) G.events.push({ t: 'barrel', z: z + i * 2, x: (r() * 2 - 1) * (ROAD - 1), d });
      G.events.push({ t: 'horde', z: z + 4, size: Math.round(expSquad(d) * 0.5), d, spread: 6 });
      G.genZ += 26 + r() * 8;
    }
  }
}
function zombieKind(d, z) {
  const r = G.rng(), m = G.mod;
  if (m === 'acid' && r < 0.18) return 'spitter';
  if (m === 'brutes' && r < 0.12) return 'brute';
  if (d > 2 && r < 0.07 && z > 140) return 'brute';
  if (d > 1.5 && r < 0.17) return 'exploder';
  if (d > 4 && r < 0.23) return 'spitter';
  if (r < 0.45) return 'runner';
  return 'walker';
}
function spawnZombie(type, x, z, d) {
  const T = ZTYPES[type], h = T.hp * hpMul(d);
  G.zombies.push({ type, x, z, hp: h, max: h, r: T.r, speed: T.speed * rnd(0.85, 1.15), ph: rnd(0, 10), flash: 0, chewT: 0, spitT: rnd(1, 2.5), attached: false });
}
function spawnEvents() {
  const ahead = G.z + 80;
  if (G.mode === 'endless' || G.mode === 'demo') genChunk(G.z + 140);
  else if (G.genZ < G.len) genChunk(G.len);
  while (G.events.length && G.events[0].z < ahead) {
    const e = G.events.shift();
    if (e.t === 'gates') {
      const pair = { passed: false };
      for (const [g, side] of [[e.a, -1], [e.b, 1]]) G.gates.push({ ...g, z: e.z, side, pair, prog: 0, flash: 0, pop: 0 });
    } else if (e.t === 'horde') {
      // bigger squads draw bigger hordes (sub-linearly, so growth still pays off)
      const size = Math.round(e.size * Math.max(1, Math.pow(G.n / (2 * expSquad(e.d)), 0.75)));
      const n = Math.min(size, 120), hpK = size / n; // very big hordes: fewer, tougher bodies
      for (let i = 0; i < n; i++) { spawnZombie(zombieKind(e.d, e.z), (Math.random() * 2 - 1) * (ROAD - 0.5), e.z + Math.random() * (e.spread + n * 0.12), e.d); const zb = G.zombies[G.zombies.length - 1]; zb.hp *= hpK; zb.max = zb.hp; }
    } else if (e.t === 'crate') {
      const hp = expSquad(e.d) * 1.6 * hpMul(e.d) * (e.reward.type === 'weapon' ? 1.6 : 1);
      G.crates.push({ x: e.x, z: e.z, hp, max: hp, reward: e.reward, flash: 0 });
    } else if (e.t === 'barrel') {
      G.barrels.push({ x: e.x, z: e.z, hp: expSquad(e.d) * 0.2 * hpMul(e.d), flash: 0 });
    }
  }
  G.events.sort((a, b) => a.z - b.z);
}

// ---------------- squad ----------------
function formationSpacing(vn) { return Math.min(0.46, (ROAD * 0.92) / Math.sqrt(vn + 1)); }
function syncSoldiers(snap) {
  const vn = Math.min(G.n, save.settings.quality === 'low' ? 90 : 160), sp = formationSpacing(vn);
  while (G.soldiers.length < vn) G.soldiers.push({ ox: rnd(-0.3, 0.3), oz: rnd(0.5, 1.5), ph: rnd(0, 10) });
  if (G.soldiers.length > vn) G.soldiers.length = vn;
  for (let i = 0; i < G.soldiers.length; i++) {
    const s = G.soldiers[i], rr = sp * Math.sqrt(i + 0.5), a = i * 2.39996;
    s.tox = Math.cos(a) * rr; s.toz = Math.sin(a) * rr * 0.55;
    if (snap) { s.ox = s.tox; s.oz = s.toz; }
  }
  G.R = vn ? sp * Math.sqrt(vn) + 0.35 : 0.3;
  G.RZ = G.R * 0.55 + 0.2; // formation depth
}
function addTroops(k, x, z) {
  if (k <= 0) return;
  G.n += k; G.maxN = Math.max(G.maxN, G.n); G.badgePop = 1;
  syncSoldiers(false);
  const vn = G.soldiers.length;
  for (let i = Math.max(0, vn - Math.min(k, 40)); i < vn; i++) { const s = G.soldiers[i]; s.ox = (x ?? G.x) - G.x + rnd(-1, 1); s.oz = (z ?? G.z + 3) - G.z; }
}
function loseTroops(k, cause) {
  if (k <= 0 || G.over) return;
  k = Math.min(k, G.n);
  G.loss[cause || '?'] = (G.loss[cause || '?'] || 0) + k;
  if (G.mode === 'demo') return;
  G.n -= k; G.badgeBad = 1;
  for (let i = 0; i < Math.min(k, 14); i++) {
    const s = G.soldiers[Math.floor(Math.random() * G.soldiers.length)] || { ox: 0, oz: 0 };
    burst(G.x + s.ox, 0.5, G.z + s.oz, '#d0303a', 5, 3);
  }
  Sound.lose(); haptic(15);
  if (G.n <= 0) {
    if (hqLv('laststand') && !G.lastStandUsed) { G.lastStandUsed = true; G.n = 5; banner('Last stand', '5 soldiers hold the line', true); G.shieldT = 2.5; Sound.shield(); }
    else { G.n = 0; syncSoldiers(false); endRun(false); return; }
  }
  syncSoldiers(false);
}
function soldiersInCircle(x, z, r) { // fraction of the squad inside a ground circle
  let c = 0; for (const s of G.soldiers) if (Math.hypot(G.x + s.ox - x, G.z + s.oz - z) < r) c++;
  return G.soldiers.length ? c / G.soldiers.length : 0;
}

// ---------------- combat ----------------
function damageZombie(zb, dmg) {
  zb.hp -= dmg; zb.flash = 0.08;
  if (zb.hp <= 0 && !zb.dead) killZombie(zb);
}
function killZombie(zb) {
  zb.dead = true; G.kills++;
  const T = ZTYPES[zb.type];
  G.coinsRun += T.coin * coinMul();
  G.strike = Math.min(1, G.strike + (1 + 0.06 * hqLv('strike')) / 55);
  burst(zb.x, 0.6 * T.scale, zb.z, T.col, zb.type === 'brute' ? 14 : 6, zb.type === 'brute' ? 5 : 3);
  if (G.splats.length > 90) G.splats.shift();
  G.splats.push({ x: zb.x, z: zb.z, r: 0.35 * T.scale + Math.random() * 0.3, col: T.col, a: rnd(0, TAU) });
  Sound.zdie();
  if (zb.type === 'exploder') explode(zb.x, zb.z, 2.4, 60 * hpMul(diff()), false, 0.3);
  if (zb.type === 'brute') { G.shake = Math.max(G.shake, 4); addText(zb.x, 2, zb.z, '+' + Math.round(T.coin * coinMul()), '#ffc83d'); }
}
function explode(x, z, r, dmg, big, lethality = 1) {
  for (const zb of G.zombies) if (!zb.dead && Math.hypot(zb.x - x, zb.z - z) < r + zb.r) damageZombie(zb, dmg);
  for (const c of G.crates) if (!c.dead && Math.hypot(c.x - x, c.z - z) < r) hitCrate(c, dmg);
  for (const b of G.barrels) if (!b.dead && Math.hypot(b.x - x, b.z - z) < r + 0.5) { b.chain = true; b.hp = 0; }
  if (G.boss && !G.boss.dead && Math.abs(G.boss.z - z) < r + 2 && Math.abs(G.boss.x - x) < r + G.boss.w) bossDamage(dmg * 0.6);
  const frac = soldiersInCircle(x, z, r);
  if (dmg > 0 && frac > 0 && G.shieldT <= 0) loseTroops(Math.ceil(frac * G.n * lethality), 'blast');
  for (let i = 0; i < (big ? 40 : 24); i++) {
    const a = rnd(0, TAU), s = rnd(2, 9);
    G.parts.push({ x, y: 0.4, z, vx: Math.cos(a) * s, vy: rnd(3, 11), vz: Math.sin(a) * s, life: rnd(0.4, 0.9), max: 0.9, col: pick(['#ffd45e', '#ff8a2e', '#ff4b2e', '#fff1c0']), size: rnd(0.12, 0.3), glow: true });
  }
  for (let i = 0; i < 8; i++) G.parts.push({ x: x + rnd(-1, 1), y: rnd(0.5, 2), z: z + rnd(-1, 1), vx: rnd(-0.5, 0.5), vy: rnd(1, 2.5), vz: rnd(-0.5, 0.5), life: rnd(1, 1.8), max: 1.8, col: '#3a3236', size: rnd(0.6, 1.2), smoke: true });
  G.parts.push({ x, y: 0.5, z, vx: 0, vy: 0, vz: 0, life: 0.25, max: 0.25, col: '#fff3c0', size: r * 1.4, ring: true });
  G.splats.push({ x, z, r: r * 0.6, col: '#1a1416', a: 0 });
  G.shake = Math.max(G.shake, big ? 12 : 7); Sound.boom(big); haptic(big ? 40 : 20);
}
function hitCrate(c, dmg) {
  c.hp -= dmg; c.flash = 0.08;
  if (c.hp <= 0 && !c.dead) {
    c.dead = true; Sound.crate();
    burst(c.x, 0.8, c.z, '#b07a3c', 12, 4);
    const rw = c.reward;
    if (rw.type === 'troops') { addTroops(rw.val, c.x, c.z); addText(c.x, 2, c.z, '+' + rw.val, '#7fc8ff'); }
    else if (rw.type === 'weapon') upgradeWeapon(c.x, c.z);
    else if (rw.type === 'strike') { G.strike = 1; addText(c.x, 2, c.z, 'AIRSTRIKE READY', '#ffc83d'); }
    else { G.coinsRun += rw.val * coinMul(); addText(c.x, 2, c.z, '+' + Math.round(rw.val * coinMul()) + ' ●', '#ffc83d'); Sound.coin(); }
  }
}
function upgradeWeapon(x, z) {
  if (G.tier >= 5) { addTroops(8, x, z); return; }
  G.tier++; Sound.upgrade(); haptic([10, 30, 10]);
  addText(x, 2.4, z, WEAPONS[G.tier].name.toUpperCase() + '!', '#ffc83d');
  banner(WEAPONS[G.tier].name, 'Weapon upgraded', false, 1.4);
}
function burst(x, y, z, col, n, sp) {
  for (let i = 0; i < n; i++) { const a = rnd(0, TAU); G.parts.push({ x, y, z, vx: Math.cos(a) * rnd(1, sp), vy: rnd(2, 6), vz: Math.sin(a) * rnd(1, sp), life: rnd(0.35, 0.7), max: 0.7, col, size: rnd(0.07, 0.16) }); }
}
function addText(x, y, z, txt, col) { if (G.texts.length > 30) G.texts.shift(); G.texts.push({ x, y, z, txt, col, life: 1.1 }); }

function passGate(g) {
  g.pair.passed = true; g.taken = true;
  const before = G.n;
  if (g.op === 'W') { upgradeWeapon(g.side * ROAD / 2, g.z); return; }
  let after = before;
  if (g.op === '+') after = before + g.val; else if (g.op === '-') after = before - g.val;
  else if (g.op === 'x') after = before * g.val; else if (g.op === '/') after = Math.floor(before / g.val);
  const good = after >= before;
  if (good) { addTroops(after - before, g.side * ROAD / 2, g.z); Sound.gateGood(g.op === 'x'); haptic(12); }
  else { loseTroops(before - after, 'gate'); Sound.gateBad(); }
  addText(g.side * ROAD / 2, 3, g.z, (good ? '+' : '−') + Math.abs(after - before), good ? '#7fc8ff' : '#ff6a5a');
}
function gateStep() { return 9 * hpMul(diff()); }
function shootGate(g, dmg) {
  g.prog += dmg; g.flash = 0.06;
  if (g.op === '/' ) { if (g.prog > gateStep() * expSquad(diff()) * 0.5) { g.op = 'x'; g.val = 2; g.prog = 0; g.pop = 1; Sound.tick2(); } return; }
  if (g.op !== '+' && g.op !== '-') return;
  while (g.prog >= gateStep()) {
    g.prog -= gateStep(); g.pop = 1;
    if (g.op === '-') { g.val--; if (g.val <= 0) { g.op = '+'; g.val = 1; Sound.gateGood(false); } }
    else if (g.val < (g.cap ??= Math.max(g.val, Math.round(expSquad(diff()) * 0.9)))) g.val++;
    else { g.prog = 0; break; }
  }
}

// ---------------- abilities ----------------
function useStrike() {
  if (G.strike < 1 || G.over || G.state !== 'play') return;
  G.strike = 0; Sound.jet(); haptic([20, 40, 20]);
  G.jet = { t: 0 };
  const targets = G.zombies.filter(z => !z.dead && z.z > G.z + 4 && z.z < G.z + 45).sort((a, b) => b.hp - a.hp);
  for (let i = 0; i < 7; i++) {
    let x, z;
    const tz = targets[i * 3 % Math.max(1, targets.length)];
    if (G.boss && i < 3) { x = G.boss.x + rnd(-1, 1); z = G.boss.z - 1; }
    else if (tz) { x = tz.x; z = tz.z - G.speed * 0.6; }
    else { x = rnd(-ROAD + 1, ROAD - 1); z = G.z + rnd(14, 38); }
    G.bombs.push({ x, z, t: -0.35 - i * 0.12 });
  }
}
function useShield() {
  if (!hqLv('shield') || G.shieldCd > 0 || G.over || G.state !== 'play') return;
  G.shieldT = 2 + hqLv('shield'); G.shieldCd = 22; Sound.shield(); haptic(20);
}

// ---------------- bosses ----------------
function spawnBoss() {
  const idx = (G.mode === 'endless' ? G.bossesBeaten : G.stage - 1) % 3, T = BOSS_TYPES[idx];
  const d = diff(), hp = 55 * expSquad(d) * T.hp * Math.pow(hpMul(d), 0.9) * Math.max(1, Math.pow(G.n / (2 * expSquad(d)), 0.6))
    * Math.pow(WEAPONS[G.tier].dmg * WEAPONS[G.tier].rate * dmgMul() * rofMul() / 2.2, 0.35);
  G.boss = { ...T, x: 0, z: G.z + 46, hp, max: hp, t: 0, atk: 3, flash: 0, w: 2.2, chewT: 0, dead: false, deadT: 0 };
  banner(T.name, G.mode === 'endless' ? 'Boss incoming' : 'Final wave', true, 2.2);
  Sound.roar(); Sound.setMusic(true, 2); haptic([60, 40, 60]);
  G.zombies.forEach(z => { if (z.z > G.z + 30) z.dead = true; });
}
function bossDamage(dmg) {
  const b = G.boss; if (!b || b.dead) return;
  b.hp -= dmg; b.flash = 0.06;
  if (b.hp <= 0) {
    b.hp = 0; b.dead = true; b.deadT = 0; G.slow = 0.25; G.slowT = 1.2; G.flash = 0.7;
    for (let i = 0; i < 4; i++) setTimeout(() => explode(b.x + rnd(-2, 2), b.z + rnd(-1, 1), 3, 0, true), i * 160);
    G.coinsRun += (40 + diff() * 12) * coinMul();
    G.bossesBeaten++; save.stats.bosses++;
    Sound.roar();
  }
}
function updateBoss(dt) {
  const b = G.boss; if (!b) return;
  if (b.dead) {
    b.deadT += dt / Math.max(0.25, G.slow);
    if (b.deadT > 1.6) {
      G.boss = null; Sound.setMusic(true, 0);
      if (G.mode === 'endless' || G.mode === 'demo') { G.nextBossZ = G.z + 560; G.genZ = Math.max(G.genZ, G.z + 30); banner('Boss down', 'Keep running', false, 1.6); Sound.win(); }
      else endRun(true);
    }
    return;
  }
  b.t += dt; b.flash -= dt;
  const dz = b.z - G.z;
  b.z -= (dz > 10 ? 1.6 : 0.6) * dt;
  b.x = lerp(b.x, clamp(G.x, -ROAD + b.w, ROAD - b.w), dt * 0.35);
  b.atk -= dt;
  if (b.atk <= 0) {
    Sound.warn();
    if (b.kind === 'titan') { b.atk = 3.6; G.hazards.push({ kind: 'rock', x: G.x + rnd(-0.6, 0.6), z: G.z + G.speed * 1.4 + 0.5, r: 2.1, t: 0, land: 1.4, fromX: b.x, fromZ: b.z }); }
    else if (b.kind === 'mech') { b.atk = 3.4; const n = 3 + Math.min(2, Math.floor(diff() / 4)); for (let i = 0; i < n; i++) G.hazards.push({ kind: 'missile', x: i === 0 ? G.x : rnd(-ROAD + 1, ROAD - 1), z: G.z + G.speed * 1.6 + rnd(-1, 3), r: 1.6, t: -i * 0.15, land: 1.6 }); }
    else { b.atk = 3.8; for (let i = 0; i < 5 + Math.floor(diff()); i++) spawnZombie('runner', b.x + rnd(-2, 2), b.z - 1 - rnd(0, 2), diff()); G.hazards.push({ kind: 'acid', x: G.x, z: G.z + G.speed * 1.3, r: 1.8, t: 0, land: 1.3, fromX: b.x, fromZ: b.z }); }
  }
  // contact
  if (dz < G.RZ + 1.5) {
    b.z = G.z + G.RZ + 1.5;
    if (G.shieldT <= 0) { b.chewT -= dt; if (b.chewT <= 0) { b.chewT = 0.12; loseTroops(1, 'boss'); } }
  }
}

// ---------------- main update ----------------
function update(rawDt) {
  if (G.slowT > 0) { G.slowT -= rawDt; if (G.slowT <= 0) G.slow = 1; }
  const dt = rawDt * G.slow;
  G.time += dt;
  // steering
  const k = Input.keys, kx = (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0);
  if (G.mode === 'demo') G.tx = Math.sin(G.time * 0.5) * 3 + Math.sin(G.time * 1.3) * 1;
  else { G.tx += Input.dx * (ROAD * 2.4 / Math.max(320, W)) + kx * 11 * rawDt; }
  Input.dx = 0;
  G.tx = clamp(G.tx, -ROAD, ROAD);
  G.x = lerp(G.x, G.tx, Math.min(1, rawDt * 14));
  const lim = Math.max(0, ROAD - G.R * 0.85); G.x = clamp(G.x, -lim, lim);
  // advance
  const target = G.boss ? 0.8 : G.over ? 0 : G.baseSpeed;
  G.speed = lerp(G.speed, target, Math.min(1, dt * 2));
  G.z += G.speed * dt;
  if (!G.boss && G.z >= G.nextBossZ - 4 && !G.over && G.mode !== 'demo') spawnBoss();
  spawnEvents();
  // soldiers
  for (const s of G.soldiers) { s.ox = lerp(s.ox, s.tox, Math.min(1, dt * 6)); s.oz = lerp(s.oz, s.toz, Math.min(1, dt * 6)); s.ph += dt * 12; }
  G.shownN = lerp(G.shownN, G.n, Math.min(1, dt * 10)); G.badgePop *= Math.pow(0.02, dt); G.badgeBad *= Math.pow(0.02, dt);
  // firing
  if (!G.over && G.n > 0) {
    const W0 = WEAPONS[G.tier], total = G.n * W0.rate * rofMul();
    const cap = save.settings.quality === 'low' ? 30 : 55, vis = Math.min(total, cap), per = W0.dmg * dmgMul() * total / vis;
    G.fireAcc += vis * dt;
    while (G.fireAcc >= 1 && G.soldiers.length) {
      G.fireAcc--;
      const s = G.soldiers[Math.floor(Math.random() * G.soldiers.length)];
      G.bullets.push({ x: G.x + s.ox + 0.12, z: G.z + s.oz + 0.3, pz: G.z + s.oz, dmg: per, pierce: W0.pierce, hit: null, life: 0.95 });
      if (Math.random() < 0.3) Sound.shot(G.tier);
    }
  }
  // bullets
  const BS = 58;
  for (const b of G.bullets) {
    b.pz = b.z; b.z += BS * dt; b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    for (const g of G.gates) {
      if (g.pair.passed || b.dead) continue;
      if (b.pz <= g.z && b.z >= g.z && Math.sign(b.x || 1) === g.side && (b.gateRoll ??= Math.random()) < 0.5) { shootGate(g, b.dmg * 2); b.dead = true; }
    }
    if (b.dead) continue;
    for (const c of G.crates) if (!c.dead && b.pz <= c.z + 0.5 && b.z >= c.z - 0.5 && Math.abs(b.x - c.x) < 0.8) { hitCrate(c, b.dmg); b.dead = true; break; }
    if (b.dead) continue;
    for (const br of G.barrels) if (!br.dead && b.pz <= br.z + 0.4 && b.z >= br.z - 0.4 && Math.abs(b.x - br.x) < 0.55) { br.hp -= b.dmg; br.flash = 0.06; b.dead = true; break; }
    if (b.dead) continue;
    if (G.boss && !G.boss.dead && b.z >= G.boss.z - 0.8 && Math.abs(b.x - G.boss.x) < G.boss.w) { bossDamage(b.dmg); b.dead = true; if (Math.random() < 0.15) Sound.hit(); continue; }
    for (const zb of G.zombies) {
      if (zb.dead || zb === b.hit) continue;
      if (b.pz <= zb.z + zb.r && b.z >= zb.z - zb.r && Math.abs(b.x - zb.x) < zb.r + 0.08) {
        damageZombie(zb, b.dmg); b.hit = zb;
        if (b.pierce-- <= 0) { b.dead = true; break; }
      }
    }
  }
  G.bullets = G.bullets.filter(b => !b.dead);
  // gates
  for (const g of G.gates) {
    g.flash -= dt; g.pop *= Math.pow(0.01, dt);
    if (!g.pair.passed && G.z >= g.z && !G.over) {
      const side = G.x >= 0 ? 1 : -1;
      const chosen = G.gates.find(o => o.pair === g.pair && o.side === side);
      if (chosen) passGate(chosen);
    }
  }
  G.gates = G.gates.filter(g => g.z > G.z - 8);
  // crates & barrels collide with squad
  for (const c of G.crates) if (!c.dead && c.z - G.z < 0.6 && c.z - G.z > -1 && Math.abs(c.x - G.x) < G.R + 0.6) { c.dead = true; burst(c.x, 0.8, c.z, '#b07a3c', 12, 4); Sound.crate(); if (G.shieldT <= 0) loseTroops(Math.round(3 + diff()), 'crate'); }
  for (const b of G.barrels) {
    b.flash -= dt;
    if (!b.dead && (b.hp <= 0 || (b.z - G.z < 0.5 && Math.abs(b.x - G.x) < G.R + 0.4))) { b.dead = true; explode(b.x, b.z, 3.2, 120 * hpMul(diff()), true); }
  }
  G.crates = G.crates.filter(c => !c.dead && c.z > G.z - 6);
  G.barrels = G.barrels.filter(b => !b.dead && b.z > G.z - 6);
  // zombies
  for (const zb of G.zombies) {
    if (zb.dead) continue;
    const T = ZTYPES[zb.type]; zb.flash -= dt; zb.ph += dt * zb.speed * 2.2;
    const dz = zb.z - G.z;
    if (zb.type === 'spitter' && dz < 24 && dz > 6) {
      zb.spitT -= dt;
      if (zb.spitT <= 0) { zb.spitT = rnd(2.6, 3.6); G.hazards.push({ kind: 'acid', x: G.x + rnd(-0.8, 0.8), z: G.z + G.speed * 1.2, r: 1.25, t: 0, land: 1.2, fromX: zb.x, fromZ: zb.z }); }
      zb.z += G.speed * dt * 0.6;
    } else if (!zb.attached) zb.z -= zb.speed * dt;
    const track = zb.type === 'runner' ? 1.6 : 0.9;
    if (dz < 30) zb.x += clamp(G.x - zb.x, -1, 1) * track * dt;
    zb.x = clamp(zb.x, -ROAD + 0.3, ROAD - 0.3);
    if (G.mode === 'demo' && dz < G.R) { zb.dead = true; continue; }
    // contact
    const reach = G.RZ + zb.r;
    if (dz < reach && dz > -G.RZ && Math.abs(zb.x - G.x) < G.R + zb.r * 0.5 && !G.over) {
      if (G.shieldT > 0) { if (zb.type === 'brute') { zb.z = G.z + reach + 0.5; damageZombie(zb, 20 * dt * 60 / 60); } else { killZombie(zb); } continue; }
      if (zb.type === 'brute') {
        zb.attached = true; zb.z = G.z + reach - 0.05;
        zb.chewT -= dt; if (zb.chewT <= 0) { zb.chewT = 1 / T.chew; loseTroops(1, 'brute'); }
        // the whole squad piles onto a brute that grabs it
        damageZombie(zb, G.n * 1.2 * WEAPONS[G.tier].dmg * dmgMul() * dt);
      } else { zb.dead = true; loseTroops(T.kills, zb.type); burst(zb.x, 0.6, zb.z, T.col, 5, 3); if (zb.type === 'exploder') explode(zb.x, zb.z, 1.6, 20, false, 0.5); }
    }
    if (dz < -4) zb.dead = true;
  }
  G.zombies = G.zombies.filter(z => !z.dead);
  // hazards (acid, rocks, missiles)
  for (const h of G.hazards) {
    h.t += dt;
    if (h.t >= h.land && !h.done) {
      h.done = true;
      const frac = soldiersInCircle(h.x, h.z, h.r);
      if (h.kind === 'missile' || h.kind === 'rock') explode(h.x, h.z, h.r, 25 * hpMul(diff()), h.kind === 'rock', 0.45);
      else { burst(h.x, 0.3, h.z, '#9cff4a', 16, 4); if (frac > 0 && G.shieldT <= 0) loseTroops(Math.ceil(frac * G.n * 0.5), 'acid'); G.splats.push({ x: h.x, z: h.z, r: h.r * 0.8, col: '#6fbf2a', a: 0 }); Sound.zdie(); }
    }
  }
  G.hazards = G.hazards.filter(h => !h.done && h.z > G.z - 6);
  // airstrike bombs
  for (const b of G.bombs) { b.t += dt; if (b.t >= 0 && !b.done) { b.done = true; explode(b.x, b.z, 3.2, 140 * hpMul(diff()) * (1 + 0.25 * hqLv('strike')), true); } }
  G.bombs = G.bombs.filter(b => !b.done);
  if (G.jet) { G.jet.t += dt; if (G.jet.t > 1.6) G.jet = null; }
  updateBoss(dt);
  // abilities
  G.shieldT -= dt; G.shieldCd -= dt;
  if (G.mode === 'demo') G.strike = 0;
  // fx
  for (const p of G.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (!p.smoke && !p.ring) { p.vy -= 22 * dt; if (p.y < 0) { p.y = 0; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; } } }
  G.parts = G.parts.filter(p => p.life > 0);
  if (G.parts.length > 500) G.parts.splice(0, G.parts.length - 500);
  for (const t of G.texts) { t.life -= dt; t.y += dt * 1.6; }
  G.texts = G.texts.filter(t => t.life > 0);
  G.splats = G.splats.filter(s => s.z > G.z - 10);
  G.shake *= Math.pow(0.01, rawDt); G.flash -= rawDt;
  if (G.mode !== 'demo') {
    G.maxN = Math.max(G.maxN, G.n);
    if (G.mode === 'endless' && Math.floor(G.z / 10) > save.endless && !G.recShown && save.endless > 30) { G.recShown = true; banner('New record', 'Farther than ever', false, 1.6); }
    tutorialTick();
  }
}
