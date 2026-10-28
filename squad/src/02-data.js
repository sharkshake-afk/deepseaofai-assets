// ============================================================
//  Data: weapons, horde, bosses, HQ upgrades
// ============================================================
const ROAD = 5; // half width in world units
const WEAPONS = [
  { name: 'Pistol', dmg: 1, rate: 2.2, pierce: 0, col: '#ffe08a', w: 1.4, icon: '🔫' },
  { name: 'SMG', dmg: 1, rate: 2.6, pierce: 0, col: '#ffd45e', w: 1.6, icon: '🔫' },
  { name: 'Rifle', dmg: 2.4, rate: 2.0, pierce: 1, col: '#ffb347', w: 2, icon: '🎯' },
  { name: 'Minigun', dmg: 2.1, rate: 4.4, pierce: 1, col: '#ff9a3d', w: 2, icon: '⚙️' },
  { name: 'Plasma', dmg: 5, rate: 3, pierce: 2, col: '#6ff7ff', w: 3, icon: '⚡' },
  { name: 'Railgun', dmg: 11, rate: 2.1, pierce: 5, col: '#c48bff', w: 3.5, icon: '☄️' },
];
const ZTYPES = {
  walker: { hp: 9, speed: 3.0, r: 0.36, scale: 1, kills: 1, col: '#7aa04c', skin: '#9cc26a', coin: 1 },
  runner: { hp: 5, speed: 6.4, r: 0.34, scale: 0.95, kills: 1, col: '#a7b64a', skin: '#c8d86e', coin: 1 },
  brute: { hp: 110, speed: 1.9, r: 0.95, scale: 2.2, kills: 0, chew: 2, col: '#56783a', skin: '#7d9e55', coin: 8 },
  exploder: { hp: 10, speed: 3.8, r: 0.44, scale: 1.15, kills: 3, col: '#c79a34', skin: '#e7c060', coin: 2 },
  spitter: { hp: 18, speed: 2.4, r: 0.4, scale: 1.05, kills: 1, col: '#7f55ad', skin: '#a77fd6', coin: 3 },
};
const BOSS_TYPES = [
  { kind: 'titan', name: 'Titan', hp: 1, col: '#4f6e34', desc: 'Slams the road' },
  { kind: 'mech', name: 'Warmech', hp: 1.15, col: '#5b5f6b', desc: 'Missile barrages' },
  { kind: 'queen', name: 'Hive Queen', hp: 0.9, col: '#6b3f8a', desc: 'Births the swarm' },
];
const hpMul = s => { const k = Math.max(0, s - 1); return 1 + k * 0.24 + Math.pow(k, 1.4) * 0.03; };
const expSquad = d => 10 + 9 * d + d * d; // the squad size a stage is tuned around

const HQ = [
  { id: 'recruits', icon: '🪖', name: 'Recruits', max: 12, base: 25, g: 1.42, d: lv => `Start every run with ${8 + lv * 3} soldiers.` },
  { id: 'firepower', icon: '💥', name: 'Firepower', max: 15, base: 30, g: 1.38, d: lv => `+${lv * 10}% bullet damage.` },
  { id: 'rof', icon: '⏩', name: 'Rate of fire', max: 10, base: 35, g: 1.45, d: lv => `+${lv * 7}% fire rate.` },
  { id: 'armory', icon: '🔧', name: 'Armory', max: 3, base: 180, g: 3, d: lv => `Start with the ${WEAPONS[Math.min(5, lv)].name}.` },
  { id: 'strike', icon: '✈️', name: 'Air support', max: 8, base: 40, g: 1.5, d: lv => `Airstrike damage +${lv * 25}%, charges ${lv * 6}% faster.` },
  { id: 'shield', icon: '🛡️', name: 'Shield generator', max: 5, base: 120, g: 1.7, d: lv => lv ? `Shield ability lasts ${2 + lv} s.` : 'Unlocks the shield ability.' },
  { id: 'salvage', icon: '🪙', name: 'Salvage', max: 10, base: 40, g: 1.5, d: lv => `+${lv * 15}% coins.` },
  { id: 'laststand', icon: '🎖️', name: 'Last stand', max: 1, base: 400, g: 1, d: () => 'Once per run, 5 soldiers survive a wipe.' },
];
const hqLv = id => save.hq[id] || 0;
const hqCost = u => Math.round(u.base * Math.pow(u.g, hqLv(u.id)));

const DAILY_MODS = [
  { id: 'double', name: 'Double Down', d: 'Every × gate is ×3, but hordes are 50% bigger.' },
  { id: 'brutes', name: 'Brute Force', d: 'Brutes everywhere. Bullets hit 30% harder.' },
  { id: 'rush', name: 'Sprint', d: 'The squad runs 30% faster.' },
  { id: 'armory', name: 'Open Armory', d: 'Start with the Rifle. Fewer soldier gates.' },
  { id: 'acid', name: 'Acid Rain', d: 'Spitters in every horde. Coins doubled.' },
];
const dailyMod = () => DAILY_MODS[hashStr(todayKey()) % DAILY_MODS.length];
