// ============================================================
//  UI, flow, main loop
// ============================================================
const SCREENS = ['sTitle', 'sPause', 'sResult', 'sHQ', 'sSettings', 'sHow'];
let backTo = 'sTitle';
function show(id) { SCREENS.forEach(s => $(s).classList.toggle('on', s === id)); if (id) $('banner').classList.remove('on'); }
function tap(id, fn) { $(id).addEventListener('click', () => { Sound.init(); Sound.click(); fn(); }); }
let bannerT = 0;
function banner(title, sub, bad, dur = 1.8) {
  const b = $('banner'); b.querySelector('b').textContent = title; b.querySelector('small').textContent = sub || '';
  b.classList.toggle('good', !bad); b.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('on'), dur * 1000);
}
let hintT = 0;
function hint(t, dur = 3) { const h = $('hint'); h.textContent = t; h.classList.add('on'); clearTimeout(hintT); hintT = setTimeout(() => h.classList.remove('on'), dur * 1000); }

// tutorial: first run only, driven by what is on screen
let tutStep = 0;
function tutorialTick() {
  if (save.tutorial || G.mode !== 'campaign') return;
  const near = (arr, d) => arr.some(o => o.z - G.z < d && o.z - G.z > 4);
  if (tutStep === 0 && G.time > 0.6) { hint('Drag left or right to steer', 3); tutStep = 1; }
  else if (tutStep === 1 && near(G.gates, 26)) { hint('Blue gates add soldiers. Red gates take them.', 3.2); tutStep = 2; }
  else if (tutStep === 2 && G.gates.some(g => (g.op === '-' || g.op === '/') && g.z - G.z < 40 && g.z - G.z > 10)) { hint('Shoot a red gate to raise its number', 3); tutStep = 3; }
  else if (tutStep >= 2 && tutStep < 4 && near(G.crates, 30)) { hint('Shoot crates open for rewards', 3); tutStep = 4; }
  else if (tutStep >= 2 && G.strike >= 1 && tutStep < 5) { hint('Airstrike ready: tap ✈️', 3); tutStep = 5; }
  if (G.boss && tutStep < 9) { tutStep = 9; save.tutorial = true; persist(); setTimeout(() => hint('Steer out of the red circles!', 3), 2400); }
}

