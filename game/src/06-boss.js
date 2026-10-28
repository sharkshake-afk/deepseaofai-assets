// ============================================================
//  Guardians: Kraken Matriarch, Abyssal Leviathan, The Overmind
// ============================================================
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1);
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}

function startBoss(a) {
  const B = a.boss;
  const b = {
    kind: B.kind, name: B.name, tier: B.tier, hp: B.hp, maxHp: B.hp, t: 0, st: 'idle', stT: 2.2, flash: 0, stun: 0, hitCd: 0,
    cx: a.cx, cy: (a.y0 + a.y1) / 2, a, spdMul: Math.max(0.6, 1 - 0.1 * B.tier), dmgMul: 1 + 0.2 * B.tier, dying: false,
  };
  BOSS_AI[b.kind].init(b);
  G.boss = b; G.arena = a;
  G.creatures = G.creatures.filter(c => SPECIES[c.type].rel[1] < 0.95 && c.y > a.y0 + 60 && c.y < a.y1 - 60);
  banner(b.name, b.tier ? 'Echo guardian awakens' : 'Guardian process awakens', true, 3.2);
  Sound.roar(); Sound.boss(true); haptic([60, 60, 120]);
  G.shake = 16;
  discover('boss_' + b.kind);
  if (b.kind === 'overmind') setTimeout(() => hint('Its shield blocks everything. Ping it with SONAR, then strike.', 5), 3500);
  else if (!save.bosses[b.kind]) setTimeout(() => hint('Dash into the guardian to hurt it. Dodge the red warnings.', 4.5), 3500);
}
function finishBoss() {
  const b = G.boss, P = G.P, bp = bossPoint() || [b.x, b.y];
  const first = !save.bosses[b.kind];
  save.bosses[b.kind] = 1; G.stats.bosses++;
  unlock(b.kind);
  dropPearls(bp[0], bp[1], [15, 30, 50][Math.min(2, BOSSES.findIndex(x => x.kind === b.kind))] + b.tier * 20);
  dropOrbs(bp[0], bp[1], 24, 4, '#ffd27a');
  P.light = Math.min(P.maxLight, P.light + P.maxLight * 0.5);
  gainXp(160 * (1 + b.tier));
  G.boss = null; G.arena = null; G.bossIdx++;
  G.projs = []; G.creatures = G.creatures.filter(c => c.type !== 'squidling');
  Sound.boss(false); Sound.victory(); haptic([40, 40, 40, 40, 200]);
  banner('Guardian defeated', b.name, false, 3.2);
  G.flash = 0.6; G.flashCol = '#ffffff';
  persist();
  if (b.kind === 'overmind' && first) setTimeout(() => hint('The path to the Source is open. The descent never ends.', 5), 3600);
}

