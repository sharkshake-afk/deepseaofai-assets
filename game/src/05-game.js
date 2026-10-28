// ============================================================
//  Game state & simulation
// ============================================================
const G = {
  state: 'title', mode: 'demo', zen: true, demo: true, mod: null,
  world: null, P: null, S: null,
  creatures: [], pickups: [], parts: [], projs: [], texts: [], bolts: [], inks: [], schools: new Map(),
  boss: null, arena: null, bossIdx: 0,
  t: 0, freeze: 0, shake: 0, flash: 0, flashCol: '#ff4a5a',
  cam: { x: 0, y: 0, zoom: 1, vw: 500, vh: 900 },
  sonar: null, zone: 0, nextPearlY: 600, loreSpawned: {}, pendingPicks: 0, rerolls: 0,
  stats: null, hintQ: [], over: false, recordShown: false,
};

const xpFor = l => Math.round(10 + 7 * l + 1.5 * l * l);

function makePlayer() {
  return {
    x: 0, y: 160, vx: 0, vy: 40, ang: Math.PI / 2, r: 11, lvl: 1, xp: 0, xpNext: xpFor(1),
    light: 100, maxLight: 100, muts: {}, dashT: 0, dashCd: 0, sonarCd: 0, inv: 0, combo: 0, comboT: 0,
    revives: metaLv('phoenix'), heartUsed: false, zapT: 1, droneHit: 0, trail: [], lookX: 0, lookY: 0,
    spd: 0, inkT: 0, wasLow: false, maxY: 160, facing: 1,
  };
}

function calcStats() {
  const P = G.P, m = id => P.muts[id] || 0, mod = G.mod;
  const S = {
    speed: 175 * (1 + 0.12 * m('fins')) * (mod === 'swift' ? 1.2 : 1),
    lightR: 235 * (1 + 0.2 * m('lantern')) * (mod === 'dim' ? 0.75 : 1),
    eat: 0.92 * (1 + 0.09 * m('jaws')) * (1 + 0.15 * m('apex')),
    dmgTaken: (1 - Math.min(0.7, 0.12 * m('hide'))) * (mod === 'glass' ? 1.4 : 1),
    drain: (1 - 0.12 * m('core')) * (1 - 0.06 * metaLv('eff')) * (mod === 'dim' ? 0.7 : 1),
    maxLight: 100 + 12 * metaLv('hull') + 20 * m('reserve'),
    dashCd: 2.3 * Math.pow(0.82, m('jet')) * (1 - 0.08 * metaLv('jet')),
    dashDmg: 24 * (1 + 0.3 * m('jet')) * (mod === 'glass' ? 2 : 1),
    sonarCd: 12 * Math.pow(0.8, m('echo')) * (1 - 0.1 * metaLv('sonar')),
    sonarR: 430 * (1 + 0.25 * m('echo')), stun: 1.7 + 0.45 * m('echo'),
    magnet: 70 * (1 + 0.6 * m('magnet')),
    zap: m('zap'), zapCd: 2.6 * Math.pow(0.8, Math.max(0, m('zap') - 1)), zapDmg: 12 + 7 * m('zap'), chain: m('chain'),
    drones: m('drones'), ink: m('ink'), blood: 1 + 0.3 * m('blood'),
    comboWin: (2.0 + 0.7 * m('frenzy')) * (mod === 'frenzy' ? 2 : 1), comboXp: 0.1 + 0.12 * m('frenzy'),
    spines: m('spines'), bloom: (1 + 0.3 * m('bloom')) * (mod === 'bloom' ? 2 : 1), nova: m('nova'), xpMul: 1 + 0.2 * m('apex'),
  };
  if (P.maxLight !== S.maxLight) { P.light += Math.max(0, S.maxLight - P.maxLight); P.maxLight = S.maxLight; P.light = Math.min(P.light, P.maxLight); }
  G.S = S;
}

function newRun(mode) {
  const seed = mode === 'daily' ? hashStr('lumen-' + todayKey()) : (Math.random() * 1e9) | 0;
  G.mode = mode; G.demo = mode === 'demo'; G.zen = mode === 'zen' || mode === 'demo';
  G.mod = mode === 'daily' ? dailyMod().id : null;
  G.world = makeWorld(seed); G.rng = mulberry32(seed ^ 0x9e3779b9);
  G.creatures = []; G.pickups = []; G.parts = []; G.projs = []; G.texts = []; G.bolts = []; G.inks = []; G.schools = new Map();
  G.boss = null; G.arena = null; G.bossIdx = 0; G.sonar = null; G.freeze = 0; G.shake = 0; G.flash = 0;
  G.loreSpawned = {}; G.pendingPicks = 0; G.over = false; G.recordShown = false; G.hintQ = []; G.time = 0;
  G.P = makePlayer(); G.P.maxLight = 0; calcStats(); G.P.light = G.P.maxLight;
  G.rerolls = 1 + metaLv('reroll');
  G.stats = { eaten: 0, maxCombo: 0, pearls: 0, hits: 0, kills: 0, codex: [], lore: 0, bosses: 0 };
  G.nextPearlY = 500;
  if (!G.demo) {
    G.pendingPicks = metaLv('gene');
    if (mode === 'classic' && metaLv('express') && save.bosses.kraken) {
      const a = G.world.arenas[0];
      G.P.y = a.y1 + 150; G.P.maxY = G.P.y; G.bossIdx = 1; G.pendingPicks += 5;
      for (let i = 0; i < 4; i++) levelUp(true);
    }
  }
  const [l, r] = G.world.walls(G.P.y); G.P.x = (l + r) / 2;
  G.cam.x = G.P.x; G.cam.y = G.P.y; G.zone = zoneAt(toM(G.P.y));
  Sound.setZone(G.zone); Sound.boss(false);
  // seed the starting waters
  for (let i = 0; i < 14; i++) spawnPlanktonCluster(true);
  for (let i = 0; i < 10; i++) spawnCreature(true);
}

