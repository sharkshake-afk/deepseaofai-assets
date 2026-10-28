// ============================================================
//  UI: screens, HUD, overlays, menus
// ============================================================
const SCREENS = ['sTitle', 'sLevel', 'sPause', 'sOver', 'sShop', 'sCodex', 'sSettings', 'sHow'];
let backTo = 'sTitle';
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
function show(id) { SCREENS.forEach(s => $(s).classList.toggle('on', s === id)); if (id) $('banner').classList.remove('on'); }
function tap(id, fn) { $(id).addEventListener('click', e => { Sound.init(); Sound.click(); fn(e); }); }

// ---------- overlays ----------
let bannerTimer = 0;
function banner(title, sub, boss, dur = 2.6) {
  const b = $('banner'); b.querySelector('b').textContent = title; b.querySelector('small').textContent = sub || '';
  b.classList.toggle('boss', !!boss); b.classList.add('on');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('on'), dur * 1000);
}
const toastQ = []; let toastBusy = false;
function toast(icon, label, name) { toastQ.push([icon, label, name]); if (!toastBusy) nextToast(); }
function nextToast() {
  const it = toastQ.shift(), el = $('toast');
  if (!it) { toastBusy = false; return; }
  toastBusy = true;
  el.querySelector('.ti').textContent = it[0]; el.querySelector('small').textContent = it[1]; el.querySelector('b').textContent = it[2];
  el.classList.add('on'); Sound.pick();
  setTimeout(() => { el.classList.remove('on'); setTimeout(nextToast, 450); }, 2400);
}
let hintTimer = 0;
function hint(text, dur = 4) {
  const h = $('hint'); h.textContent = text; h.classList.add('on');
  clearTimeout(hintTimer); if (dur > 0) hintTimer = setTimeout(() => h.classList.remove('on'), dur * 1000);
}
function clearHint() { $('hint').classList.remove('on'); }
let txTimer = 0, txType = 0;
function transmission(idx) {
  const el = $('tx'), L = LORE[idx], span = el.querySelector('span');
  el.querySelector('small').textContent = `TRANSMISSION ${idx + 1}/${LORE.length} · ${L.m} m`;
  span.textContent = ''; el.classList.add('on');
  let i = 0; clearInterval(txType);
  txType = setInterval(() => { i += 2; span.textContent = L.t.slice(0, i); if (i >= L.t.length) clearInterval(txType); }, 28);
  clearTimeout(txTimer); txTimer = setTimeout(() => el.classList.remove('on'), Math.max(6000, L.t.length * 70));
}

// ---------- tutorial ----------
const TUT = [
  { t: () => isTouch ? 'Touch anywhere and drag to swim' : 'Swim with WASD or the arrow keys', done: () => G.P.spd > 70 && G.time > 1.5 },
  { t: () => 'Eat creatures with green eyes. Red eyes bite back.', done: () => G.stats.eaten >= 2 },
  { t: () => isTouch ? 'Quick tap to dash. You can\'t be hurt mid-dash.' : 'Space to dash. You can\'t be hurt mid-dash.', done: () => G.P.dashCd > 0 },
  { t: () => isTouch ? 'Tap SONAR to reveal and stun everything nearby' : 'Press E for sonar: it reveals and stuns', done: () => G.P.sonarCd > 0 },
  { t: () => 'Your light drains. Keep eating to keep it burning.', done: () => G.tutT > 5 },
];
function tutorialTick() {
  if (G.tutStep === undefined) { G.tutStep = 0; G.tutT = 0; }
  const s = TUT[G.tutStep]; if (!s) return;
  G.tutT += 1 / 60;
  if (!$('hint').classList.contains('on')) hint(s.t(), 0);
  if (s.done()) {
    G.tutStep++; G.tutT = 0; clearHint();
    if (G.tutStep >= TUT.length) { save.tutorial = true; persist(); }
  }
}