// ---------------- flow ----------------
let wake = null;
function keepAwake(on) { try { if (on && navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(l => { wake = l; l.addEventListener('release', () => wake = null); }).catch(() => { }); if (!on && wake) { wake.release(); wake = null; } } catch (e) { } }
function startRun(mode, stage) {
  Sound.init(); newRun(mode, stage); G.state = 'play'; tutStep = 0;
  show(null); $('hud').hidden = false;
  $('hStage').textContent = mode === 'campaign' ? 'Stage ' + G.stage : mode === 'endless' ? 'Endless' : 'Daily op';
  $('bShield').classList.toggle('locked', !hqLv('shield'));
  banner(mode === 'campaign' ? 'Stage ' + G.stage : mode === 'endless' ? 'Endless rush' : dailyMod().name, mode === 'daily' ? dailyMod().d : mode === 'campaign' ? BOSS_TYPES[(G.stage - 1) % 3].name + ' awaits' : 'No finish line', false, 2.2);
  Sound.setMusic(true, 0); keepAwake(true);
}
function pause() {
  if (G.state !== 'play') return; G.state = 'pause'; Input.id = null;
  $('pStats').innerHTML = stats([['Squad', fmt(G.n)], ['Kills', G.kills], ['Coins', Math.floor(G.coinsRun)]]);
  show('sPause');
}
function resume() { G.state = 'play'; show(null); }
function stats(rows) { return rows.map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join(''); }

function endRun(won, retreat) {
  if (G.over) return;
  G.over = true; Sound.setMusic(false);
  const mode = G.mode, dist = Math.floor(G.z / 10);
  let coins = G.coinsRun, starN = 0, title, sub, next;
  if (won) {
    starN = 1 + (G.n >= G.maxN * 0.4 ? 1 : 0) + (G.n >= G.maxN * 0.7 ? 1 : 0);
    coins += (50 + G.stage * 15) * coinMul() * (0.8 + starN * 0.2);
    title = 'Victory'; sub = `${fmt(G.n)} of ${fmt(G.maxN)} soldiers made it`;
    if (mode === 'campaign') { save.stars[G.stage] = Math.max(save.stars[G.stage] || 0, starN); if (G.stage >= save.stage) save.stage = G.stage + 1; }
    Sound.win(); haptic([30, 50, 30, 50, 120]);
  } else {
    title = retreat ? 'Retreat' : 'Squad lost';
    sub = mode === 'endless' ? `${dist} m covered` : mode === 'campaign' ? `Stage ${G.stage}: ${Math.floor(Math.min(1, G.z / G.len) * 100)}% of the road` : `${dist} m covered`;
    Sound.fail(); haptic([80, 50, 160]);
  }
  if (mode === 'endless' && dist > save.endless) { save.endless = dist; sub += ' · new record'; }
  if (mode === 'daily') { if (save.daily.date !== todayKey()) save.daily = { date: todayKey(), best: 0 }; const sc = won ? 100000 + G.n : dist; if (sc > save.daily.best) save.daily.best = sc; }
  coins = Math.floor(coins);
  save.coins += coins; save.stats.runs++; save.stats.kills += G.kills; save.stats.maxSquad = Math.max(save.stats.maxSquad, G.maxN);
  persist(); keepAwake(false);
  setTimeout(() => {
    G.state = 'over'; $('hud').hidden = true;
    $('rTitle').textContent = title; $('rTitle').classList.toggle('bad', !won);
    $('rSub').textContent = sub;
    $('rStars').hidden = !(won && mode === 'campaign');
    [...$('rStars').children].forEach((s, i) => { s.classList.remove('on'); setTimeout(() => { s.classList.toggle('on', i < starN); if (i < starN) Sound.coin(); }, 300 + i * 280); });
    $('rEarn').textContent = '+' + coins + ' ●';
    $('rStats').innerHTML = stats([['Kills', G.kills], ['Peak squad', fmt(G.maxN)], ['Weapon', WEAPONS[G.tier].name]]);
    $('rChips').innerHTML = G.bossesBeaten ? `<span class="chip">💀 ${G.bossesBeaten} boss${G.bossesBeaten > 1 ? 'es' : ''} down</span>` : '';
    $('rNextLbl').textContent = won && mode === 'campaign' ? 'Next: stage ' + (G.stage + 1) : 'Try again';
    show('sResult');
  }, won ? 900 : 1300);
}
function toTitle() { G.state = 'title'; $('hud').hidden = true; newRun('demo'); Sound.setMusic(false); refreshTitle(); show('sTitle'); }
function refreshTitle() {
  $('tStage').textContent = save.stage; $('tEndless').textContent = save.endless + ' m'; $('tCoins').textContent = fmt(save.coins);
  $('tPlayLbl').textContent = 'Play stage ' + save.stage;
  const dm = dailyMod(); $('tDaily').textContent = `Today: ${dm.name}. ${dm.d}`;
}

// ---------------- HQ ----------------
function renderHQ() {
  $('hqCoins').textContent = fmt(save.coins);
  $('hqList').innerHTML = HQ.map(u => {
    const lv = hqLv(u.id), maxed = lv >= u.max, cost = hqCost(u);
    return `<div class="item"><span class="ic">${u.icon}</span><div class="tx"><b>${u.name}</b><small>${u.d(maxed ? lv : lv + 1)}</small><div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>
      <button class="buy" data-id="${u.id}" ${maxed || save.coins < cost ? 'disabled' : ''}>${maxed ? 'MAX' : '● ' + fmt(cost)}</button></div>`;
  }).join('');
}
$('hqList').addEventListener('click', e => {
  const b = e.target.closest('.buy'); if (!b || b.disabled) return;
  const u = HQ.find(x => x.id === b.dataset.id), cost = hqCost(u);
  if (hqLv(u.id) >= u.max || save.coins < cost) return;
  save.coins -= cost; save.hq[u.id] = hqLv(u.id) + 1; persist(); Sound.init(); Sound.upgrade(); haptic(15); renderHQ(); refreshTitle();
});
function renderSettings() {
  const s = save.settings, row = (k, l, sub) => `<button class="toggle${s[k] ? ' on' : ''}" data-k="${k}"><span>${l}${sub ? `<small>${sub}</small>` : ''}</span><span class="sw"></span></button>`;
  $('setList').innerHTML = [row('sound', 'Sound effects'), row('music', 'Music', 'Synthesized drum and bass'), row('haptics', 'Vibration', 'Android only'), row('shake', 'Screen shake'),
    `<button class="toggle" data-k="quality"><span>Graphics<small>${s.quality === 'high' ? 'High' : 'Battery saver'}</small></span><span style="color:var(--gold)">Change</span></button>`,
    `<button class="toggle" data-k="reset"><span>${resetArm ? 'Tap again to erase all progress' : 'Reset progress'}<small>Coins, upgrades and stages</small></span><span style="color:var(--red)">${resetArm ? 'Confirm' : 'Reset'}</span></button>`].join('');
}
let resetArm = 0;
$('setList').addEventListener('click', e => {
  const b = e.target.closest('.toggle'); if (!b) return; const k = b.dataset.k, s = save.settings;
  Sound.init(); Sound.click();
  if (k === 'quality') { s.quality = s.quality === 'high' ? 'low' : 'high'; resize(); syncSoldiers(true); }
  else if (k === 'reset') { if (!resetArm) { resetArm = 1; setTimeout(() => { resetArm = 0; if ($('sSettings').classList.contains('on')) renderSettings(); }, 3000); } else { Object.assign(save, defaultSave(), { settings: s }); resetArm = 0; refreshTitle(); } }
  else s[k] = !s[k];
  persist(); Sound.apply(); renderSettings();
});
function open(id, from) { backTo = from; if (id === 'sHQ') renderHQ(); if (id === 'sSettings') renderSettings(); show(id); }
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { Sound.click(); refreshTitle(); show(backTo); }));