// ---------- spawning ----------
function viewBand() { const c = G.cam; return { top: c.y - c.vh * 0.5, bot: c.y + c.vh * 0.5, left: c.x - c.vw * 0.5, right: c.x + c.vw * 0.5 }; }
function randomSpawnPoint(anywhere) {
  const c = G.cam, v = viewBand();
  for (let k = 0; k < 8; k++) {
    let y;
    if (anywhere) y = rnd(v.top - 200, v.bot + c.vh * 0.6);
    else y = Math.random() < 0.72 ? rnd(v.bot + 40, v.bot + c.vh * 0.7) : rnd(v.top - c.vh * 0.4, v.top - 40);
    if (Math.random() < 0.25 && !anywhere) y = rnd(v.top, v.bot);
    y = Math.max(60, y);
    const [l, r] = G.world.walls(y);
    const x = rnd(l + 40, r - 40);
    if (!anywhere && x > v.left - 30 && x < v.right + 30 && y > v.top - 30 && y < v.bot + 30) continue;
    if (G.boss && G.arena && (y < G.arena.y0 + 120 || y > G.arena.y1 - 120)) continue;
    return [x, y];
  }
  return null;
}
function speciesFor(m) {
  const list = []; let tot = 0;
  for (const k in SPECIES) {
    const s = SPECIES[k]; if (s.boss || !s.w) continue;
    if (m < s.zone[0] || m > s.zone[1]) continue;
    let w = s.w; const edgeIn = clamp((m - s.zone[0]) / 120, 0.15, 1); w *= edgeIn;
    if (G.boss && !(s.rel[1] < 0.95)) continue;
    if (G.zen && s.beh === 'turret') continue;
    if (G.mod === 'bloom' && s.dmg) w *= 1.4;
    list.push([k, w]); tot += w;
  }
  let r = Math.random() * tot;
  for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
  return list.length ? list[0][0] : 'sardine';
}
function makeCreature(type, x, y, gid) {
  const s = SPECIES[type], P = G.P;
  let rel = rnd(s.rel[0], s.rel[1]);
  if (G.mod === 'big') rel *= 1.2;
  const r = Math.max(5, P.r * rel);
  return {
    type, x, y, vx: rnd(-20, 20), vy: rnd(-20, 20), r, ang: rnd(0, TAU), t: rnd(0, 10), ph: rnd(0, TAU),
    hp: r * (s.mech ? 3.2 : 2.2), maxHp: r * (s.mech ? 3.2 : 2.2), st: 0, stT: rnd(0, 2), stun: 0, reveal: 0, flash: 0,
    wa: rnd(0, TAU), gid, ox: rnd(-30, 30), oy: rnd(-20, 20), stam: 3, rest: 0, cd: rnd(1, 3), biteCd: 0, hitCd: 0, droneCd: 0,
    edible: false, threat: false, seen: false, flip: false, aimX: 0, aimY: 0, spd: s.speed * (G.mod === 'swift' ? 1.25 : 1),
  };
}
function spawnCreature(anywhere, forceType) {
  const p = randomSpawnPoint(anywhere); if (!p) return;
  const m = toM(p[1]);
  const type = forceType || speciesFor(m), s = SPECIES[type];
  if (s.group) {
    const n = rndi(s.group[0], s.group[1]), gid = Math.random();
    G.schools.set(gid, { ang: rnd(0, TAU), x: p[0], y: p[1], flee: 0 });
    for (let i = 0; i < n; i++) G.creatures.push(makeCreature(type, p[0] + rnd(-40, 40), p[1] + rnd(-30, 30), gid));
  } else G.creatures.push(makeCreature(type, p[0], p[1]));
}
function spawnPlanktonCluster(anywhere) {
  const p = randomSpawnPoint(anywhere); if (!p) return;
  const n = rndi(4, 11), col = pick(toM(p[1]) > 3000 ? ['#ff9adf', '#b98cff', '#9fffe0'] : ['#9ff9ff', '#c8ffd8', '#fff3b0']);
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996, rr = Math.sqrt(i) * 9; // fibonacci spiral
    G.pickups.push({ kind: 'pl', x: p[0] + Math.cos(a) * rr, y: p[1] + Math.sin(a) * rr, vx: 0, vy: 0, r: 2.4, ph: rnd(0, TAU), col, val: 1 });
  }
}
function dropOrbs(x, y, n, val, col = '#9ff9ff') {
  for (let i = 0; i < n; i++) { const a = rnd(0, TAU), s = rnd(40, 150); G.pickups.push({ kind: 'orb', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 4.5, ph: rnd(0, TAU), col, val }); }
}
function dropPearls(x, y, n) {
  for (let i = 0; i < n; i++) { const a = rnd(0, TAU), s = rnd(30, 110); G.pickups.push({ kind: 'pearl', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 6, ph: rnd(0, TAU), val: 1 }); }
}

function manageSpawns(dt) {
  const P = G.P, m = toM(P.y), v = viewBand(), c = G.cam;
  // cull far things
  const farY = c.vh * 1.9;
  G.creatures = G.creatures.filter(cr => Math.abs(cr.y - c.y) < farY || cr.type === 'squidling');
  G.pickups = G.pickups.filter(p => p.kind === 'shard' || Math.abs(p.y - c.y) < farY);
  let target = G.boss ? 6 : Math.round(12 + Math.min(16, m / 140));
  if (G.mod === 'bloom') target = Math.round(target * 1.3);
  const nonMinion = G.creatures.reduce((n, cr) => n + (cr.type === 'squidling' ? 0 : 1), 0);
  if (nonMinion < target && Math.random() < dt * 6) spawnCreature(false);
  const pl = G.pickups.reduce((n, p) => n + (p.kind === 'pl' ? 1 : 0), 0);
  if (pl < 70 * G.S.bloom && Math.random() < dt * 5 * G.S.bloom) spawnPlanktonCluster(false);
  // pearls
  if (P.maxY > G.nextPearlY) {
    G.nextPearlY = P.maxY + rnd(700, 1500) / (G.mod === 'rich' ? 3 : 1);
    const y = P.maxY + c.vh * 0.7, [l, r] = G.world.walls(y);
    if (!(G.boss && G.arena)) G.pickups.push({ kind: 'pearl', x: rnd(l + 50, r - 50), y, vx: 0, vy: 0, r: 6, ph: 0, val: 1 });
  }
  // transmissions
  if (!G.demo) LORE.forEach((L, i) => {
    if (save.lore[i] || G.loreSpawned[i]) return;
    const y = L.m * 10;
    if (y < P.maxY + c.vh * 0.9 && y > P.maxY - 200) {
      G.loreSpawned[i] = true;
      const [l, r] = G.world.walls(y);
      G.pickups.push({ kind: 'shard', x: lerp(l, r, rnd(0.3, 0.7)), y, vx: 0, vy: 0, r: 9, ph: 0, idx: i });
    }
  });
}