// ---------- flow ----------
let wakeLock = null;
function keepAwake(on) {
  try {
    if (on && navigator.wakeLock && !wakeLock) navigator.wakeLock.request('screen').then(l => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); }).catch(() => { });
    if (!on && wakeLock) { wakeLock.release(); wakeLock = null; }
  } catch (e) { }
}
function startGame(mode) {
  Sound.init();
  newRun(mode);
  G.state = 'play'; G.tutStep = undefined;
  show(null); $('hud').hidden = false;
  $('ctrl').classList.toggle('left', !!save.settings.lefty); document.body.classList.toggle('lefty', !!save.settings.lefty);
  $('hMode').textContent = mode === 'daily' ? 'DAILY · ' + dailyMod().name.toUpperCase() : mode === 'zen' ? 'ZEN' : '';
  hudCache = {};
  if (mode === 'daily') banner('Daily Dive', dailyMod().name + ': ' + dailyMod().d, false, 3.5);
  else if (mode === 'zen') banner('Zen Drift', 'No danger. Breathe.', false, 3);
  else banner(ZONES[zoneAt(toM(G.P.y))].name, 'Dive ' + (save.stats.runs + 1), false, 2.6);
  keepAwake(true);
}
function pauseGame() {
  if (G.state !== 'play') return;
  G.state = 'pause';
  const P = G.P;
  $('pStats').innerHTML = statHTML([['Depth', toM(P.maxY) + ' m'], ['Time', fmtTime(G.time)], ['Level', P.lvl], ['Eaten', G.stats.eaten]]);
  const muts = Object.entries(P.muts);
  $('pMuts').innerHTML = muts.length ? muts.map(([id, lv]) => `<span class="chip">${MUT[id].icon} ${MUT[id].name}${lv > 1 ? ' ' + lv : ''}</span>`).join('') : '<span class="chip">None yet</span>';
  show('sPause');
}
function resumeGame() { G.state = 'play'; show(null); }
function statHTML(rows) { return rows.map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join(''); }

function gameOver(quit) {
  if (G.over) return;
  G.over = true; G.state = 'over';
  const P = G.P, md = toM(P.maxY);
  if (!quit) {
    Sound.die(); haptic([80, 60, 200]);
    for (let i = 0; i < 40; i++) addPart('dot', P.x, P.y, rnd(-260, 260), rnd(-260, 260), rnd(0.6, 1.6), rnd(2, 5), '#6ff7ff');
    addPart('ring', P.x, P.y, 0, 0, 1.2, 300, '#6ff7ff');
  }
  Sound.boss(false);
  const bonusRaw = Math.floor(md / (G.zen ? 200 : 100)) * (1 + metaLv('diver') * 0.2);
  const bonus = Math.floor(bonusRaw);
  save.pearls += bonus; save.stats.pearlsTotal += bonus;
  let rec = false;
  if (G.mode === 'classic' && md > save.best) { save.best = md; rec = true; }
  if (G.mode === 'zen' && md > save.bestZen) { save.bestZen = md; rec = true; }
  if (G.mode === 'daily') {
    if (save.daily.date !== todayKey()) save.daily = { date: todayKey(), best: 0, runs: 0 };
    save.daily.runs++; if (md > save.daily.best) { save.daily.best = md; rec = true; }
    unlock('daily');
  }
  save.stats.runs++; save.stats.eaten += G.stats.eaten; save.stats.time += G.time; if (!quit) save.stats.deaths++;
  if (G.zen) save.stats.zenTime += G.time;
  if (save.stats.pearlsTotal >= 300) unlock('rich');
  persist();
  keepAwake(false);
  setTimeout(() => {
    $('hud').hidden = true;
    $('oTitle').textContent = quit ? 'Dive ended' : 'Lights out';
    $('oDepth').textContent = md;
    $('oRec').hidden = !rec;
    $('oEarn').textContent = `+${G.stats.pearls + bonus} pearls  (${G.stats.pearls} found, ${bonus} depth bonus)`;
    $('oStats').innerHTML = statHTML([['Time', fmtTime(G.time)], ['Level', P.lvl], ['Eaten', G.stats.eaten], ['Best combo', 'x' + G.stats.maxCombo], ['Kills', G.stats.kills], ['Guardians', G.stats.bosses]]);
    const chips = G.stats.codex.map(k => `<span class="chip">🔎 ${SPECIES[k].name}</span>`);
    if (G.stats.lore) chips.push(`<span class="chip">📡 ${G.stats.lore} transmission${G.stats.lore > 1 ? 's' : ''}</span>`);
    $('oUnl').innerHTML = chips.join('');
    show('sOver');
  }, quit ? 50 : 1600);
}
function toTitle() {
  G.state = 'title'; $('hud').hidden = true; newRun('demo');
  refreshTitle(); show('sTitle'); keepAwake(false);
}
function refreshTitle() {
  $('tBest').textContent = save.best + ' m';
  $('tPearls').textContent = save.pearls;
  const dm = dailyMod(), db = save.daily.date === todayKey() ? save.daily.best : 0;
  $('tDaily').textContent = `Today: ${dm.name}. ${dm.d}${db ? ` Best ${db} m.` : ''}`;
  const sw = 'serviceWorker' in navigator && window.isSecureContext && /^https?:$/.test(location.protocol);
  $('tFoot').textContent = sw ? 'Add to your home screen to play offline anywhere. Progress saves on this device.' : 'Runs fully offline. Progress saves on this device.';
}