function bossTick(dt) {
  if (G.zen || G.demo) return;
  const P = G.P;
  if (!G.boss) {
    const a = G.world.arenas[G.bossIdx];
    if (a && P.y > a.y0 + 260) startBoss(a);
    return;
  }
  const b = G.boss;
  if (b.dying) {
    b.dyingT -= dt; b.t += dt;
    const bp = bossPoint() || [b.x, b.y];
    if (Math.random() < dt * 30) { const a = rnd(0, TAU), s = rnd(60, 260); addPart('dot', bp[0] + rnd(-60, 60), bp[1] + rnd(-60, 60), Math.cos(a) * s, Math.sin(a) * s, rnd(0.4, 1), rnd(3, 7), pick(['#ffffff', SPECIES['boss_' + b.kind].glow, '#ffd27a'])); }
    G.shake = Math.max(G.shake, 8);
    if (b.dyingT <= 0) { addPart('ring', bp[0], bp[1], 0, 0, 1, 500, '#ffffff'); finishBoss(); }
    return;
  }
  b.t += dt; b.flash -= dt; b.hitCd -= dt;
  if (b.stun > 0) { b.stun -= dt; }
  BOSS_AI[b.kind].update(b, dt * (b.stun > 0 ? 0.25 : 1));
  const bp = bossPoint();
  if (bp && !Number.isFinite(bp[0] + bp[1])) { console.warn('boss NaN'); b.x = b.cx; b.y = b.cy; if (b.segs) b.segs.forEach((sg, i) => { sg[0] = b.cx; sg[1] = b.cy + i * b.sp; }); }
}
function bossPoint() { const b = G.boss; if (!b) return null; return BOSS_AI[b.kind].point(b); }
function bossTouches(x, y, r) { const b = G.boss; if (!b || b.dying) return false; const p = bossPoint(); return Math.hypot(p[0] - x, p[1] - y) < r + p[2]; }
function bossAreaHit(x, y, R, dmg) { if (bossTouches(x, y, R)) bossDamage(dmg, 'nova'); }
function bossSonar() { const b = G.boss; if (!b || b.dying) return; b.stun = Math.max(b.stun, 1.1); if (BOSS_AI[b.kind].sonar) BOSS_AI[b.kind].sonar(b); }
function bossDamage(amt, src) {
  const b = G.boss; if (!b || b.dying) return;
  const p = bossPoint();
  const mul = BOSS_AI[b.kind].mul(b, src);
  if (mul <= 0) {
    if (src === 'ram') { addText(p[0], p[1] - p[2], 'SHIELDED', '#ff8a98', 14); Sound.hit(); }
    return;
  }
  amt *= mul; b.hp -= amt; b.flash = 0.1;
  addText(p[0] + rnd(-20, 20), p[1] - p[2] * 0.6, Math.round(amt), mul > 1 ? '#ffd27a' : '#ffffff', src === 'ram' ? 20 : 13);
  if (b.hp <= 0) { b.hp = 0; b.dying = true; b.dyingT = 1.8; Sound.roar(); G.shake = 20; G.projs = []; }
}
// circles: [x, y, r, dmg, weakMul]
function bossContact(b, circles) {
  const P = G.P, S = G.S;
  for (const c of circles) {
    const d = Math.hypot(P.x - c[0], P.y - c[1]);
    if (d > P.r * 0.9 + c[2]) continue;
    const nx = (P.x - c[0]) / (d || 1), ny = (P.y - c[1]) / (d || 1);
    if (P.dashT > 0) {
      if (b.hitCd <= 0) {
        b.hitCd = 0.3; G.freeze = 0.07; G.shake = Math.max(G.shake, 9); Sound.hit(); haptic(25);
        for (let i = 0; i < 12; i++) addPart('streak', P.x, P.y, rnd(-260, 260), rnd(-260, 260), 0.35, 2, '#ffffff');
        if (c[4] > 0) bossDamage(S.dashDmg * c[4] * 1.3, 'ram'); else bossDamage(0, 'ram');
      }
      P.vx = nx * 420; P.vy = ny * 420; P.dashT = 0;
    } else {
      hurtPlayer(c[3] * b.dmgMul, c[0], c[1]);
      P.x = c[0] + nx * (P.r * 0.9 + c[2] + 1); P.y = c[1] + ny * (P.r * 0.9 + c[2] + 1);
    }
    return;
  }
}
function nextAttack(b, list) { b.st = pick(list); b.stT = 0; b.phaseT = 0; }