// ---------- steering ----------
function steer(c, dx, dy, speed, k, dt) {
  const d = Math.hypot(dx, dy) || 1, tx = dx / d * speed, ty = dy / d * speed, f = Math.min(1, k * dt);
  c.vx += (tx - c.vx) * f; c.vy += (ty - c.vy) * f;
}
function wallAvoid(c) {
  const [l, r] = G.world.walls(c.y); let ax = 0, ay = 0;
  if (c.x - l < 90) ax += (90 - (c.x - l)) * 3;
  if (r - c.x < 90) ax -= (90 - (r - c.x)) * 3;
  if (c.y < 80) ay += (80 - c.y) * 3;
  if (G.boss && G.arena) { if (c.y < G.arena.y0 + 140) ay += 200; if (c.y > G.arena.y1 - 140) ay -= 200; }
  return [ax, ay];
}
function collideWalls(o, bounce = 0.3) {
  const [l, r] = G.world.walls(o.y), rr = o.r * 0.8;
  if (o.x < l + rr) { o.x = l + rr; o.vx = Math.abs(o.vx) * bounce; return true; }
  if (o.x > r - rr) { o.x = r - rr; o.vx = -Math.abs(o.vx) * bounce; return true; }
  return false;
}

function updateSchools(dt) {
  const acc = new Map();
  for (const c of G.creatures) if (c.gid) { const a = acc.get(c.gid) || [0, 0, 0]; a[0] += c.x; a[1] += c.y; a[2]++; acc.set(c.gid, a); }
  for (const [gid, s] of G.schools) {
    const a = acc.get(gid); if (!a) { G.schools.delete(gid); continue; }
    s.x = a[0] / a[2]; s.y = a[1] / a[2];
    s.ang += rnd(-1, 1) * dt * 1.5;
    const [l, r] = G.world.walls(s.y);
    if (s.x - l < 120) s.ang = lerp(s.ang, 0, dt * 2); else if (r - s.x < 120) s.ang = lerp(s.ang, Math.PI, dt * 2);
    if (s.flee > 0) s.flee -= dt;
  }
}