// ---------- level up ----------
let offers = [];
function openLevelUp() {
  if (G.state !== 'play') return;
  offers = offerMutations();
  if (!offers.length) { G.pendingPicks = 0; return; }
  G.state = 'level'; Input.joy = null;
  renderCards();
  show('sLevel');
}
function renderCards() {
  const P = G.P;
  $('lvSub').textContent = G.pendingPicks > 1 ? `Your core evolves. ${G.pendingPicks} choices waiting.` : `Level ${P.lvl}. Choose one.`;
  const box = $('cards');
  box.innerHTML = offers.map((m, i) => {
    const lv = (P.muts[m.id] || 0) + 1;
    return `<button class="card ${m.tier}" data-i="${i}" style="pointer-events:none"><span class="ic">${m.icon}</span><div><span class="tier">${m.tier}</span><br><b>${m.name}<span class="lv">${lv > 1 ? 'Lv ' + lv : 'New'}</span></b><small>${m.d}</small></div></button>`;
  }).join('');
  const rr = $('bReroll'); rr.textContent = `Reroll (${G.rerolls})`; rr.hidden = G.rerolls <= 0;
  setTimeout(() => box.querySelectorAll('.card').forEach(c => c.style.pointerEvents = ''), 380);
}
$('cards').addEventListener('click', e => {
  const c = e.target.closest('.card'); if (!c) return;
  const m = offers[+c.dataset.i]; if (!m) return;
  applyMutation(m.id); Sound.pick(); haptic(12);
  G.pendingPicks--;
  if (G.pendingPicks > 0) { offers = offerMutations(); if (offers.length) { renderCards(); return; } G.pendingPicks = 0; }
  G.state = 'play'; show(null);
});
tap('bReroll', () => { if (G.rerolls <= 0) return; G.rerolls--; offers = offerMutations(); renderCards(); });

