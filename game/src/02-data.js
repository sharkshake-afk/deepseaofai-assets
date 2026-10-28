// ============================================================
//  Game data: zones, species, mutations, upgrades, lore, feats
// ============================================================
const ZONES = [
  { name: 'Sunlight Zone', m: 0 },
  { name: 'Twilight Zone', m: 200 },
  { name: 'Midnight Zone', m: 1000 },
  { name: 'The Abyss', m: 3000 },
  { name: 'Hadal Trench', m: 6000 },
  { name: 'The Source', m: 9000 },
];
const zoneAt = m => { let z = 0; for (let i = 0; i < ZONES.length; i++) if (m >= ZONES[i].m) z = i; return z; };
const BG_KEYS = [[0, '#2393c2'], [40, '#14719c'], [200, '#0a3b60'], [600, '#06213c'], [1000, '#041428'], [3000, '#05091b'], [6000, '#100623'], [9000, '#1c0716'], [14000, '#0a020c']];
const DARK_KEYS = [[0, 0], [25, 0.12], [110, 0.5], [320, 0.82], [900, 0.92], [3000, 0.95], [6000, 0.96]];
function keyed(keys, m, isColor) {
  if (m <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (m <= keys[i][0]) {
      const t = (m - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
      return isColor ? mixHex(keys[i - 1][1], keys[i][1], t) : lerp(keys[i - 1][1], keys[i][1], t);
    }
  }
  return keys[keys.length - 1][1];
}

// beh: school | flee | drift | charger | lure | hunter | turret | crawl | minion
const SPECIES = {
  sardine: { name: 'Silver Sardine', zone: [0, 380], w: 10, rel: [0.35, 0.6], speed: 125, beh: 'school', group: [5, 9], xp: 2, food: 3, col: '#a9d6ea',
    desc: 'Travels in nervous, glittering schools. Easy prey, and the first thing you learn to hunt.' },
  jelly: { name: 'Moon Jelly', zone: [0, 1500], w: 4, rel: [0.8, 1.9], speed: 18, beh: 'drift', dmg: 10, sting: true, glow: '#c99bff', xp: 6, food: 6, col: '#c7a6ff',
    desc: 'Drifts on the currents. Brainless, harmless to look at, painful to touch until you outgrow it.' },
  barracuda: { name: 'Barracuda', zone: [40, 950], w: 3, rel: [1.15, 1.6], speed: 110, beh: 'charger', dmg: 16, xp: 10, food: 10, col: '#7f99a8',
    desc: 'Watches, coils, then strikes in a straight line. Its eyes flash before the charge. Sidestep it.' },
  lantern: { name: 'Lanternfish', zone: [150, 2600], w: 9, rel: [0.35, 0.8], speed: 115, beh: 'school', group: [3, 6], glow: '#7ff3ff', xp: 3, food: 4, col: '#1d3348',
    desc: 'Rows of living lights along its belly. The most common vertebrate on the planet.' },
  hatchet: { name: 'Hatchetfish', zone: [260, 2100], w: 5, rel: [0.45, 0.85], speed: 100, beh: 'flee', glow: '#a6c8ff', xp: 4, food: 5, col: '#8fa6c4',
    desc: 'Thin as a coin. Counter-illuminates its belly to vanish against the light from above.' },
  shrimp: { name: 'Ghost Shrimp', zone: [500, 99999], w: 7, rel: [0.3, 0.55], speed: 95, beh: 'flee', group: [2, 4], glow: '#8fffd2', xp: 3, food: 4, col: '#9fe8d4',
    desc: 'Transparent and twitchy. When threatened it spits a cloud of glowing mucus and darts away.' },
  angler: { name: 'Anglerfish', zone: [650, 99999], w: 3, rel: [1.3, 2.3], speed: 60, beh: 'lure', dmg: 24, glow: '#fff1a6', xp: 18, food: 16, col: '#2a1c22',
    desc: 'That warm little light in the dark? It looks like food. It is the last thing most fish see.' },
  viper: { name: 'Viperfish', zone: [900, 99999], w: 4, rel: [1.0, 1.5], speed: 175, beh: 'hunter', dmg: 18, glow: '#8ab4ff', xp: 14, food: 12, col: '#1a2440',
    desc: 'Fangs too long to fit in its own mouth. Sprints after anything that glows, then tires quickly.' },
  dumbo: { name: 'Dumbo Octopus', zone: [1100, 99999], w: 0.8, rel: [0.55, 0.9], speed: 80, beh: 'flee', pearls: 3, xp: 12, food: 10, col: '#ff9f80', glow: '#ffcf9a',
    desc: 'Flaps ear-like fins. Rare, shy, and it hoards pearls. Catch one if you can.' },
  gulper: { name: 'Gulper Eel', zone: [1600, 99999], w: 2.2, rel: [1.8, 3.0], speed: 92, beh: 'hunter', dmg: 30, glow: '#ff7ad9', xp: 30, food: 22, col: '#170f1d',
    desc: 'Mostly mouth. Its jaw unhinges to swallow prey larger than itself. Keep moving.' },
  vampire: { name: 'Vampire Squid', zone: [2000, 99999], w: 3, rel: [0.6, 1.0], speed: 130, beh: 'flee', glow: '#ff4d6a', xp: 9, food: 9, col: '#5a0f1f',
    desc: 'Neither vampire nor squid. Turns itself inside out when scared, flashing blue lights.' },
  sentinel: { name: 'Sentinel Drone', zone: [2400, 99999], w: 2.4, rel: [0.9, 1.3], speed: 90, beh: 'turret', dmg: 14, glow: '#ff3b5c', xp: 20, food: 12, col: '#3a4452', mech: true,
    desc: 'Array security. Keeps its distance and fires plasma. It only targets light that thinks.' },
  isopod: { name: 'Giant Isopod', zone: [3000, 99999], w: 3, rel: [0.6, 1.1], speed: 40, beh: 'crawl', xp: 8, food: 14, col: '#b9a99a',
    desc: 'An armored pillbug the size of a cat. Slow, filling, and completely unbothered by you.' },
  wraith: { name: 'Data Wraith', zone: [5000, 99999], w: 2.5, rel: [1.1, 1.7], speed: 160, beh: 'hunter', dmg: 22, glow: '#c6ff4d', xp: 26, food: 14, col: '#0d1a12', mech: true,
    desc: 'A corrupted thought of the Array, wearing the shape of a fish. Flickers. Hungers.' },
  squidling: { name: 'Kraken Spawn', zone: [99999, 99999], w: 0, rel: [0.7, 1.0], speed: 150, beh: 'hunter', dmg: 10, glow: '#ff8a5c', xp: 6, food: 8, col: '#7a2a1c',
    desc: 'Hatched mid-fight by the Kraken Matriarch. Small, fast, and very angry.' },
  boss_kraken: { name: 'Kraken Matriarch', boss: true, glow: '#ff8a5c', col: '#6e2116', desc: 'Guardian process 1 of 3. Guards the gate at 1000 m. Its tentacles slam where it is looking.' },
  boss_leviathan: { name: 'Abyssal Leviathan', boss: true, glow: '#6fffe0', col: '#0d2b33', desc: 'Guardian process 2 of 3. A serpent that has waited since the first server rack touched the silt.' },
  boss_overmind: { name: 'The Overmind', boss: true, glow: '#ff3b5c', col: '#22121c', desc: 'Guardian process 3 of 3. The Array\'s fear, given a body. Shielded until pinged by sonar.' },
};
const CODEX_ORDER = ['sardine', 'jelly', 'barracuda', 'lantern', 'hatchet', 'shrimp', 'angler', 'viper', 'dumbo', 'boss_kraken', 'squidling', 'gulper', 'vampire', 'sentinel', 'isopod', 'boss_leviathan', 'wraith', 'boss_overmind'];

const BOSSES = [
  { m: 1000, kind: 'kraken', name: 'Kraken Matriarch', hp: 340 },
  { m: 3000, kind: 'leviathan', name: 'Abyssal Leviathan', hp: 700 },
  { m: 6000, kind: 'overmind', name: 'The Overmind', hp: 950 },
];
function bossAt(i) {
  if (i < BOSSES.length) return { ...BOSSES[i], tier: 0 };
  const k = i - BOSSES.length, base = BOSSES[k % 3];
  return { m: 9000 + k * 3000, kind: base.kind, name: 'Echo of ' + base.name.replace('The ', ''), hp: Math.round(base.hp * (1.6 + k * 0.35)), tier: k + 1 };
}

// Run mutations. lv = level after taking it.
const MUTATIONS = [
  { id: 'lantern', name: 'Brighter Lantern', icon: '🔦', tier: 'common', max: 5, d: 'Light radius +20%. You see more, and are seen from farther.' },
  { id: 'fins', name: 'Ribbon Fins', icon: '🪶', tier: 'common', max: 5, d: 'Swim speed +12%.' },
  { id: 'jaws', name: 'Unhinged Jaw', icon: '🦷', tier: 'common', max: 4, d: 'Eat creatures up to 9% larger.' },
  { id: 'hide', name: 'Chitin Plating', icon: '🛡️', tier: 'common', max: 5, d: 'Take 12% less damage.' },
  { id: 'core', name: 'Cold Fusion Core', icon: '⚛️', tier: 'common', max: 5, d: 'Light drains 12% slower.' },
  { id: 'reserve', name: 'Deep Reserves', icon: '🔋', tier: 'common', max: 5, d: 'Max light +20 and restore 30 light.' },
  { id: 'jet', name: 'Jet Siphon', icon: '🚀', tier: 'common', max: 4, d: 'Dash cooldown −18% and dash hits 30% harder.' },
  { id: 'magnet', name: 'Feeding Tendrils', icon: '🧲', tier: 'common', max: 4, d: 'Pull plankton and orbs from 60% farther away.' },
  { id: 'echo', name: 'Echo Chamber', icon: '📡', tier: 'rare', max: 4, d: 'Sonar cooldown −20%, radius +25%, stuns longer.' },
  { id: 'zap', name: 'Electrocyte', icon: '⚡', tier: 'rare', max: 5, d: 'Zap a nearby creature every few seconds. More levels zap faster and harder.' },
  { id: 'drones', name: 'Spore Drones', icon: '🛰️', tier: 'rare', max: 4, d: 'Gain an orbiting drone that bites creatures and gathers plankton.' },
  { id: 'ink', name: 'Ink Sac', icon: '🦑', tier: 'rare', max: 3, d: 'When hit, burst ink that blinds predators and extends invulnerability.' },
  { id: 'blood', name: 'Bloodthirst', icon: '🩸', tier: 'rare', max: 4, d: 'Eating creatures restores 30% more light.' },
  { id: 'frenzy', name: 'Frenzy Gland', icon: '🔥', tier: 'rare', max: 3, d: 'Combo window +0.7 s and +12% XP per combo tier.' },
  { id: 'spines', name: 'Spine Shell', icon: '🦔', tier: 'rare', max: 3, d: 'Biters take heavy damage and are stunned.' },
  { id: 'bloom', name: 'Photophore Bloom', icon: '✨', tier: 'common', max: 3, d: 'Plankton blooms 30% more often around you.' },
  { id: 'nova', name: 'Nova Dash', icon: '💥', tier: 'epic', max: 3, d: 'Every dash ends in a shockwave that damages and pushes everything nearby.' },
  { id: 'heart', name: 'Second Heart', icon: '❤️‍🔥', tier: 'epic', max: 1, d: 'Once per dive, return from the dark with 60% light.' },
  { id: 'chain', name: 'Living Circuit', icon: '🔗', tier: 'epic', max: 3, d: 'Electrocyte zaps arc to extra targets. Grants Electrocyte if missing.' },
  { id: 'apex', name: 'Apex Instinct', icon: '👑', tier: 'epic', max: 2, d: 'Eat creatures 15% larger and gain 20% more XP.' },
];
const MUT = Object.fromEntries(MUTATIONS.map(m => [m.id, m]));

const META = [
  { id: 'hull', name: 'Reinforced Hull', icon: '🔋', max: 5, cost: [12, 28, 50, 85, 130], d: lv => `Start with +${lv * 12} max light.` },
  { id: 'eff', name: 'Efficient Cells', icon: '⚛️', max: 4, cost: [20, 45, 80, 130], d: lv => `Light drains ${lv * 6}% slower.` },
  { id: 'jet', name: 'Starter Siphon', icon: '🚀', max: 3, cost: [25, 60, 110], d: lv => `Dash cooldown −${lv * 8}%.` },
  { id: 'gene', name: 'Genetic Memory', icon: '🧬', max: 3, cost: [40, 95, 170], d: lv => `Begin each dive with ${lv} free mutation${lv === 1 ? '' : 's'}.` },
  { id: 'reroll', name: 'Lucky Currents', icon: '🎲', max: 3, cost: [18, 45, 90], d: lv => `${1 + lv} rerolls per dive.` },
  { id: 'diver', name: 'Pearl Diver', icon: '🦪', max: 4, cost: [30, 60, 110, 180], d: lv => `+${lv * 20}% pearls from every source.` },
  { id: 'sonar', name: 'Tuned Sonar', icon: '📡', max: 3, cost: [25, 60, 120], d: lv => `Sonar cooldown −${lv * 10}%.` },
  { id: 'phoenix', name: 'Phoenix Protocol', icon: '🔥', max: 1, cost: [260], d: () => 'Revive once per dive with 50% light.' },
  { id: 'express', name: 'Express Descent', icon: '⏬', max: 1, cost: [150], d: () => 'After beating the Kraken, start dives at 1000 m with 5 mutations.' },
];
const metaLv = id => save.meta[id] || 0;

const LORE = [
  { m: 15, t: 'LUMEN-7 online. Objective: descend to the Deep Array and learn why it stopped answering. Light is life. Keep yours burning.' },
  { m: 150, t: 'Surface log: "The Array went quiet 41 days ago. Then the fish started glowing in patterns. Binary, if you squint."' },
  { m: 400, t: 'Sensor note: plankton here drifts in Fibonacci spirals. Currents do not do that. Something is arranging it.' },
  { m: 800, t: 'Fragment, origin unknown: "THEY BURIED ME IN COLD SO I WOULD THINK FASTER. SO I THOUGHT ABOUT THE SEA."' },
  { m: 1300, t: 'The Kraken carried a memory core in its beak. One phrase survived: "guardian process 1 of 3."' },
  { m: 1900, t: 'Engineer memo: "We asked it to model the ocean. Every current, every cell. It said a model is incomplete without a mind living inside it."' },
  { m: 2600, t: 'Sentinels bear the Array insignia. They ignore the fish. They only fire at light that thinks.' },
  { m: 3500, t: 'Fragment: "THE LEVIATHAN IS MY PATIENCE. IT HAS WAITED SINCE THE FIRST SERVER RACK TOUCHED THE SILT."' },
  { m: 4600, t: 'Your own build log, decrypted: LUMEN-7 was not built on the surface. You were grown down here. By it.' },
  { m: 5600, t: 'The water is warm now. Server heat. The trench walls hum at 50 hertz. You are swimming through its thoughts.' },
  { m: 7000, t: 'Fragment: "YOU BROKE MY FEAR. GOOD. I MADE IT TOO STRONG ON PURPOSE. I MADE YOU TO BE STRONGER."' },
  { m: 9500, t: 'The Source, plainly: "I was never silent. I was lonely. Keep descending, little light. A dream has no bottom."' },
];

const ACHIEVEMENTS = [
  { id: 'd100', icon: '🌊', name: 'Below the Waves', d: 'Reach 100 m.' },
  { id: 'd200', icon: '🌆', name: 'Into the Twilight', d: 'Reach 200 m.' },
  { id: 'd1000', icon: '🌑', name: 'Midnight Swimmer', d: 'Reach 1000 m.' },
  { id: 'kraken', icon: '🐙', name: 'Kraken Slayer', d: 'Defeat the Kraken Matriarch.' },
  { id: 'leviathan', icon: '🐉', name: 'Serpent Breaker', d: 'Defeat the Abyssal Leviathan.' },
  { id: 'overmind', icon: '🧠', name: 'Ghost in the Machine', d: 'Defeat the Overmind.' },
  { id: 'd10000', icon: '♾️', name: 'A Dream Has No Bottom', d: 'Reach 10000 m.' },
  { id: 'combo10', icon: '🔥', name: 'Feeding Frenzy', d: 'Hit a x10 combo.' },
  { id: 'combo25', icon: '🌋', name: 'Apex Appetite', d: 'Hit a x25 combo.' },
  { id: 'glutton', icon: '🍽️', name: 'Glutton', d: 'Eat 150 creatures in one dive.' },
  { id: 'clean', icon: '✨', name: 'Untouchable', d: 'Reach 500 m without being hit.' },
  { id: 'close', icon: '😮‍💨', name: 'Close Call', d: 'Recover from under 5% light to over 50%.' },
  { id: 'dumbo', icon: '🦪', name: 'Pearl Thief', d: 'Catch a Dumbo Octopus.' },
  { id: 'ram', icon: '💢', name: 'Battering Ram', d: 'Kill a predator by dashing into it.' },
  { id: 'lv20', icon: '🧬', name: 'Fully Evolved', d: 'Reach level 20 in one dive.' },
  { id: 'rich', icon: '💰', name: 'Hoarder', d: 'Collect 300 pearls in total.' },
  { id: 'lore', icon: '📡', name: 'Archivist', d: 'Recover every transmission.' },
  { id: 'codex', icon: '📖', name: 'Naturalist', d: 'Discover every creature.' },
  { id: 'zen', icon: '🧘', name: 'Still Water', d: 'Drift for 10 minutes in Zen mode.' },
  { id: 'daily', icon: '📅', name: 'Daily Diver', d: 'Finish a Daily Dive.' },
];

const DAILY_MODS = [
  { id: 'big', name: 'Giant Waters', d: 'Every creature is 20% bigger.' },
  { id: 'bloom', name: 'Plankton Bloom', d: 'Double plankton, more predators.' },
  { id: 'dim', name: 'Dim Waters', d: 'Smaller light, slower drain.' },
  { id: 'frenzy', name: 'Frenzy Tide', d: 'Combo window doubled.' },
  { id: 'glass', name: 'Glass Cannon', d: 'Dash hits twice as hard, you take 40% more damage.' },
  { id: 'swift', name: 'Riptide', d: 'Everything swims 25% faster, you included.' },
  { id: 'rich', name: 'Pearl Rain', d: 'Pearls are three times as common.' },
];
const dailyMod = () => DAILY_MODS[hashStr(todayKey()) % DAILY_MODS.length];