function updateCreature(c, dt) {
  const s = SPECIES[c.type], P = G.P, S = G.S;
  c.t += dt; c.biteCd -= dt; c.hitCd -= dt; c.droneCd -= dt; c.flash -= dt; c.reveal -= dt;
  const dx = P.x - c.x, dy = P.y - c.y, d = Math.hypot(dx, dy) || 1;
  c.edible = c.r < P.r * S.eat * (P.dashT > 0 ? 1.12 : 1);
  c.threat = !c.edible && !!s.dmg && !G.zen;
  const frac = P.light / P.maxLight;
  const detect = P.inkT > 0 ? 0 : 150 + S.lightR * (0.4 + 0.6 * frac) * 0.95;
  if (c.stun > 0) { c.stun -= dt; c.vx *= 1 - 3 * dt; c.vy *= 1 - 3 * dt; }
  else {
    const [ax, ay] = wallAvoid(c);
    const fleeing = c.edible && d < 210 && !G.demo;
    const wander = (sp) => { c.wa += rnd(-1, 1) * dt * 2.5; steer(c, Math.cos(c.wa) * 100 + ax, Math.sin(c.wa) * 100 + ay, sp, 1.5, dt); };
    const flee = (sp) => steer(c, -dx / d * 100 + ax * 0.6, -dy / d * 100 + ay * 0.6, sp, 3, dt);
    switch (s.beh) {
      case 'school': {
        const sc = G.schools.get(c.gid);
        if (fleeing) { flee(c.spd * 1.5); if (sc) { sc.ang = Math.atan2(-dy, -dx); sc.flee = 1; } }
        else if (sc) {
          const tx = sc.x + c.ox - c.x + Math.cos(sc.ang) * 60, ty = sc.y + c.oy - c.y + Math.sin(sc.ang) * 60;
          steer(c, tx + ax, ty + ay, c.spd * (sc.flee > 0 ? 1.3 : 0.6), 2.2, dt);
        } else wander(c.spd * 0.5);
        break;
      }
      case 'flee': if (fleeing) flee(c.spd * 1.55); else wander(c.spd * 0.45); break;
      case 'crawl': wander(c.spd * 0.6); break;
      case 'drift': {
        c.stT -= dt;
        if (c.stT <= 0) { c.stT = rnd(1.8, 3); c.vy -= 45; c.vx += rnd(-15, 15); }
        c.vy += 14 * dt; c.vx *= 1 - 0.5 * dt; c.vy *= 1 - 0.6 * dt; c.vx += ax * dt * 0.3; c.vy += ay * dt * 0.3;
        break;
      }
      case 'charger': {
        if (c.edible) { if (fleeing) flee(c.spd * 1.4); else wander(c.spd * 0.5); c.st = 0; break; }
        c.stT -= dt;
        if (c.st === 0) {
          wander(c.spd * 0.55);
          if (c.threat && d < detect && d > 50 && c.stT <= 0) { c.st = 1; c.stT = 0.7; Sound.warn(); }
        } else if (c.st === 1) {
          c.vx *= 1 - 4 * dt; c.vy *= 1 - 4 * dt; c.aimX = dx / d; c.aimY = dy / d; c.ang = Math.atan2(dy, dx);
          if (c.stT <= 0) { c.st = 2; c.stT = 0.75; c.vx = c.aimX * c.spd * 3.8; c.vy = c.aimY * c.spd * 3.8; }
        } else if (c.st === 2) {
          if (c.stT <= 0) { c.st = 3; c.stT = 1.8; }
          if (Math.random() < 0.5) addPart('streak', c.x, c.y, -c.vx * 0.1, -c.vy * 0.1, 0.3, 2, '#d6e4ea');
        } else { wander(c.spd * 0.4); if (c.stT <= 0) { c.st = 0; c.stT = 0.5; } }
        break;
      }
      case 'lure': {
        if (c.edible) { if (fleeing) flee(c.spd * 1.2); else wander(c.spd * 0.3); c.st = 0; break; }
        c.stT -= dt;
        const lx = c.x + Math.cos(c.ang) * c.r * 1.5, ly = c.y + Math.sin(c.ang) * c.r * 1.5;
        const dl = Math.hypot(P.x - lx, P.y - ly);
        if (c.st === 0) {
          c.wa += rnd(-1, 1) * dt; steer(c, Math.cos(c.wa) * 40 + ax, Math.sin(c.wa) * 40 + ay, c.spd * 0.3, 1, dt);
          if (c.threat && (dl < c.r * 1.6 + 70 || d < c.r * 2.2) && c.stT <= 0) { c.st = 1; c.stT = 0.45; c.vx = dx / d * c.spd * 4.2; c.vy = dy / d * c.spd * 4.2; }
        } else if (c.st === 1) { if (c.stT <= 0) { c.st = 2; c.stT = 2; } }
        else { c.vx *= 1 - 2 * dt; c.vy *= 1 - 2 * dt; if (c.stT <= 0) c.st = 0; }
        break;
      }
      case 'hunter': {
        if (c.edible) { if (fleeing) flee(c.spd * 1.3); else wander(c.spd * 0.45); break; }
        const always = c.type === 'squidling';
        if (c.rest > 0) { c.rest -= dt; c.st = 0; wander(c.spd * 0.3); }
        else if (c.threat && (d < detect || (always && P.inkT <= 0))) {
          c.stam -= dt; c.st = 1;
          const lead = d / (c.spd * 1.5);
          steer(c, dx + P.vx * lead * 0.5 + ax * 0.5, dy + P.vy * lead * 0.5 + ay * 0.5, c.spd * (c.type === 'gulper' ? 0.95 : 1.05), 2.4, dt);
          if (c.stam <= 0) { c.rest = always ? 1.2 : 2; c.stam = always ? 3 : 4; }
        } else {
          c.st = 0; c.stam = Math.min(always ? 3 : 4, c.stam + dt * 0.8);
          wander(c.spd * 0.4);
        }
        break;
      }
      case 'turret': {
        if (c.edible) { if (fleeing) flee(c.spd * 1.3); else wander(c.spd * 0.4); break; }
        if (c.threat && d < 560 && P.inkT <= 0) {
          const want = d > 320 ? 1 : d < 220 ? -1 : 0, px = -dy / d, py = dx / d;
          steer(c, dx / d * want * 100 + px * 60 + ax, dy / d * want * 100 + py * 60 + ay, c.spd, 2, dt);
          c.cd -= dt;
          if (c.st === 0 && c.cd <= 0.5) { c.st = 1; }
          if (c.cd <= 0) {
            c.st = 0; c.cd = rnd(1.9, 2.8);
            const sp = 220 + toM(c.y) * 0.01;
            G.projs.push({ x: c.x, y: c.y, vx: dx / d * sp, vy: dy / d * sp, r: 6, life: 4, dmg: s.dmg, col: '#ff3b5c' });
            Sound.laser();
          }
        } else { c.st = 0; wander(c.spd * 0.5); }
        break;
      }
    }
  }
  c.x += c.vx * dt; c.y += c.vy * dt;
  if (c.y < 30) { c.y = 30; c.vy = Math.abs(c.vy); }
  collideWalls(c);
  if (G.boss && G.arena && c.type !== 'squidling') c.y = clamp(c.y, G.arena.y0 + 60, G.arena.y1 - 60);
  const sp = Math.hypot(c.vx, c.vy);
  if (sp > 6 && !(s.beh === 'charger' && c.st === 1)) {
    const ta = Math.atan2(c.vy, c.vx); c.ang += angDiff(c.ang, ta) * Math.min(1, dt * 6);
  }
  c.flip = Math.cos(c.ang) < 0;
  // discovery
  if (!c.seen && d < S.lightR * 0.85) { c.seen = true; discover(c.type); }
}

function discover(type) {
  if (G.demo || save.codex[type]) return;
  save.codex[type] = 1; G.stats.codex.push(type); persist();
  toast(SPECIES[type].boss ? '⚠️' : '🔎', 'New species', SPECIES[type].name);
  if (CODEX_ORDER.every(k => save.codex[k])) unlock('codex');
}