// ---------- HUD ----------
let hudCache = {};
function setTxt(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function setW(id, f) { f = Math.round(clamp(f, 0, 1) * 200) / 200; if (hudCache[id] !== f) { hudCache[id] = f; $(id).style.transform = `scaleX(${f})`; } }
function setP(el, key, f, ready) {
  f = Math.round(clamp(f, 0, 1) * 60) / 60;
  if (hudCache[key] !== f) { hudCache[key] = f; el.style.setProperty('--p', f); el.classList.toggle('ready', ready); }
}
function updateHUD() {
  if (G.state !== 'play' && G.state !== 'level' && G.state !== 'pause') return;
  const P = G.P, S = G.S, md = toM(P.y);
  setTxt('hDepth', String(md));
  setTxt('hZone', ZONES[zoneAt(md)].name);
  const best = G.mode === 'daily' ? (save.daily.date === todayKey() ? save.daily.best : 0) : G.zen ? save.bestZen : save.best;
  setTxt('hBest', best ? `best ${best} m` : '');
  const frac = P.light / P.maxLight;
  setW('hLight', frac); setW('hXp', P.xp / P.xpNext);
  const low = frac < 0.25 && !G.zen; if (hudCache.low !== low) { hudCache.low = low; $('hLightBar').classList.toggle('low', low); }
  setTxt('hLvl', String(P.lvl)); setTxt('hPearls', String(save.pearls));
  const cb = $('combo');
  if (P.combo >= 3) { setTxt('combo', `x${P.combo} ${P.combo >= 25 ? 'APEX FRENZY' : P.combo >= 15 ? 'FRENZY' : P.combo >= 8 ? 'FEEDING' : 'COMBO'}`); if (!hudCache.cbon) { cb.classList.add('on'); hudCache.cbon = true; } }
  else if (hudCache.cbon) { cb.classList.remove('on'); hudCache.cbon = false; }
  setP($('bDash'), 'dash', 1 - Math.max(0, P.dashCd) / S.dashCd, P.dashCd <= 0);
  setP($('bSonar'), 'sonar', 1 - Math.max(0, P.sonarCd) / S.sonarCd, P.sonarCd <= 0);
  const bb = $('bossbar');
  if (G.boss) {
    if (bb.hidden) { bb.hidden = false; }
    setTxt('bossName', G.boss.name + (G.boss.kind === 'overmind' ? (G.boss.shieldDown > 0 ? ' · exposed' : ' · shielded') : ''));
    setW('bossHp', G.boss.hp / G.boss.maxHp);
  } else if (!bb.hidden) bb.hidden = true;
}

// ---------- menus ----------
function renderShop() {
  $('shPearls').textContent = save.pearls;
  $('shopList').innerHTML = META.map(u => {
    const lv = metaLv(u.id), maxed = lv >= u.max, cost = maxed ? 0 : u.cost[lv];
    const locked = u.id === 'express' && !save.bosses.kraken;
    return `<div class="item${locked ? ' locked' : ''}"><span class="ic">${u.icon}</span><div class="tx"><b>${u.name}</b><small>${locked ? 'Defeat the Kraken Matriarch to unlock.' : u.d(Math.max(1, maxed ? lv : lv + 1))}</small>
      <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>
      <button class="buy" data-id="${u.id}" ${maxed || locked || save.pearls < cost ? 'disabled' : ''}>${maxed ? 'MAX' : '◉ ' + cost}</button></div>`;
  }).join('');
}
$('shopList').addEventListener('click', e => {
  const b = e.target.closest('.buy'); if (!b || b.disabled) return;
  const u = META.find(x => x.id === b.dataset.id), lv = metaLv(u.id);
  if (lv >= u.max || save.pearls < u.cost[lv]) return;
  save.pearls -= u.cost[lv]; save.meta[u.id] = lv + 1; persist();
  Sound.init(); Sound.pearl(); haptic(15); renderShop(); refreshTitle();
});
let cxTab = 'life';
function renderCodex() {
  document.querySelectorAll('#cxTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === cxTab));
  const list = $('cxList');
  if (cxTab === 'life') {
    const n = CODEX_ORDER.filter(k => save.codex[k]).length;
    $('cxSub').textContent = `${n} of ${CODEX_ORDER.length} discovered`;
    list.innerHTML = CODEX_ORDER.map(k => {
      const s = SPECIES[k], known = !!save.codex[k];
      const where = s.boss ? `Guardian` : `${s.zone[0]}${s.zone[1] > 50000 ? '+' : '–' + s.zone[1]} m`;
      return `<div class="item${known ? '' : ' locked'}"><canvas width="112" height="80" style="width:56px;height:40px" data-k="${k}"></canvas><div class="tx"><b>${known ? s.name : 'Unknown'}</b><small>${known ? s.desc : 'Not yet seen.'}</small><small style="color:var(--cyan)">${where}</small></div></div>`;
    }).join('');
    list.querySelectorAll('canvas').forEach(cv => { const g = cv.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0); const fake = { width: 56, height: 40, getContext: () => g }; drawCodexThumb(fake, cv.dataset.k, !!save.codex[cv.dataset.k]); });
  } else if (cxTab === 'lore') {
    const n = LORE.filter((_, i) => save.lore[i]).length;
    $('cxSub').textContent = `${n} of ${LORE.length} transmissions recovered`;
    list.innerHTML = LORE.map((L, i) => save.lore[i]
      ? `<div class="item"><div class="tx lore"><em>TRANSMISSION ${i + 1} · ${L.m} m</em>${L.t}</div></div>`
      : `<div class="item locked"><div class="tx lore"><em>TRANSMISSION ${i + 1}</em>Signal lost near ${L.m} m.</div></div>`).join('');
  } else {
    const n = ACHIEVEMENTS.filter(a => save.ach[a.id]).length;
    $('cxSub').textContent = `${n} of ${ACHIEVEMENTS.length} feats`;
    list.innerHTML = ACHIEVEMENTS.map(a => `<div class="item${save.ach[a.id] ? '' : ' locked'}"><span class="ic">${save.ach[a.id] ? a.icon : '🔒'}</span><div class="tx"><b>${a.name}</b><small>${a.d}</small></div></div>`).join('');
  }
  list.scrollTop = 0;
}
document.querySelectorAll('#cxTabs button').forEach(b => b.addEventListener('click', () => { cxTab = b.dataset.t; Sound.click(); renderCodex(); }));

let resetArm = 0;
function renderSettings() {
  const s = save.settings;
  const row = (key, label, sub, on) => `<button class="toggle${on ? ' on' : ''}" data-k="${key}"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="sw"></span></button>`;
  const q = { high: 'High', med: 'Medium', low: 'Low (saves battery)' }[s.quality];
  $('setList').innerHTML = [
    row('sound', 'Sound effects', '', s.sound), row('music', 'Ambient music', 'Synthesized live, reacts to depth', s.music),
    row('haptics', 'Vibration', 'Android only; iPhone browsers ignore it', s.haptics), row('shake', 'Screen shake', '', s.shake),
    row('lefty', 'Buttons on the left', 'For left-handed play', s.lefty),
    `<button class="toggle" data-k="quality"><span>Graphics<small>${q}</small></span><span style="color:var(--cyan)">Change</span></button>`,
    `<button class="toggle" data-k="reset"><span>${resetArm ? 'Tap again to erase everything' : 'Reset all progress'}<small>Pearls, upgrades, codex and records</small></span><span style="color:var(--red)">${resetArm ? 'Confirm' : 'Reset'}</span></button>`,
  ].join('');
}
$('setList').addEventListener('click', e => {
  const b = e.target.closest('.toggle'); if (!b) return;
  const k = b.dataset.k, s = save.settings;
  Sound.init(); Sound.click();
  if (k === 'quality') { s.quality = s.quality === 'high' ? 'med' : s.quality === 'med' ? 'low' : 'high'; resize(); }
  else if (k === 'reset') {
    if (!resetArm) { resetArm = 1; setTimeout(() => { resetArm = 0; if ($('sSettings').classList.contains('on')) renderSettings(); }, 3000); }
    else { const keep = s; Object.assign(save, defaultSave()); save.settings = keep; resetArm = 0; refreshTitle(); }
  } else s[k] = !s[k];
  persist(); Sound.applySettings(); renderSettings();
  $('ctrl').classList.toggle('left', !!s.lefty); document.body.classList.toggle('lefty', !!s.lefty);
});

function openScreen(id, from) {
  backTo = from;
  if (id === 'sShop') renderShop();
  if (id === 'sCodex') renderCodex();
  if (id === 'sSettings') renderSettings();
  show(id);
}
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => {
  Sound.click(); refreshTitle(); show(backTo);
}));