const BOSS_AI = {
  // ---------------------------------------------------------- KRAKEN
  kraken: {
    init(b) {
      b.r = 64; b.x = b.cx; b.y = b.a.y0 + 880; b.homeY = b.y; b.vx = 0; b.vy = 0;
      b.tents = [];
      for (let i = 0; i < 8; i++) {
        const ba = -Math.PI / 2 + (i - 3.5) * 0.36;
        b.tents.push({ ba, mode: 'idle', t: 0, tx: b.x, ty: b.y, ax: 0, ay: 0, fromX: 0, fromY: 0 });
      }
      b.cool = 2.5;
    },
    point(b) { return [b.x, b.y, b.r]; },
    mul() { return 1; },
    base(b, tn) { return [b.x + Math.cos(tn.ba) * b.r * 0.75, b.y + Math.sin(tn.ba) * b.r * 0.75]; },
    idleTip(b, tn, i) {
      const [bx, by] = this.base(b, tn), a = tn.ba + Math.sin(b.t * 1.2 + i) * 0.35, L = 150 + Math.sin(b.t * 0.9 + i * 2) * 28;
      return [bx + Math.cos(a) * L, by + Math.sin(a) * L];
    },
    update(b, dt) {
      const P = G.P, p = b.hp / b.maxHp;
      // movement
      if (b.st === 'chargeWind') {
        b.phaseT += dt; b.x += rnd(-3, 3);
        if (b.phaseT > 0.75 * b.spdMul) { b.st = 'charging'; b.phaseT = 0; const dx = P.x - b.x, dy = P.y - b.y, d = Math.hypot(dx, dy) || 1; b.vx = dx / d * 560; b.vy = dy / d * 560; Sound.roar(); }
      } else if (b.st === 'charging') {
        b.phaseT += dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.phaseT > 0.7) { b.st = 'idle'; b.cool = 1.4 * b.spdMul; }
      } else {
        const tx = b.cx + Math.sin(b.t * 0.35) * 170, ty = b.homeY + Math.sin(b.t * 0.5) * 40;
        b.x = lerp(b.x, tx, dt * 0.8); b.y = lerp(b.y, ty, dt * 0.8);
      }
      const [l, r] = G.world.walls(b.y); b.x = clamp(b.x, l + b.r, r - b.r); b.y = clamp(b.y, b.a.y0 + 120 + b.r, b.a.y1 - 60 - b.r);
      // scheduler
      if (b.st === 'idle') {
        b.cool -= dt;
        if (b.cool <= 0) {
          const opts = ['slam', 'slam', 'charge'];
          if (G.creatures.filter(c => c.type === 'squidling').length < 4) opts.push('spawn');
          if (p < 0.6) opts.push('volley', 'slam');
          const pickd = pick(opts);
          if (pickd === 'slam') {
            const n = p > 0.6 ? 1 : p > 0.3 ? 2 : 3;
            const free = b.tents.filter(t => t.mode === 'idle');
            for (let k = 0; k < n && free.length; k++) {
              const tn = free.splice(Math.floor(Math.random() * free.length), 1)[0];
              const [bx, by] = this.base(b, tn), jx = k ? rnd(-90, 90) : 0, jy = k ? rnd(-90, 90) : 0;
              const dx = P.x + jx - bx, dy = P.y + jy - by, d = Math.hypot(dx, dy) || 1, reach = clamp(d + 120, 260, 680);
              tn.mode = 'aim'; tn.t = 0; tn.ax = bx + dx / d * reach; tn.ay = by + dy / d * reach;
            }
            Sound.warn(); b.cool = (p > 0.5 ? 2.0 : 1.5) * b.spdMul;
          } else if (pickd === 'charge') { b.st = 'chargeWind'; b.phaseT = 0; Sound.warn(); }
          else if (pickd === 'spawn') {
            G.inks.push({ x: b.x, y: b.y, r: 150, t: 0, life: 3.5 });
            for (let k = 0; k < 3; k++) { const c = makeCreature('squidling', b.x + rnd(-60, 60), b.y + rnd(-60, 60)); c.vx = rnd(-200, 200); c.vy = rnd(-260, -80); G.creatures.push(c); }
            discover('squidling'); b.cool = 2 * b.spdMul;
          } else if (pickd === 'volley') {
            for (let k = 0; k < 12; k++) { const a = k * TAU / 12 + b.t; G.projs.push({ x: b.x, y: b.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 7, life: 4, dmg: 11, col: '#ff8a5c' }); }
            Sound.laser(); b.cool = 2 * b.spdMul;
          }
        }
      }
      // tentacles
      b.tents.forEach((tn, i) => {
        tn.t += dt;
        const idle = this.idleTip(b, tn, i), [bx, by] = this.base(b, tn);
        if (tn.mode === 'idle') { tn.tx = lerp(tn.tx, idle[0], dt * 5); tn.ty = lerp(tn.ty, idle[1], dt * 5); }
        else if (tn.mode === 'aim') { tn.tx = lerp(tn.tx, bx + (bx - tn.ax) * 0.15, dt * 3); tn.ty = lerp(tn.ty, by + (by - tn.ay) * 0.15, dt * 3); if (tn.t > 0.85 * b.spdMul) { tn.mode = 'strike'; tn.t = 0; tn.fromX = tn.tx; tn.fromY = tn.ty; } }
        else if (tn.mode === 'strike') {
          const k = Math.min(1, tn.t / 0.16); tn.tx = lerp(tn.fromX, tn.ax, k); tn.ty = lerp(tn.fromY, tn.ay, k);
          if (k >= 1) { tn.mode = 'hold'; tn.t = 0; G.shake = Math.max(G.shake, 10); Sound.hurt(); for (let q = 0; q < 14; q++) addPart('bubble', tn.ax, tn.ay, rnd(-90, 90), rnd(-90, 90), rnd(0.5, 1), rnd(2, 5), '#ffd0c0'); }
        } else if (tn.mode === 'hold') { if (tn.t > 0.6) { tn.mode = 'retract'; tn.t = 0; } }
        else if (tn.mode === 'retract') { tn.tx = lerp(tn.tx, idle[0], dt * 4); tn.ty = lerp(tn.ty, idle[1], dt * 4); if (tn.t > 0.6) tn.mode = 'idle'; }
        if ((tn.mode === 'strike' || tn.mode === 'hold') && segDist(G.P.x, G.P.y, bx, by, tn.tx, tn.ty) < 15 + G.P.r * 0.7) hurtPlayer(16 * b.dmgMul, tn.tx, tn.ty);
      });
      bossContact(b, [[b.x, b.y, b.r * 0.9, b.st === 'charging' ? 26 : 18, 1]]);
    },
    draw(ctx, b) {
      const t = b.t, flash = b.flash > 0;
      b.tents.forEach((tn, i) => {
        const [bx, by] = this.base(b, tn);
        if (tn.mode === 'aim') {
          ctx.globalAlpha = 0.25 + 0.25 * Math.sin(tn.t * 30); ctx.strokeStyle = '#ff2e4a'; ctx.lineWidth = 30; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tn.ax, tn.ay); ctx.stroke(); ctx.globalAlpha = 1;
        }
        const mx = (bx + tn.tx) / 2 + Math.sin(t * 2 + i) * 30, my = (by + tn.ty) / 2 + Math.cos(t * 1.7 + i) * 30;
        let px = bx, py = by;
        for (let s = 1; s <= 14; s++) {
          const u = s / 14, x = (1 - u) * (1 - u) * bx + 2 * (1 - u) * u * mx + u * u * tn.tx, y = (1 - u) * (1 - u) * by + 2 * (1 - u) * u * my + u * u * tn.ty;
          ctx.strokeStyle = flash ? '#ffffff' : '#7a2a1c'; ctx.lineWidth = lerp(20, 3, u); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
          if (s % 2 === 0 && s < 13) { ctx.fillStyle = '#e8a090'; ctx.beginPath(); ctx.arc(x + 3, y + 3, lerp(4, 1.2, u), 0, TAU); ctx.fill(); }
          px = x; py = y;
        }
      });
      ctx.save(); ctx.translate(b.x, b.y);
      const g = ctx.createLinearGradient(0, -b.r, 0, b.r * 2.4); g.addColorStop(0, flash ? '#ffffff' : '#9a3424'); g.addColorStop(1, '#3a0e08');
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(-b.r, 0); ctx.bezierCurveTo(-b.r * 1.05, b.r * 1.4, -b.r * 0.35, b.r * 2.4, 0, b.r * 2.7 + Math.sin(t) * 6);
      ctx.bezierCurveTo(b.r * 0.35, b.r * 2.4, b.r * 1.05, b.r * 1.4, b.r, 0); ctx.arc(0, 0, b.r, 0, Math.PI, true); ctx.fill();
      ctx.fillStyle = 'rgba(255,170,140,.18)';
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(Math.sin(i * 7.1) * b.r * 0.6, b.r * (0.3 + (i % 5) * 0.4), 5 + (i % 3) * 3, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#5a1810'; ctx.beginPath(); ctx.ellipse(-b.r * 0.8, b.r * 2.1, 26, 12, -0.8 + Math.sin(t * 2) * 0.2, 0, TAU); ctx.ellipse(b.r * 0.8, b.r * 2.1, 26, 12, 0.8 - Math.sin(t * 2) * 0.2, 0, TAU); ctx.fill();
      for (const s of [-1, 1]) { ctx.fillStyle = '#f6e7c8'; ctx.beginPath(); ctx.ellipse(s * b.r * 0.45, -b.r * 0.1, 15, 12, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    },
    emit(ctx, b) {
      const P = G.P, ang = Math.atan2(P.y - b.y, P.x - b.x);
      for (const s of [-1, 1]) {
        const ex = b.x + s * b.r * 0.45, ey = b.y - b.r * 0.1;
        glow(ctx, ex, ey, 30, '#ff8a5c', b.st === 'chargeWind' ? 1 : 0.6); ctx.globalAlpha = 1;
        ctx.fillStyle = '#1a0503'; ctx.beginPath(); ctx.ellipse(ex + Math.cos(ang) * 5, ey + Math.sin(ang) * 4, 3, 9, 0, 0, TAU); ctx.fill();
      }
      for (let i = 0; i < 7; i++) glow(ctx, b.x + Math.sin(i * 2.3) * b.r * 0.55, b.y + b.r * (0.5 + i * 0.28), 9, '#ff8a5c', 0.35 + 0.3 * Math.sin(b.t * 3 + i));
    },
    lights(b, L) { L(b.x, b.y, 220, 0.5); },
  },
  // ---------------------------------------------------------- LEVIATHAN
  leviathan: {
    init(b) {
      b.segs = []; b.n = 36; b.sp = 21;
      for (let i = 0; i < b.n; i++) b.segs.push([b.cx, b.a.y0 + 980 + i * b.sp]);
      b.ang = -Math.PI / 2; b.speed = 230; b.orbA = 0; b.cool = 2.5; b.r = 30;
    },
    segR(b, i) { return 30 * (1 - i / (b.n + 6)) + 6; },
    point(b) { return [b.segs[0][0], b.segs[0][1], b.r]; },
    mul(b, src) { return b.st === 'stunned' ? 2 : 1; },
    update(b, dt) {
      const P = G.P, h = b.segs[0], p = b.hp / b.maxHp;
      let tx, ty, turn = 2.2, spd = 230;
      b.phaseT = (b.phaseT || 0) + dt;
      if (b.st === 'idle') {
        b.orbA += dt * 0.75;
        tx = b.cx + Math.cos(b.orbA) * 300; ty = b.cy + Math.sin(b.orbA) * 400;
        b.cool -= dt;
        if (b.cool <= 0) {
          const opts = ['lunge', 'lunge', 'barrage']; if (p < 0.65) opts.push('coil', 'lunge');
          nextAttack(b, opts); if (b.st === 'lunge') Sound.warn();
          if (b.st === 'coil') { b.coilA = Math.atan2(h[1] - P.y, h[0] - P.x); }
        }
      } else if (b.st === 'lunge') {
        if (b.phaseT < 0.9 * b.spdMul) { spd = 70; turn = 5; tx = P.x; ty = P.y; }
        else if (b.phaseT < 0.9 * b.spdMul + 0.8) {
          spd = 820; turn = 0.4; tx = h[0] + Math.cos(b.ang) * 100; ty = h[1] + Math.sin(b.ang) * 100;
          const [l, r] = G.world.walls(h[1]);
          if (h[0] < l + 40 || h[0] > r - 40 || h[1] < b.a.y0 + 90 || h[1] > b.a.y1 - 90) {
            b.st = 'stunned'; b.phaseT = 0; G.shake = 16; Sound.roar(); haptic(60);
            for (let q = 0; q < 26; q++) addPart('bubble', h[0], h[1], rnd(-160, 160), rnd(-160, 160), rnd(0.6, 1.2), rnd(2, 6), '#bfffee');
          }
        } else { b.st = 'idle'; b.cool = 1.4 * b.spdMul; tx = b.cx; ty = b.cy; }
      } else if (b.st === 'stunned') {
        spd = 0; tx = h[0] + Math.cos(b.ang); ty = h[1] + Math.sin(b.ang);
        if (b.phaseT > 1.9) { b.st = 'idle'; b.cool = 1 * b.spdMul; b.ang += Math.PI; }
      } else if (b.st === 'barrage') {
        tx = b.cx + Math.cos(b.orbA) * 300; ty = b.cy + Math.sin(b.orbA) * 400; b.orbA += dt * 0.5;
        if (!b.fired && b.phaseT > 0.5) {
          b.fired = true; const a0 = Math.atan2(P.y - h[1], P.x - h[0]), n = p < 0.5 ? 9 : 7;
          for (let k = 0; k < n; k++) { const a = a0 + (k - (n - 1) / 2) * 0.16; G.projs.push({ x: h[0], y: h[1], vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, r: 7, life: 4, dmg: 13, col: '#6fffe0' }); }
          Sound.laser();
        }
        if (b.phaseT > 1.2) { b.st = 'idle'; b.fired = false; b.cool = 1.6 * b.spdMul; }
      } else if (b.st === 'coil') {
        b.coilA += dt * 2.1; const R = lerp(360, 150, Math.min(1, b.phaseT / 3.4));
        tx = P.x + Math.cos(b.coilA) * R; ty = P.y + Math.sin(b.coilA) * R; turn = 5; spd = 380;
        if (b.phaseT > 4) { b.st = 'idle'; b.cool = 1.5 * b.spdMul; }
      }
      if (tx === undefined) { tx = b.cx; ty = b.cy; }
      const ta = Math.atan2(ty - h[1], tx - h[0]);
      b.ang += clamp(angDiff(b.ang, ta), -turn * dt, turn * dt);
      b.speed = lerp(b.speed, spd, Math.min(1, dt * 6));
      h[0] += Math.cos(b.ang) * b.speed * dt; h[1] += Math.sin(b.ang) * b.speed * dt;
      const [l, r] = G.world.walls(h[1]); h[0] = clamp(h[0], l + 30, r - 30); h[1] = clamp(h[1], b.a.y0 + 80, b.a.y1 - 80);
      for (let i = 1; i < b.n; i++) {
        const a = b.segs[i - 1], s = b.segs[i], dx = a[0] - s[0], dy = a[1] - s[1], d = Math.hypot(dx, dy) || 1;
        if (d > b.sp) { s[0] = a[0] - dx / d * b.sp; s[1] = a[1] - dy / d * b.sp; }
      }
      const circles = [[h[0], h[1], b.r, b.st === 'lunge' ? 28 : 22, b.st === 'stunned' ? 1 : 1]];
      for (let i = 2; i < b.n; i += 2) circles.push([b.segs[i][0], b.segs[i][1], this.segR(b, i) * 0.85, 13, 0.35]);
      bossContact(b, circles);
    },
    draw(ctx, b) {
      const flash = b.flash > 0;
      for (let i = b.n - 1; i >= 1; i--) {
        const s = b.segs[i], r = this.segR(b, i);
        ctx.fillStyle = flash ? '#ffffff' : i % 2 ? '#0f3038' : '#123a44';
        ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, TAU); ctx.fill();
        if (i % 3 === 0) { const a = Math.atan2(b.segs[i - 1][1] - s[1], b.segs[i - 1][0] - s[0]) + Math.PI / 2; ctx.fillStyle = '#0a2228'; ctx.beginPath(); ctx.moveTo(s[0] + Math.cos(a) * r, s[1] + Math.sin(a) * r); ctx.lineTo(s[0] + Math.cos(a) * (r + 12), s[1] + Math.sin(a) * (r + 12)); ctx.lineTo(s[0] + Math.cos(a - 0.5) * r, s[1] + Math.sin(a - 0.5) * r); ctx.fill(); }
      }
      const h = b.segs[0];
      ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(b.ang);
      const open = b.st === 'lunge' ? 0.5 : b.st === 'stunned' ? 0.2 : 0.15 + 0.1 * Math.sin(b.t * 3);
      ctx.fillStyle = flash ? '#ffffff' : '#164651';
      ctx.beginPath(); ctx.moveTo(-26, -28); ctx.quadraticCurveTo(30, -34, 52, -6 - open * 30); ctx.lineTo(10, 0); ctx.lineTo(52, 6 + open * 30); ctx.quadraticCurveTo(30, 34, -26, 28); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8fff8';
      for (let k = 0; k < 6; k++) { const x = 14 + k * 6; ctx.beginPath(); ctx.moveTo(x, -4 - open * 30 * (x / 52)); ctx.lineTo(x + 2, 4 - open * 30 * (x / 52)); ctx.lineTo(x + 4, -4 - open * 30 * (x / 52)); ctx.fill(); ctx.beginPath(); ctx.moveTo(x, 4 + open * 30 * (x / 52)); ctx.lineTo(x + 2, -4 + open * 30 * (x / 52)); ctx.lineTo(x + 4, 4 + open * 30 * (x / 52)); ctx.fill(); }
      ctx.strokeStyle = '#2a6a70'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(20, -20); ctx.quadraticCurveTo(40, -50, 70, -44 + Math.sin(b.t * 3) * 8); ctx.moveTo(20, 20); ctx.quadraticCurveTo(40, 50, 70, 44 + Math.sin(b.t * 3 + 1) * 8); ctx.stroke();
      ctx.restore();
    },
    emit(ctx, b) {
      for (let i = 2; i < b.n; i += 2) { const s = b.segs[i]; glow(ctx, s[0], s[1], this.segR(b, i) * 0.9, '#6fffe0', 0.3 + 0.25 * Math.sin(b.t * 4 - i * 0.4)); }
      const h = b.segs[0], lw = b.st === 'lunge' && b.phaseT < 0.9 ? 1 : 0.7;
      for (const s of [-1, 1]) { const ex = h[0] + Math.cos(b.ang) * 14 + Math.cos(b.ang + s * Math.PI / 2) * 16, ey = h[1] + Math.sin(b.ang) * 14 + Math.sin(b.ang + s * Math.PI / 2) * 16; glow(ctx, ex, ey, 22, b.st === 'stunned' ? '#ffd27a' : '#6fffe0', lw); ctx.globalAlpha = 1; dot(ctx, ex, ey, 4, '#ffffff'); }
      if (b.st === 'stunned') { ctx.globalAlpha = 0.9; for (let k = 0; k < 3; k++) { const a = b.t * 5 + k * TAU / 3; dot(ctx, h[0] + Math.cos(a) * 44, h[1] - 40 + Math.sin(a) * 10, 4, '#ffd27a'); } }
    },
    lights(b, L) { L(b.segs[0][0], b.segs[0][1], 200, 0.5); for (let i = 6; i < b.n; i += 8) L(b.segs[i][0], b.segs[i][1], 110, 0.3); },
  },
  // ---------------------------------------------------------- OVERMIND
  overmind: {
    init(b) { b.x = b.cx; b.y = b.cy; b.r = 60; b.shieldDown = 0; b.waves = []; b.beams = null; b.cool = 2.5; b.spiral = 0; },
    point(b) { return [b.x, b.y, b.r]; },
    mul(b) { return b.shieldDown > 0 ? 1 : 0; },
    sonar(b) {
      if (b.shieldDown <= 0) { addText(b.x, b.y - b.r - 20, 'SHIELD DOWN', '#6ff7ff', 18); Sound.zap(); G.shake = 8; }
      b.shieldDown = 6.5;
    },
    update(b, dt) {
      const P = G.P, p = b.hp / b.maxHp;
      if (b.shieldDown > 0) { b.shieldDown -= dt; if (b.shieldDown <= 0) { addText(b.x, b.y - b.r - 20, 'SHIELD UP', '#ff8a98', 16); Sound.warn(); } }
      b.x = lerp(b.x, b.cx + Math.sin(b.t * 0.3) * 140, dt * 0.6); b.y = lerp(b.y, b.cy + Math.cos(b.t * 0.23) * 160, dt * 0.6);
      b.cool -= dt;
      if (b.cool <= 0 && !b.beams) {
        const opts = ['beams', 'ring', 'spiral']; if (G.creatures.filter(c => c.type === 'sentinel').length < 3) opts.push('drones');
        const a = pick(opts);
        if (a === 'beams') { const n = p > 0.6 ? 2 : p > 0.3 ? 3 : 4; b.beams = { n, a0: Math.atan2(P.y - b.y, P.x - b.x) + Math.PI / n, dir: Math.random() < 0.5 ? 1 : -1, t: 0, warn: 1.1 * b.spdMul, dur: 3.6, spd: 0.5 + 0.08 * n }; Sound.warn(); b.cool = 5.4; }
        else if (a === 'ring') { const k = p < 0.4 ? 2 : 1; for (let i = 0; i < k; i++) b.waves.push({ R: b.r - i * 160, gap: rnd(0, TAU), gw: 1.0 }); Sound.laser(); b.cool = 2.6 * b.spdMul; }
        else if (a === 'spiral') { b.spiral = 2.6; b.cool = 3.4 * b.spdMul; }
        else { for (let i = 0; i < 2; i++) { const c = makeCreature('sentinel', b.x + rnd(-80, 80), b.y + rnd(-80, 80)); c.r = Math.max(c.r, P.r * 1.05); G.creatures.push(c); } discover('sentinel'); b.cool = 2.4 * b.spdMul; }
      }
      if (b.beams) {
        const bm = b.beams; bm.t += dt;
        if (bm.t > bm.warn + bm.dur) b.beams = null;
        else if (bm.t > bm.warn) {
          if (!bm.on) { bm.on = true; Sound.laser(); G.shake = Math.max(G.shake, 6); }
          for (let i = 0; i < bm.n; i++) {
            const a = this.beamA(b, i);
            if (segDist(P.x, P.y, b.x, b.y, b.x + Math.cos(a) * 1300, b.y + Math.sin(a) * 1300) < 13 + P.r * 0.6) hurtPlayer(20 * b.dmgMul, P.x - Math.cos(a + Math.PI / 2) * 10, P.y);
          }
        }
      }
      if (b.spiral > 0) {
        b.spiral -= dt; b.spT = (b.spT || 0) - dt;
        if (b.spT <= 0) { b.spT = 0.13; for (let k = 0; k < 3; k++) { const a = b.t * 1.9 + k * TAU / 3; G.projs.push({ x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * 165, vy: Math.sin(a) * 165, r: 6, life: 5, dmg: 11, col: '#ff3b5c' }); } }
      }
      for (const w of b.waves) {
        w.R += 240 * dt;
        if (w.R < b.r) continue;
        const d = Math.hypot(P.x - b.x, P.y - b.y);
        if (Math.abs(d - w.R) < 11 + P.r * 0.6) {
          const a = Math.atan2(P.y - b.y, P.x - b.x);
          if (Math.abs(angDiff(a, w.gap)) > w.gw / 2) hurtPlayer(17 * b.dmgMul, b.x, b.y);
        }
      }
      b.waves = b.waves.filter(w => w.R < 1300);
      bossContact(b, [[b.x, b.y, b.r * (b.shieldDown > 0 ? 0.9 : 1.25), 20, 1]]);
    },
    beamA(b, i) { const bm = b.beams; return bm.a0 + i * TAU / bm.n + bm.dir * bm.spd * Math.max(0, bm.t - bm.warn); },
    draw(ctx, b) {
      const flash = b.flash > 0;
      if (b.beams) {
        const bm = b.beams;
        for (let i = 0; i < bm.n; i++) {
          const a = this.beamA(b, i), ex = b.x + Math.cos(a) * 1300, ey = b.y + Math.sin(a) * 1300;
          if (bm.t < bm.warn) { ctx.globalAlpha = 0.4 + 0.4 * Math.sin(bm.t * 30); ctx.strokeStyle = '#ff2e4a'; ctx.lineWidth = 2; ctx.setLineDash([12, 10]); }
          else { ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ff2e4a'; ctx.lineWidth = 22; ctx.setLineDash([]); }
          ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ex, ey); ctx.stroke();
          if (bm.t >= bm.warn) { ctx.strokeStyle = '#ffe0e6'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ex, ey); ctx.stroke(); }
          ctx.setLineDash([]);
        }
        ctx.globalAlpha = 1;
      }
      for (const w of b.waves) {
        if (w.R < b.r) continue;
        ctx.strokeStyle = '#ff5a7a'; ctx.lineWidth = 14; ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.arc(b.x, b.y, w.R, w.gap + w.gw / 2, w.gap - w.gw / 2 + TAU); ctx.stroke();
        ctx.strokeStyle = '#ffe0e6'; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.save(); ctx.translate(b.x, b.y);
      for (let k = 0; k < 3; k++) {
        ctx.save(); ctx.rotate(b.t * (0.5 + k * 0.3) * (k % 2 ? -1 : 1));
        ctx.strokeStyle = flash ? '#fff' : k === 1 ? '#3a5f78' : '#4a2a3c'; ctx.lineWidth = 6 - k;
        const R = b.r + 22 + k * 22;
        for (let s = 0; s < 6; s++) { ctx.beginPath(); ctx.arc(0, 0, R, s * TAU / 6, s * TAU / 6 + 0.7); ctx.stroke(); }
        ctx.restore();
      }
      const g = ctx.createRadialGradient(-b.r * 0.3, -b.r * 0.3, 4, 0, 0, b.r);
      g.addColorStop(0, flash ? '#ffffff' : '#4a3a52'); g.addColorStop(1, '#0d0710');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, TAU); ctx.fill();
      ctx.restore();
    },
    emit(ctx, b) {
      const P = G.P, a = Math.atan2(P.y - b.y, P.x - b.x), ix = b.x + Math.cos(a) * b.r * 0.35, iy = b.y + Math.sin(a) * b.r * 0.35;
      glow(ctx, ix, iy, 46, '#ff3b5c', 0.9); ctx.globalAlpha = 1; dot(ctx, ix, iy, 14, '#ff3b5c'); dot(ctx, ix, iy, 6, '#1a0006'); dot(ctx, ix - 4, iy - 4, 2.5, '#ffd0d8');
      for (let k = 0; k < 6; k++) { const ra = b.t * 0.8 + k * TAU / 6, R = b.r + 44; glow(ctx, b.x + Math.cos(ra) * R, b.y + Math.sin(ra) * R, 8, '#6ff7ff', 0.7); }
      if (b.shieldDown <= 0) {
        ctx.globalAlpha = 0.25 + 0.1 * Math.sin(b.t * 4); ctx.strokeStyle = '#ff6a8a'; ctx.lineWidth = 2;
        const R = b.r * 1.3;
        for (let k = 0; k < 12; k++) { const aa = k * TAU / 12 + b.t * 0.2; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(aa) * R, b.y + Math.sin(aa) * R); ctx.lineTo(b.x + Math.cos(aa + TAU / 12) * R, b.y + Math.sin(aa + TAU / 12) * R); ctx.stroke(); }
        glow(ctx, b.x, b.y, R * 1.3, '#ff3b5c', 0.25);
      }
      ctx.globalAlpha = 1;
    },
    lights(b, L) { L(b.x, b.y, 260, 0.55); },
  },
};