// ---------- player ----------
function hurtPlayer(dmg, sx, sy) {
  const P = G.P, S = G.S;
  if (P.inv > 0 || P.dashT > 0 || G.zen || G.over) return false;
  dmg *= S.dmgTaken * (1 + toM(P.y) / 5000);
  P.light -= dmg; P.inv = 0.9; G.stats.hits++;
  const dx = P.x - sx, dy = P.y - sy, d = Math.hypot(dx, dy) || 1;
  P.vx += dx / d * 380; P.vy += dy / d * 380;
  G.shake = Math.max(G.shake, 10); G.flash = 0.35; G.flashCol = '#ff2e4a'; G.freeze = 0.06;
  Sound.hurt(); haptic([30, 40, 30]);
  for (let i = 0; i < 12; i++) addPart('dot', P.x, P.y, rnd(-160, 160), rnd(-160, 160), rnd(0.3, 0.7), rnd(2, 4), '#6ff7ff');
  addText(P.x, P.y - P.r * 2, '-' + Math.round(dmg), '#ff6a7a', 15);
  P.combo = 0;
  if (S.ink) {
    G.inks.push({ x: P.x, y: P.y, r: 70 + 25 * S.ink, t: 0, life: 2.4 + S.ink * 0.6 });
    P.inkT = 2 + S.ink * 0.8; P.inv += 0.35 * S.ink;
  }
  return true;
}
function gainXp(x) {
  const P = G.P; if (G.demo) return;
  P.xp += x * G.S.xpMul;
  while (P.xp >= P.xpNext) { P.xp -= P.xpNext; levelUp(false); }
}
function levelUp(silent) {
  const P = G.P;
  P.lvl++; P.xpNext = xpFor(P.lvl); P.r = Math.min(34, 11 + (P.lvl - 1) * 0.6);
  if (!silent) {
    G.pendingPicks++; Sound.levelup(); haptic([15, 30, 15]);
    addPart('ring', P.x, P.y, 0, 0, 0.7, 120, '#ff6ad5');
    P.light = Math.min(P.maxLight, P.light + 15);
    if (P.lvl >= 20) unlock('lv20');
  }
}
function addCombo() {
  const P = G.P; P.combo++; P.comboT = G.S.comboWin;
  if (P.combo > G.stats.maxCombo) G.stats.maxCombo = P.combo;
  if (P.combo >= 10) unlock('combo10');
  if (P.combo >= 25) unlock('combo25');
}
const depthMul = () => 1 + toM(G.P.y) / 700;
const comboMul = () => 1 + Math.floor(G.P.combo / 5) * (0.25 + G.S.comboXp);

function eatCreature(c) {
  const P = G.P, s = SPECIES[c.type];
  c.dead = true; G.stats.eaten++; addCombo();
  const rel = c.r / P.r;
  P.light = Math.min(P.maxLight, P.light + s.food * (0.7 + rel * 0.6) * G.S.blood);
  const xp = s.xp * (0.6 + rel * 0.7) * depthMul() * comboMul();
  gainXp(xp);
  Sound.eat(P.combo); Sound.bite(); haptic(8);
  G.freeze = Math.max(G.freeze, rel > 0.7 ? 0.035 : 0);
  for (let i = 0; i < 10; i++) addPart('dot', c.x, c.y, rnd(-120, 120), rnd(-120, 120), rnd(0.25, 0.6), rnd(1.5, 3.5), s.glow || '#bff9ff');
  addPart('ring', c.x, c.y, 0, 0, 0.35, c.r * 2.2, s.glow || '#bff9ff');
  addText(c.x, c.y - 10, '+' + Math.max(1, Math.round(xp)), P.combo >= 5 ? '#ffd27a' : '#bff9ff', P.combo >= 5 ? 15 : 12);
  if (s.pearls) { dropPearls(c.x, c.y, s.pearls); unlock('dumbo'); }
  if (G.stats.eaten >= 150) unlock('glutton');
}
function damageCreature(c, dmg, src) {
  if (c.dead) return;
  c.hp -= dmg; c.flash = 0.12;
  addText(c.x, c.y - c.r, Math.round(dmg), '#ffffff', 11);
  if (c.hp <= 0) killCreature(c, src);
}
function killCreature(c, src) {
  const s = SPECIES[c.type];
  c.dead = true; G.stats.kills++;
  const n = clamp(Math.round(c.r / 6), 2, 9), val = s.food * (0.5 + c.r / G.P.r * 0.5) / n;
  dropOrbs(c.x, c.y, n, val, s.glow || '#9ff9ff');
  gainXp(s.xp * 0.5 * depthMul());
  if (s.pearls) dropPearls(c.x, c.y, s.pearls);
  for (let i = 0; i < 18; i++) addPart('dot', c.x, c.y, rnd(-200, 200), rnd(-200, 200), rnd(0.3, 0.8), rnd(2, 4), s.glow || '#ffffff');
  addPart('ring', c.x, c.y, 0, 0, 0.5, c.r * 3, '#ffffff');
  Sound.kill(); G.shake = Math.max(G.shake, 5);
  if (src === 'ram' && s.dmg) unlock('ram');
}

function doDash() {
  const P = G.P, S = G.S;
  let dx = Input.mag > 0.15 ? Input.x : Math.cos(P.ang), dy = Input.mag > 0.15 ? Input.y : Math.sin(P.ang);
  if (G.demo) { dx = Math.cos(P.ang); dy = Math.sin(P.ang); }
  const sp = S.speed * 3.3;
  P.vx = dx * sp; P.vy = dy * sp; P.dashT = 0.27; P.dashCd = S.dashCd; P.inv = Math.max(P.inv, 0.32);
  Sound.dash(); haptic(10);
  for (let i = 0; i < 10; i++) addPart('bubble', P.x, P.y, -dx * rnd(40, 120) + rnd(-30, 30), -dy * rnd(40, 120) + rnd(-30, 30), rnd(0.5, 1.2), rnd(1.5, 4), '#bff9ff');
}
function novaBlast() {
  const P = G.P, R = 140 + 25 * G.S.nova, dmg = 16 * G.S.nova;
  addPart('ring', P.x, P.y, 0, 0, 0.45, R, '#ffd27a'); G.shake = Math.max(G.shake, 6);
  for (const c of G.creatures) {
    const d = Math.hypot(c.x - P.x, c.y - P.y);
    if (d < R + c.r) { if (!c.edible) damageCreature(c, dmg, 'nova'); const k = 300 / (d || 1); c.vx += (c.x - P.x) * k; c.vy += (c.y - P.y) * k; c.stun = Math.max(c.stun, 0.5); }
  }
  if (G.boss) bossAreaHit(P.x, P.y, R, dmg * 1.5);
}
function doSonar() {
  const P = G.P;
  G.sonar = { x: P.x, y: P.y, t: 0, R: G.S.sonarR, hit: new Set() };
  const bp = bossPoint();
  if (bp) { const d = Math.hypot(bp[0] - P.x, bp[1] - P.y) - bp[2]; if (d < G.sonar.R + 260) G.sonar.bossAt = clamp(d, 0, G.sonar.R); }
  P.sonarCd = G.S.sonarCd; Sound.sonar(); haptic([5, 30, 5]);
}
function zapTick(dt) {
  const P = G.P, S = G.S;
  if (!S.zap) return;
  P.zapT -= dt; if (P.zapT > 0) return;
  let best = null, bd = 210 + S.zap * 10;
  for (const c of G.creatures) { if (c.dead) continue; const d = Math.hypot(c.x - P.x, c.y - P.y) - c.r; if (d < bd) { bd = d; best = c; } }
  let target = best, from = [P.x, P.y], dmg = S.zapDmg;
  if (!target && G.boss) { const bp = bossPoint(); if (bp && Math.hypot(bp[0] - P.x, bp[1] - P.y) < 260) { G.bolts.push({ a: from, b: bp, life: 0.18 }); bossDamage(dmg, 'zap'); Sound.zap(); P.zapT = S.zapCd; return; } }
  if (!target) { P.zapT = 0.3; return; }
  const hit = new Set();
  for (let k = 0; k <= S.chain && target; k++) {
    hit.add(target); G.bolts.push({ a: from, b: [target.x, target.y], life: 0.18 });
    if (target.edible && target.r < P.r * 0.8) eatCreature(target); else damageCreature(target, dmg, 'zap');
    from = [target.x, target.y]; dmg *= 0.75;
    let nb = null, nd = 170;
    for (const c of G.creatures) { if (c.dead || hit.has(c)) continue; const d = Math.hypot(c.x - from[0], c.y - from[1]); if (d < nd) { nd = d; nb = c; } }
    target = nb;
  }
  Sound.zap(); P.zapT = S.zapCd;
}