tap('bDive', () => startGame('classic'));
tap('bDaily', () => startGame('daily'));
tap('bZen', () => startGame('zen'));
tap('bShop', () => openScreen('sShop', 'sTitle'));
tap('bCodex', () => openScreen('sCodex', 'sTitle'));
tap('bSettings', () => openScreen('sSettings', 'sTitle'));
tap('bHow', () => openScreen('sHow', 'sTitle'));
tap('bPause', () => pauseGame());
tap('bResume', () => resumeGame());
tap('bPSettings', () => openScreen('sSettings', 'sPause'));
tap('bQuit', () => { show(null); gameOver(true); });
tap('bAgain', () => startGame(G.mode === 'demo' ? 'classic' : G.mode));
tap('bOShop', () => openScreen('sShop', 'sOver'));
tap('bMenu', () => toTitle());
// action buttons respond on press, not release
const press = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Sound.init(); fn(); });
press('bDash', () => { Input.dash = true; });
press('bSonar', () => { Input.sonar = true; });
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') pauseGame(); else if (G.state === 'pause') resumeGame(); }
  if ((e.code === 'Enter') && G.state === 'title' && $('sTitle').classList.contains('on')) startGame('classic');
  if (G.state === 'level' && /^Digit[123]$/.test(e.code)) { const c = $('cards').children[+e.code.slice(5) - 1]; if (c) c.click(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pauseGame(); Sound.suspend(); }
  else { Sound.resume(); if (G.state === 'play') keepAwake(true); }
});
