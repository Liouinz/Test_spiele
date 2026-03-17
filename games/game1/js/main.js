/**
 * ============================================================
 * MAIN MODULE  –  main.js
 * ============================================================
 * Game-Einstiegspunkt und Haupt-Loop.
 *
 * Verantwortlich für:
 *   - Initialisierung aller Systeme in der richtigen Reihenfolge
 *   - requestAnimationFrame Game Loop
 *   - Koordination aller Systeme pro Frame
 *   - Rundenende + Neustart-Logik
 *
 * Initialisierungs-Reihenfolge (wichtig!):
 *   1. Engine (Renderer, Scene, Camera)
 *   2. UI-System (DOM-Elemente müssen existieren)
 *   3. Particle-System (braucht Scene)
 *   4. Coin-System (braucht Scene + Particles + UI)
 *   5. World (braucht Scene) → baut Terrain, Wald, Zaun
 *   6. Player (braucht Scene) → baut Charakter
 *   7. Input-System (braucht Renderer-Canvas)
 *   8. Camera-Controller (braucht Camera)
 *   9. Game Loop starten
 *
 * Frame-Update-Reihenfolge:
 *   1. Input lesen
 *   2. Player updaten (Bewegung + Animation)
 *   3. Kamera updaten (folgt Spieler)
 *   4. World updaten (Wind-Animation)
 *   5. Coins updaten (Animation + Kollision)
 *   6. Partikel updaten
 *   7. Sonne dem Spieler folgen lassen
 *   8. Render
 * ============================================================
 */

import { Engine }                          from './engine.js';
import { World }                           from './world.js';
import { Player }                          from './player.js';
import { InputSystem, CameraController,
         CoinSystem, ParticleSystem,
         UISystem }                        from './systems.js';
import { THREE }                           from './engine.js';

// ─── Globaler Game-State ──────────────────────────────────
const state = {
  running:    true,
  winTimer:   0,
  winShown:   false,
  WIN_DELAY:  3.0,   // Sekunden bis neue Runde startet
};

// ─── Modul-Instanzen ──────────────────────────────────────
let engine, world, player, input, camera, coins, particles, ui;

// ─── Clock für dt ─────────────────────────────────────────
const clock   = { last: 0, elapsed: 0 };

// ─── Bootstrap ────────────────────────────────────────────
function init() {
  // 1. Engine
  engine = new Engine();
  engine.init(document.body);

  // 2. UI
  ui = new UISystem();
  ui.init();

  // 3. Partikel
  particles = new ParticleSystem(engine.scene);

  // 4. Coins
  coins = new CoinSystem(engine.scene, particles, ui);
  coins.spawn(20, 32, 64);

  // 5. Welt
  world = new World(engine);
  world.build();

  // 6. Spieler
  player = new Player(engine.scene);
  player.build();

  // 7. Input
  input = new InputSystem();
  input.init(engine.renderer.domElement);

  // 8. Kamera
  camera = new CameraController(engine.camera);

  // Loop starten
  requestAnimationFrame(loop);
}

// ─── Game Loop ────────────────────────────────────────────
function loop(timestamp) {
  requestAnimationFrame(loop);

  // dt berechnen (max 50ms = 20fps Minimum, verhindert Physik-Tunneling)
  const dt       = Math.min((timestamp - clock.last) / 1000, 0.05);
  clock.last     = timestamp;
  clock.elapsed += dt;

  if (!state.running) return;

  // 1. Spieler updaten
  const dir = input.getDirection();
  player.update(dt, dir, camera.h);

  // 2. Kamera updaten
  camera.update(dt, player.getPosition(), input);

  // 3. Welt (Wind)
  world.update(dt, clock.elapsed);

  // 4. Münzen (Animation + Kollision)
  coins.update(dt, clock.elapsed, player.getPosition());

  // 5. Partikel
  particles.update(dt);

  // 6. Sonne folgt Spieler (damit Schatten immer sichtbar)
  engine.followSun(player.getPosition());

  // 7. Rundenende-Logik
  _checkWin(dt);

  // 8. Render
  engine.render();
}

// ─── Rundenende ───────────────────────────────────────────
function _checkWin(dt) {
  if (!state.winShown && coins.allCollected()) {
    state.winShown = true;
    state.winTimer = state.WIN_DELAY;
    ui.showWinBanner();
  }

  if (state.winShown) {
    state.winTimer -= dt;
    if (state.winTimer <= 0) {
      state.winShown = false;
      ui.hideWinBanner();
      // Spieler in die Mitte zurücksetzen
      player.group.position.set(0, 0, 0);
      player.velocity.set(0, 0, 0);
      // Neue Runde
      coins.spawn(20, 32, 64);
    }
  }
}

// ─── Start ────────────────────────────────────────────────
// Warten bis DOM geladen ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