function updatePlayer(dt) {
  const P = G.P, S = G.S;
  P.dashCd -= dt; P.sonarCd -= dt; P.inv -= dt; P.inkT -= dt;
  const wasDash = P.dashT > 0; P.dashT -= dt;
  if (wasDash && P.dashT <= 0 && S.nova) novaBlast();
  // input
  let ix = Input.x, iy = Input.y, mag = Input.mag;
  if (G.demo) { const a = demoBrain(dt); ix = a[0]; iy = a[1]; mag = a[2]; }
  const acts = Input.consume();
  if (!G.demo) {
    if (acts.d && P.dashCd <= 0) doDash();
    if (acts.s && P.sonarCd <= 0) doSonar();
  }
  if (P.dashT <= 0) {
    const max = S.speed * (0.25 + 0.75 * mag);
    const f = Math.min(1, dt * 4.2);
    if (mag > 0.05) { P.vx += (ix * max - P.vx) * f; P.vy += (iy * max - P.vy) * f; }
    else { P.vx *= 1 - dt * 1.6; P.vy *= 1 - dt * 1.6; P.vy += 6 * dt; }
  }
  P.x += P.vx * dt; P.y += P.vy * dt;
  if (P.y < 14) { P.y = 14; P.vy = Math.max(0, P.vy); }
  if (collideWalls(P, 0.4) && P.dashT > 0) { G.shake = Math.max(G.shake, 4); }
  if (G.boss && G.arena) {
    const top = G.arena.y0 + 40, bot = G.arena.y1 - 40;
    if (P.y < top + P.r) { P.y = top + P.r; P.vy = Math.abs(P.vy) * 0.5; }
    if (P.y > bot - P.r) { P.y = bot - P.r; P.vy = -Math.abs(P.vy) * 0.5; }
  }
  P.spd = Math.hypot(P.vx, P.vy);
  if (P.spd > 8) { const ta = Math.atan2(P.vy, P.vx); P.ang += angDiff(P.ang, ta) * Math.min(1, dt * 8); }
  P.lookX = lerp(P.lookX, clamp(P.vx / 200, -1, 1) * 0.8, dt * 5); P.lookY = lerp(P.lookY, clamp(P.vy / 200, -1, 1) * 0.8, dt * 5);
  P.trail.push([P.x, P.y]); if (P.trail.length > 22) P.trail.shift();
  if (Math.random() < dt * (2 + P.spd / 60)) addPart('bubble', P.x - Math.cos(P.ang) * P.r, P.y - Math.sin(P.ang) * P.r, rnd(-10, 10), rnd(-30, -10), rnd(1, 2.2), rnd(1, 2.5), '#bff9ff');
  // combo
  if (P.combo > 0) { P.comboT -= dt; if (P.comboT <= 0) P.combo = 0; }
  // light drain
  const m = toM(P.y);
  if (!G.zen) {
    let drain = (0.8 + Math.min(1.9, m / 1700)) * S.drain;
    if (G.boss) drain *= 0.55;
    P.light -= drain * dt;
  } else P.light = P.maxLight;
  const frac = P.light / P.maxLight;
  if (frac < 0.05) P.wasLow = true;
  if (P.wasLow && frac > 0.5) { unlock('close'); P.wasLow = false; }
  if (P.light <= 0) playerDown();
  // depth tracking
  if (P.y > P.maxY) P.maxY = P.y;
  const md = toM(P.maxY);
  if (!G.demo) {
    if (md >= 100) unlock('d100'); if (md >= 200) unlock('d200'); if (md >= 1000) unlock('d1000'); if (md >= 10000) unlock('d10000');
    if (md >= 500 && G.stats.hits === 0 && !G.zen) unlock('clean');
    const best = G.zen ? save.bestZen : G.mode === 'daily' ? (save.daily.date === todayKey() ? save.daily.best : 0) : save.best;
    if (!G.recordShown && best > 50 && md > best) { G.recordShown = true; banner('New record', 'Deeper than ever', false, 2.2); Sound.pearl(); }
    if (save.settings && !save.tutorial) tutorialTick();
  }
  const z = zoneAt(m);
  if (z !== G.zone) {
    G.zone = z; Sound.setZone(z);
    if (!G.demo && z > 0) { banner(ZONES[z].name, ZONES[z].m + ' m', false, 3); Sound.zone(); }
  }
  Sound.setDepth(m);
}
function playerDown() {
  const P = G.P;
  if (G.demo || G.over) { P.light = P.maxLight; return; }
  const revive = (amt, label) => {
    P.light = P.maxLight * amt; P.inv = 2.5; G.flash = 0.8; G.flashCol = '#ffffff';
    addPart('ring', P.x, P.y, 0, 0, 0.8, 320, '#ffffff'); banner(label, 'Light rekindled', false, 2);
    for (const c of G.creatures) { const d = Math.hypot(c.x - P.x, c.y - P.y); if (d < 320) { c.stun = 2; const k = 400 / (d || 1); c.vx += (c.x - P.x) * k; c.vy += (c.y - P.y) * k; } }
    Sound.levelup();
  };
  if (P.muts.heart && !P.heartUsed) { P.heartUsed = true; revive(0.6, 'Second heart'); return; }
  if (P.revives > 0) { P.revives--; revive(0.5, 'Phoenix protocol'); return; }
  gameOver();
}

