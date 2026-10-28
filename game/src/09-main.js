// ============================================================
//  Boot & main loop
// ============================================================
resize();
newRun('demo');
refreshTitle();
show('sTitle');
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
  try {
    if (G.state === 'play' || G.state === 'title' || G.state === 'over') update(dt);
    updateCamera(dt);
    render();
    updateHUD();
    Sound.tick(dt, G);
  } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && window.isSecureContext && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js').catch(() => { });
}
window.__lumen = G; // handy for debugging
if (location.search.includes('debug')) window.__dbg = { G, Input, update, updateCamera, render, startGame, applyMutation, newRun, calcStats, save, BOSSES, SPECIES, drawPlayerBody, drawPlayerEmit, glow };
