# LUMEN: Deep Sea of AI

A one-thumb mobile game. You are LUMEN-7, a small bioluminescent probe sent down a
bottomless trench to find out why the Deep Array (an AI buried in the cold) went silent.
Your light is your health and your vision. It drains as you go. Eat to keep it burning.

Everything is in one file, `index.html`: graphics are drawn in code and every sound is
synthesized live. No images, fonts, or network calls are needed to play.

## Play offline on your phone

**Option A: install it (recommended).** Once GitHub Pages is on (see below), open
`https://sharkshake-afk.github.io/deepseaofai-assets/game/` on your phone, wait a few
seconds, then use **Share > Add to Home Screen** (iPhone) or **Install app** (Android).
The service worker caches the game, so it launches from the home screen in airplane mode.

**Option B: just open the file.** `index.html` runs straight from disk in a browser.

To turn on GitHub Pages: repo **Settings > Pages > Build and deployment**, Source
"Deploy from a branch", pick the branch that holds this folder and `/ (root)`, Save.

## How to play

| Action | Touch | Keyboard |
| --- | --- | --- |
| Swim | Touch anywhere and drag (floating joystick) | WASD / arrows |
| Dash (invulnerable, rams big creatures) | Quick tap, second finger, or DASH | Space |
| Sonar (reveal + stun, drops boss shields) | SONAR button | E / Shift |
| Pause | II button | Esc / P |

* **Green eyes**: you can eat it. **Red eyes**: it can eat you.
* A brighter lantern shows more, but predators notice you from farther away.
* Each level offers 3 of 20 mutations (zappers, orbiting drones, ink, nova dashes, a second heart...).
* Guardians wait at **1000 m** (Kraken Matriarch), **3000 m** (Abyssal Leviathan) and
  **6000 m** (The Overmind). Past that the descent is endless, with stronger echoes of each.
* Pearls buy permanent upgrades in **Evolve**. The **Codex** tracks 18 creatures,
  12 story transmissions and 20 feats.
* **Daily Dive**: the same trench for everyone each day, with a daily modifier.
* **Zen Drift**: no predators, no drain. Good for turbulence.

## Development

Source lives in `src/`. Rebuild the single-file game after editing:

```sh
node game/build.mjs
```

Open `index.html?debug` to expose `window.__dbg` for testing.