// ---------- autopilot for the title screen ----------
function demoBrain(dt) {
  const P = G.P; let tx = 0, ty = 1, best = 1e9;
  for (const c of G.creatures) {
    const d = Math.hypot(c.x - P.x, c.y - P.y);
    if (c.r < P.r * 0.9 && d < best && d < 400) { best = d; tx = c.x - P.x; ty = c.y - P.y; }
  }
  if (best > 1e8) for (const p of G.pickups) { const d = Math.hypot(p.x - P.x, p.y - P.y); if (d < best && d < 300) { best = d; tx = p.x - P.x; ty = p.y - P.y + 40; } }
  const [l, r] = G.world.walls(P.y);
  if (P.x - l < 120) tx += 200; if (r - P.x < 120) tx -= 200;
  ty += 60; // always drift deeper
  const d = Math.hypot(tx, ty) || 1;
  if (P.y > 22000) { P.y = 160; P.maxY = 160; G.creatures = []; G.pickups = []; } // loop the demo
  return [tx / d, ty / d, 0.55];
}

// ---------- particles & texts ----------
function addPart(type, x, y, vx, vy, life, size, col) {
  if (G.parts.length > 420) G.parts.shift();
  G.parts.push({ type, x, y, vx, vy, life, max: life, size, col });
}
function addText(x, y, txt, col, size) { if (G.texts.length > 40) G.texts.shift(); G.texts.push({ x, y, txt, col, size, life: 0.9, vy: -50 }); }

// ---------- per-frame simulation ----------
function update(dt) {
  G.t += dt;
  if (G.freeze > 0) { G.freeze -= dt; return; }
  const P = G.P, S = G.S;
  if (!G.demo) G.time += dt;
  Input.update();
  if (!G.over) updatePlayer(dt);
  if (!Number.isFinite(P.x + P.y + P.vx + P.vy)) { // never let a numeric glitch end a run
    [P.x, P.y] = P.safe || [0, 200]; P.vx = 0; P.vy = 0;
    console.warn('player NaN recovered', G.boss && G.boss.kind, G.boss && G.boss.st);
  } else P.safe = [P.x, P.y];
  if (G.zen && !G.demo && G.time >= 600) unlock('zen');
  updateSchools(dt);
  // creatures
  for (const c of G.creatures) {
    if (c.dead) continue;
    updateCreature(c, dt);
    if (!Number.isFinite(c.x + c.y + c.vx + c.vy)) { c.dead = true; continue; }
    const d = Math.hypot(c.x - P.x, c.y - P.y) || 0.01, touch = P.r * 0.95 + c.r * 0.85;
    if (d < touch && !G.over) {
      if (c.edible) eatCreature(c);
      else if (P.dashT > 0 && c.hitCd <= 0) {
        c.hitCd = 0.35; c.stun = Math.max(c.stun, 0.5);
        const k = 320 / d; c.vx += (c.x - P.x) * k; c.vy += (c.y - P.y) * k;
        P.vx *= -0.35; P.vy *= -0.35; G.freeze = 0.05; G.shake = Math.max(G.shake, 6); Sound.hit(); haptic(20);
        for (let i = 0; i < 8; i++) addPart('streak', c.x, c.y, rnd(-220, 220), rnd(-220, 220), 0.3, 2, '#ffffff');
        damageCreature(c, S.dashDmg, 'ram');
      } else if (c.threat && c.biteCd <= 0 && c.stun <= 0) {
        c.biteCd = 1;
        const s = SPECIES[c.type];
        if (hurtPlayer(s.dmg * (0.75 + 0.25 * Math.min(2, c.r / P.r)), c.x, c.y) && S.spines) {
          damageCreature(c, 22 * S.spines, 'spines'); c.stun = 1.2;
        }
      } else {
        const k = (touch - d) / d * 0.5; P.x += (P.x - c.x) * k; P.y += (P.y - c.y) * k;
      }
    }
  }
  if (G.creatures.some(c => c.dead)) G.creatures = G.creatures.filter(c => !c.dead);
  // drones
  if (S.drones) {
    for (let i = 0; i < S.drones; i++) {
      const a = G.t * 2.4 + i * TAU / S.drones, rr = P.r * 2.6 + 26, x = P.x + Math.cos(a) * rr, y = P.y + Math.sin(a) * rr;
      for (const c of G.creatures) {
        if (c.dead || c.droneCd > 0) continue;
        if (Math.hypot(c.x - x, c.y - y) < c.r + 7) { c.droneCd = 0.5; if (c.edible && c.r < P.r * 0.6) eatCreature(c); else damageCreature(c, 7 + 2 * S.drones, 'drone'); addPart('dot', x, y, 0, 0, 0.2, 4, '#b8ffe6'); }
      }
      for (const p of G.pickups) if (p.kind === 'pl' && Math.hypot(p.x - x, p.y - y) < 26) { p.vx += (P.x - p.x) * 3; p.vy += (P.y - p.y) * 3; }
      if (G.boss && P.droneHit <= 0 && bossTouches(x, y, 8)) { bossDamage(6 + 2 * S.drones, 'drone'); P.droneHit = 0.4; }
    }
    P.droneHit -= dt;
  }
  zapTick(dt);
  // sonar
  if (G.sonar) {
    const so = G.sonar; so.t += dt; const R = so.t * 900;
    for (const c of G.creatures) {
      if (so.hit.has(c)) continue;
      if (Math.hypot(c.x - so.x, c.y - so.y) < R) { so.hit.add(c); c.stun = Math.max(c.stun, S.stun); c.reveal = 3.2; if (SPECIES[c.type].beh === 'charger') c.st = 3; }
    }
    if (so.bossAt !== undefined && !so.bossHit && R >= so.bossAt) { so.bossHit = true; bossSonar(); }
    if (R > so.R) G.sonar = null;
  }
  // pickups
  for (const p of G.pickups) {
    p.ph += dt;
    const dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy) || 1;
    const mag = p.kind === 'pearl' || p.kind === 'shard' ? G.S.magnet * 1.4 + 40 : G.S.magnet + P.r;
    if (d < mag) { const f = (1 - d / mag) * 900 + 120; p.vx += dx / d * f * dt; p.vy += dy / d * f * dt; }
    else if (p.kind === 'pl') { p.vx += Math.sin(G.t * 0.8 + p.ph) * 4 * dt; p.vy += Math.cos(G.t * 0.6 + p.ph) * 4 * dt; }
    p.vx *= 1 - 2.2 * dt; p.vy *= 1 - 2.2 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (d < P.r + p.r + 3 && !G.over) collect(p);
  }
  if (G.pickups.some(p => p.dead)) G.pickups = G.pickups.filter(p => !p.dead);
  // projectiles
  for (const q of G.projs) {
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.homing) { const dx = P.x - q.x, dy = P.y - q.y, d = Math.hypot(dx, dy) || 1; q.vx += dx / d * q.homing * dt; q.vy += dy / d * q.homing * dt; }
    const [l, r] = G.world.walls(q.y); if (q.x < l || q.x > r) q.life = 0;
    if (Math.hypot(q.x - P.x, q.y - P.y) < q.r + P.r * 0.8) { if (hurtPlayer(q.dmg, q.x, q.y)) q.life = 0; else if (P.dashT > 0) { q.life = 0; addPart('ring', q.x, q.y, 0, 0, 0.3, 20, q.col); } }
    if (Math.random() < 0.5) addPart('dot', q.x, q.y, rnd(-10, 10), rnd(-10, 10), 0.3, q.r * 0.6, q.col);
  }
  G.projs = G.projs.filter(q => q.life > 0);
  // fx
  for (const p of G.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.type === 'bubble') { p.vy -= 30 * dt; p.vx *= 1 - dt; } else if (p.type !== 'ring') { p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt; } }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const t of G.texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= 1 - 2 * dt; }
  G.texts = G.texts.filter(t => t.life > 0);
  for (const b of G.bolts) b.life -= dt; G.bolts = G.bolts.filter(b => b.life > 0);
  for (const k of G.inks) k.t += dt; G.inks = G.inks.filter(k => k.t < k.life);
  // bosses
  bossTick(dt);
  manageSpawns(dt);
  G.shake *= Math.pow(0.02, dt); G.flash -= dt;
  if (G.pendingPicks > 0 && G.state === 'play' && !G.demo && !G.over) openLevelUp();
}

