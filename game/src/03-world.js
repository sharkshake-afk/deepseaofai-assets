// ============================================================
//  World geometry: a meandering trench with boss arenas
// ============================================================
const ARENA_HALF = 440, ARENA_LEN = 1300; // units
function makeWorld(seed) {
  const rng = mulberry32(seed);
  const nA = makeNoise(rng), nB = makeNoise(rng), nC = makeNoise(rng), nD = makeNoise(rng), nE = makeNoise(rng), nF = makeNoise(rng);
  const arenas = [];
  for (let i = 0; i < 24; i++) { const b = bossAt(i); arenas.push({ i, y0: b.m * 10 - 200, y1: b.m * 10 - 200 + ARENA_LEN, boss: b }); }
  const rawCenter = y => 170 * nA(y * 0.00026) + 70 * nB(y * 0.0009);
  for (const a of arenas) a.cx = rawCenter((a.y0 + a.y1) / 2);
  function arenaBlend(y) { // 1 inside arena, fades to 0 over 700 units
    for (const a of arenas) {
      if (y < a.y0 - 700) return null;
      if (y <= a.y1 + 700) {
        const d = y < a.y0 ? a.y0 - y : y > a.y1 ? y - a.y1 : 0;
        const t = 1 - clamp(d / 700, 0, 1);
        return { a, t: t * t * (3 - 2 * t) };
      }
    }
    return null;
  }
  const W = {
    seed, arenas,
    walls(y) {
      let c = rawCenter(y);
      let hw = 390 + 120 * nC(y * 0.00042) + 55 * nD(y * 0.0014);
      hw += Math.max(0, 420 - y * 0.35); // wide open water near the surface
      hw = Math.max(250, hw);
      let jl = 34 * nE(y * 0.0055) + 14 * nE(y * 0.031 + 91), jr = 34 * nF(y * 0.0055) + 14 * nF(y * 0.031 + 17);
      const ab = arenaBlend(y);
      if (ab && ab.t > 0) {
        c = lerp(c, ab.a.cx, ab.t); hw = lerp(hw, ARENA_HALF, ab.t);
        jl *= 1 - ab.t * 0.8; jr *= 1 - ab.t * 0.8;
      }
      return [c - hw + jl, c + hw - jr];
    },
    arenaFor(y) { for (const a of arenas) { if (y < a.y0 - 400) return null; if (y <= a.y1 + 50) return a; } return null; },
  };
  return W;
}

// rock + decoration palettes by depth
function rockColors(m) {
  return {
    fill: keyed([[0, '#0d3a4c'], [200, '#0c2534'], [1000, '#0d1620'], [3000, '#110f1a'], [6000, '#170b1c'], [9000, '#1a0a12']], m, true),
    rim: keyed([[0, '#4fb3c9'], [200, '#2a6a80'], [1000, '#2a4a5c'], [3000, '#3b3350'], [6000, '#4a2a52'], [9000, '#5a2232']], m, true),
    haze: keyed([[0, '#1c7aa3'], [200, '#0b3352'], [1000, '#061a30'], [3000, '#080b20'], [6000, '#140826'], [9000, '#220a1a']], m, true),
  };
}

// deterministic decorations per 150-unit cell
const DECO_CELL = 150;
function decoAt(cell, side, world) {
  const h = hash2(cell * 2 + side, world.seed & 0xffff);
  if (h < 0.42) return null;
  const y = (cell + hash2(cell, side + 7)) * DECO_CELL;
  if (y < 30) return null;
  const m = y * M_PER_UNIT, [l, r] = world.walls(y);
  const x = side ? r : l, dir = side ? -1 : 1;
  const v = hash2(cell + 3, side + 11);
  let type;
  if (m < 160) type = v < 0.55 ? 'kelp' : 'coral';
  else if (m < 900) type = v < 0.5 ? 'anemone' : v < 0.8 ? 'seapen' : 'crystal';
  else if (m < 3000) type = v < 0.62 ? 'crystal' : 'anemone';
  else if (m < 6000) type = v < 0.45 ? 'vent' : v < 0.8 ? 'worms' : 'crystal';
  else type = v < 0.55 ? 'rack' : v < 0.8 ? 'cable' : 'crystal';
  const hueSet = m < 3000 ? ['#6ff7ff', '#b98cff', '#7dffb2'] : m < 6000 ? ['#ff9a5c', '#ff5f7a', '#b98cff'] : ['#ff3b5c', '#6ff7ff', '#c6ff4d'];
  return { x, y, dir, type, size: 0.7 + hash2(cell, side + 5) * 0.8, color: hueSet[Math.floor(hash2(cell, side + 9) * 3)], seed: hash2(cell, side + 13) };
}
