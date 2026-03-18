// main.js - Game entry point.
// Initialises all systems in the correct order and runs the main game loop.

import { render } from './core/engine.js';
import { initTouchControls, isPausePressed } from './core/input.js';
import {
  isRunning, isPaused, isGameOver,
  togglePause, reset, resetStats, addKill
} from './core/gameState.js';
import { loadAll } from './core/loader.js';

import { createWorld }         from './world/world.js';
import { createFence, getFenceColliders } from './world/fence.js';
import { createBackground }    from './world/background.js';
import { createDecorations }   from './world/decorations.js';

import { initPlayer, updatePlayer, setObstacles, resetPlayer } from './entities/player/playerController.js';
import { createSword }         from './entities/combat/sword.js';
import { updateAttack }        from './entities/combat/attackHandler.js';
import { setHealthManager, setParticleSystem } from './entities/combat/damageSystem.js';
import { damagePlayer, updateHealth, resetHealth, getPlayerHP } from './entities/health/healthManager.js';
import { initEnemies, updateEnemies, clearEnemies } from './entities/enemy/enemyController.js';
import { initCoins, updateCoins, clearCoins }       from './entities/coin/coinSystem.js';
import { burst, updateParticles }                   from './entities/particle/particleSystem.js';

import { initUI }              from './ui/uiManager.js';
import { initInventory }       from './ui/hud/inventory.js';
import { updateWeaponInfo }    from './ui/hud/weaponInfo.js';
import { initLauncherButton }  from './ui/launcherButton.js';
import { initPauseMenu }       from './ui/menus/pauseMenu.js';
import { initGameOverMenu }    from './ui/menus/gameOverMenu.js';
import { initSettingsMenu }    from './ui/menus/settingsMenu.js';

import { initDebugPanel, updateDebugPanel } from './systems/debug/debugPanel.js';

import level1 from './levels/level1.js';

// ─── Module-level refs ────────────────────────────────────────────────────────
let playerGroup = null;
let clock       = null;
let pauseDebounce = 0;

// ─── Initialise ───────────────────────────────────────────────────────────────
async function init() {
  // Show loading bar
  simulateLoadingBar();

  await loadAll();

  // ── World ──
  createWorld();
  createFence();
  createBackground();
  createDecorations();

  // ── Player ──
  const playerRef = initPlayer();
  playerGroup = playerRef.group;

  // Attach sword to right arm
  const armR = playerGroup.getObjectByName('ArmR');
  if (armR) {
    const sword = createSword();
    armR.add(sword);
  }

  // ── Collision obstacles = fence walls ──
  const fenceBoxes = getFenceColliders();
  setObstacles(fenceBoxes);

  // ── Health system ──
  // Pass healthManager functions as an object so damageSystem can call them
  const healthManagerObj = { damagePlayer };
  setHealthManager(healthManagerObj);

  // ── Particle system ──
  const particleSystemObj = { burst };
  setParticleSystem(particleSystemObj);

  // ── Enemies ──
  initEnemies(level1.enemies, fenceBoxes);

  // ── Coins ──
  initCoins(level1.coins);

  // ── UI ──
  initUI();
  initInventory();
  updateWeaponInfo();
  initLauncherButton();
  initPauseMenu();
  initGameOverMenu();
  initSettingsMenu();

  // ── Touch controls ──
  initTouchControls();

  // ── Debug ──
  initDebugPanel();

  // ── Expose restart for menus ──
  window.restartGame = restartGame;

  // ── Hide loading screen ──
  const loadScreen = document.getElementById('loading-screen');
  if (loadScreen) {
    loadScreen.classList.add('hidden');
    setTimeout(() => { loadScreen.style.display = 'none'; }, 600);
  }

  // ── Start loop ──
  clock = { last: performance.now() };
  requestAnimationFrame(loop);
}

// ─── Main Loop ────────────────────────────────────────────────────────────────
function loop(now) {
  requestAnimationFrame(loop);

  const delta = Math.min((now - clock.last) / 1000, 0.05); // Cap at 50ms to avoid spiral
  clock.last  = now;

  // ── Pause toggle (debounced to avoid flicker) ─────────────────────────────
  pauseDebounce -= delta;
  if (isPausePressed() && pauseDebounce <= 0 && !isGameOver()) {
    togglePause();
    pauseDebounce = 0.4;
  }

  if (!isRunning()) {
    render();
    return;
  }

  // ── Update all systems ────────────────────────────────────────────────────
  updateHealth(delta);

  updatePlayer(delta);

  const playerPos = playerGroup?.position ?? { x: 0, y: 0, z: 0 };

  // Attack (sword raycast)
  updateAttack(delta, playerPos, (enemyGroup, dmg) => {
    // Hit visual feedback: small particle burst at enemy position
    burst(enemyGroup.position.clone().add({ x: 0, y: 0.8, z: 0 }), 0xFFDD88, 6, 3);
  });

  // Enemies
  updateEnemies(playerPos, delta, (damage) => {
    // Enemy hit the player
    damagePlayer(damage);
    burst(playerPos.clone().add({ x: 0, y: 1, z: 0 }), 0xFF4444, 5, 2);
  });

  // Coins
  updateCoins(playerPos, delta, (coinPos) => {
    burst(coinPos, 0xFFD700, 10, 3);
  });

  // Particles
  updateParticles(delta);

  // Debug panel
  updateDebugPanel(delta, playerPos, 0);

  // ── Render ────────────────────────────────────────────────────────────────
  render();
}

// ─── Restart ─────────────────────────────────────────────────────────────────
function restartGame() {
  reset();
  resetStats();
  resetHealth();
  resetPlayer();
  clearEnemies();
  clearCoins();
  initEnemies(level1.enemies, getFenceColliders());
  initCoins(level1.coins);

  const goMenu = document.getElementById('gameover-menu');
  if (goMenu) goMenu.style.display = 'none';
}

// ─── Loading bar simulation ───────────────────────────────────────────────────
function simulateLoadingBar() {
  const fill = document.getElementById('loading-bar-fill');
  if (!fill) return;
  let pct = 0;
  const iv = setInterval(() => {
    pct += 8 + Math.random() * 12;
    fill.style.width = Math.min(90, pct) + '%';
    if (pct >= 90) clearInterval(iv);
  }, 80);
  // Complete on init finish (called externally via timeout safety)
  setTimeout(() => { fill.style.width = '100%'; }, 800);
}

// ─── Kick off ─────────────────────────────────────────────────────────────────
init().catch(err => {
  console.error('[Main] Fatal initialisation error:', err);
});