function collect(p) {
  const P = G.P; p.dead = true;
  if (p.kind === 'pl') { P.light = Math.min(P.maxLight, P.light + 0.9); gainXp(0.5 * depthMul()); Sound.plankton(); if (P.combo > 0) P.comboT = Math.max(P.comboT, 0.6); }
  else if (p.kind === 'orb') { P.light = Math.min(P.maxLight, P.light + p.val * G.S.blood); gainXp(p.val * 0.8 * depthMul()); Sound.plankton(); }
  else if (p.kind === 'pearl') {
    if (G.demo) return;
    const n = 1 + metaLv('diver') * 0.2, whole = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
    save.pearls += whole; save.stats.pearlsTotal += whole; G.stats.pearls += whole; persist();
    addText(p.x, p.y - 12, '+' + whole + ' pearl' + (whole > 1 ? 's' : ''), '#ffd27a', 13);
    Sound.pearl(); haptic(12);
    if (save.stats.pearlsTotal >= 300) unlock('rich');
  } else if (p.kind === 'shard') {
    save.lore[p.idx] = 1; G.stats.lore++; persist();
    transmission(p.idx); Sound.shard(); haptic([10, 40, 10]);
    addPart('ring', p.x, p.y, 0, 0, 0.8, 160, '#ff6ad5');
    gainXp(20 * depthMul());
    if (LORE.every((_, i) => save.lore[i])) unlock('lore');
  }
}

function unlock(id) {
  if (G.demo || save.ach[id]) return;
  save.ach[id] = 1; persist();
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (a) toast(a.icon, 'Achievement', a.name);
}

// ---------- mutation offers ----------
function offerMutations() {
  const P = G.P, rng = G.mode === 'daily' ? G.rng : Math.random;
  const pool = MUTATIONS.filter(m => (P.muts[m.id] || 0) < m.max);
  const out = [];
  while (out.length < 3 && pool.length) {
    let tot = 0; const ws = pool.map(m => { const w = m.tier === 'epic' ? (P.lvl > 6 ? 2.2 : 0.8) : m.tier === 'rare' ? 5 : 10; tot += w; return w; });
    let r = rng() * tot, idx = 0;
    for (; idx < pool.length; idx++) { r -= ws[idx]; if (r <= 0) break; }
    out.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0]);
  }
  return out;
}
function applyMutation(id) {
  const P = G.P;
  P.muts[id] = (P.muts[id] || 0) + 1;
  if (id === 'chain' && !P.muts.zap) P.muts.zap = 1;
  if (id === 'reserve') P.light += 30;
  calcStats();
  P.light = Math.min(P.light, P.maxLight);
}