tap('bPlay', () => startRun('campaign', save.stage));
tap('bEndless', () => startRun('endless'));
tap('bDaily', () => startRun('daily', 3));
tap('bHQ', () => open('sHQ', 'sTitle'));
tap('bSettings', () => open('sSettings', 'sTitle'));
tap('bHow', () => open('sHow', 'sTitle'));
tap('bPause', pause); tap('bResume', resume);
tap('bPSettings', () => open('sSettings', 'sPause'));
tap('bQuit', () => { show(null); G.state = 'play'; endRun(false, true); });
tap('bNext', () => startRun(G.mode, G.mode === 'campaign' ? save.stage : G.stage));
tap('bRHQ', () => open('sHQ', 'sResult'));
tap('bMenu', toTitle);
const press = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Sound.init(); fn(); });
press('bStrike', useStrike); press('bShield', useShield);
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') pause(); else if (G.state === 'pause') resume(); }
  if (e.code === 'Space' || e.code === 'KeyQ') useStrike();
  if (e.code === 'KeyE') useShield();
  if (e.code === 'Enter' && $('sTitle').classList.contains('on')) startRun('campaign', save.stage);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); Sound.suspend(); } else Sound.resume(); });

// ---------------- HUD ----------------
const hc = {};
function hud() {
  if (G.state !== 'play') return;
  const prog = G.mode === 'endless' ? (G.z % 560) / 560 : clamp(G.z / G.len, 0, 1);
  const pv = Math.round(prog * 200) / 200; if (hc.p !== pv) { hc.p = pv; $('hProg').style.transform = `scaleX(${pv})`; }
  if (G.mode === 'endless') { const t = Math.floor(G.z / 10) + ' m'; if (hc.st !== t) { hc.st = t; $('hStage').textContent = t; } }
  const c = '● ' + fmt(save.coins + G.coinsRun); if (hc.c !== c) { hc.c = c; $('hCoins').textContent = c; }
  const sp = Math.round(G.strike * 40) / 40; if (hc.s !== sp) { hc.s = sp; $('bStrike').style.setProperty('--p', sp); $('bStrike').classList.toggle('ready', sp >= 1); }
  const sl = hqLv('shield') ? (G.shieldCd <= 0 ? 1 : 1 - G.shieldCd / 22) : 0, slr = Math.round(sl * 40) / 40;
  if (hc.sh !== slr) { hc.sh = slr; $('bShield').style.setProperty('--p', slr); $('bShield').classList.toggle('ready', slr >= 1 && !!hqLv('shield')); }
  const bb = $('bossbar');
  if (G.boss) { if (bb.hidden) { bb.hidden = false; $('bossName').textContent = G.boss.name; } const f = Math.round(G.boss.hp / G.boss.max * 200) / 200; if (hc.b !== f) { hc.b = f; $('bossHp').style.transform = `scaleX(${f})`; } }
  else if (!bb.hidden) bb.hidden = true;
}

// ---------------- boot ----------------
resize(); newRun('demo'); refreshTitle(); show('sTitle');
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  try {
    if (G.state === 'play' || G.state === 'title' || (G.state === 'over' && G.mode === 'demo')) update(dt);
    else if (G.over && G.state === 'play') update(dt);
    render(); hud(); Sound.tick();
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && window.isSecureContext && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
window.__squad = G;
if (location.search.includes('debug')) window.__dbg = { G, Input, update, render, startRun, save, newRun, useStrike, useShield, soldierSprite, zombieSprite };
