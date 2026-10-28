# Squad Surge

An offline gate-runner shooter in the style of the "Last War" ads, but actually the
game the ads promise. Your squad runs up a highway and fires on its own. You steer
through gates that add or multiply soldiers, shoot crates open, blow up barrels in the
horde, and take on a boss at the end of every stage.

Everything is one file, `index.html`: art is drawn in code, sound and music are
synthesized live, and nothing is downloaded. No ads, no energy timers, no purchases.

## What's in it

* **Gates you can shoot.** Fire into a red −12 long enough and it flips to a +.
  ÷2 gates can be shot into ×2. Gold weapon gates upgrade every gun in the squad
  (Pistol → SMG → Rifle → Minigun → Plasma → Railgun).
* **Five zombie types**: walkers, runners, brutes that latch on and chew, exploders
  that burst on death, and spitters that lob acid you have to steer out of.
* **Three bosses**, cycling by stage: the Titan (thrown boulders), the Warmech
  (missile barrages) and the Hive Queen (spawns the swarm and spits acid).
* **Airstrike** (charged by kills) and **Shield** (unlocked at HQ) abilities.
* **Headquarters**: 8 permanent upgrade tracks bought with coins.
* **Campaign** with 1–3 stars per stage, **Endless Rush**, and a **Daily Op** with a
  daily rule twist. Stage layouts are fixed per stage, so a retry is learnable.
* Hordes and bosses scale with your squad, so a huge squad gets a huge fight.

## Play offline on your phone

Same as the deep-sea game: host the repo on GitHub Pages, open
`https://sharkshake-afk.github.io/deepseaofai-assets/squad/` once, then **Add to Home Screen**.
Or open `index.html` directly in a browser.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Steer | Drag left/right anywhere | A/D or arrows |
| Airstrike | ✈️ button | Space or Q |
| Shield | 🛡️ button | E |
| Pause | II | Esc / P |

## Development

Source is in `src/`; run `node squad/build.mjs` to rebuild `index.html`.
`index.html?debug` exposes `window.__dbg` for automated play-testing.
