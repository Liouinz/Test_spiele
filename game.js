// ═══════════════════════════════════════════════════════════════
//  COIN FOREST v5.1 – game.js
//  Hauptschleife, Kamera, Spieler, Level-System, Koordination
// ═══════════════════════════════════════════════════════════════

'use strict';

// ── Globale Hilfsfunktionen (für andere Module) ────────────────
function togglePause() { Game.togglePause(); }
function goToMenu()    { Game.goToMenu();    }

const Game = (() => {

  const TILE = 40;

  // ── Spieler-State ──────────────────────────────────────────
  const player = {
    x: 0, y: 0,
    hp: 3, maxHp: 3,
    speed: TILE,
    invFrames: 0,
    score: 0,
    coins: 0,
    level: 1,
    coinsForNextLevel: 15,
    animFrame: 0,
    animTimer: 0,
    moveTimer: 0,
    // Power-Ups (Verbleibende Ticks)
    activePowerUps: { speed: 0, shield: 0, freeze: 0, magnet: 0, invis: 0 },
    bomb: 0,   // Einmalig-Flag
    bestCombo: 0,
    gameTime: 0,
  };

  // ── Kamera ────────────────────────────────────────────────
  const cam = { x: 0, y: 0 };

  // ── Game-State ────────────────────────────────────────────
  let paused    = false;
  let gameActive = false;
  let tick      = 0;
  let animId    = null;
  let canvas    = null;
  let ctx       = null;
  let viewW     = 0;
  let viewH     = 0;

  // Map-Einstellungen
  const MAP_SIZES = {
    klein:  1280,
    mittel: 2560,
    gross:  5120,
    episch: 10240,
  };

  // ── Canvas vorbereiten ────────────────────────────────────
  function resizeCanvas() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    viewW = canvas.width  = Math.round(rect.width)  || 320;
    viewH = canvas.height = Math.round(rect.height) || 480;
    ctx   = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
  }

  // ── Spiel starten ─────────────────────────────────────────
  function startGame() {
    // Einstellungen lesen
    const mapSizeKey  = Auth ? Auth.getSetting('mapSize', 'mittel') : 'mittel';
    const startSeason = Auth ? Auth.getSetting('startSeason', 0) : 0;
    const sizeInTiles = MAP_SIZES[mapSizeKey] || 2560;
    const seed        = Math.floor(Math.random() * 0x7fffffff);

    // Map initialisieren
    MapSystem.init(seed, sizeInTiles);

    // Spieler-Spawn
    const spawn = MapSystem.findSpawnPoint();
    player.x    = spawn.x;
    player.y    = spawn.y;

    // Spieler-Reset
    player.hp                 = 3;
    player.maxHp              = 3;
    player.score              = 0;
    player.coins              = 0;
    player.level              = 1;
    player.coinsForNextLevel  = 15;
    player.invFrames          = 0;
    player.bestCombo          = 0;
    player.gameTime           = 0;
    player.animFrame          = 0;
    player.animTimer          = 0;
    player.moveTimer          = 0;
    Object.keys(player.activePowerUps).forEach(k => player.activePowerUps[k] = 0);

    // Kamera zentrieren
    cam.x = player.x - viewW / 2;
    cam.y = player.y - viewH / 2;

    // Welt initialisieren
    World.init(startSeason);

    // Partikel löschen
    Particles.clear();
    Particles.setTileSize(TILE);

    // Banditen spawnen
    spawnBanditsForLevel(1, spawn);

    // UI
    UI.initHUD();
    UI.resetCombo && UI.resetCombo();

    // Input entsperren
    Input.unlock();

    tick        = 0;
    paused      = false;
    gameActive  = true;

    UI.showScreen('screen-game');
    resizeCanvas();

    // Lade-Loop starten
    if (animId) cancelAnimationFrame(animId);
    gameLoop();
  }

  // ── Banditen spawnen ──────────────────────────────────────
  function spawnBanditsForLevel(level, playerSpawn) {
    const baseCount  = 6 + level * 2;
    const worldTiles = MapSystem.worldWidth;

    Enemies.spawnBandits(level, baseCount, (idx) => {
      // Nicht zu nah am Spieler
      let tries = 0;
      let x, y;
      do {
        const angle = Math.random() * Math.PI * 2;
        const dist  = (10 + Math.random() * 30) * TILE;
        x = playerSpawn.x + Math.cos(angle) * dist;
        y = playerSpawn.y + Math.sin(angle) * dist;
        x = Math.max(TILE * 2, Math.min(worldTiles * TILE - TILE * 2, x));
        y = Math.max(TILE * 2, Math.min(worldTiles * TILE - TILE * 2, y));
        tries++;
      } while (tries < 20 && MapSystem.isBlockingAtPixel(x, y));
      return { x, y };
    });
  }

  // ── Hauptschleife ─────────────────────────────────────────
  function gameLoop() {
    if (!gameActive) return;
    animId = requestAnimationFrame(gameLoop);
    if (paused) { renderPaused(); return; }

    tick++;
    player.gameTime++;

    // ── Update-Phase ────────────────────────────────────────
    updatePlayer();
    updateCamera();
    updatePowerUps();

    World.tick();
    World.applyOverlay();
    World.updateHUDSeason();

    MapSystem.updateChunks(player.x, player.y);
    Enemies.updateAll(
      player.x, player.y,
      player.activePowerUps.freeze > 0,
      World.isNight(),
      World.getSpeedMult()
    );

    checkPickups();
    checkEnemyCollisions();
    checkLevelUp();
    checkMagnet();
    checkBomb();

    spawnAmbientParticles();

    UI.tick();
    updateMiniMap();
    updateHUD();

    // ── Render-Phase ─────────────────────────────────────────
    renderFrame();
  }

  // ── Spieler bewegen ───────────────────────────────────────
  function updatePlayer() {
    const dx = Input.getDX();
    const dy = Input.getDY();
    const moving = Math.hypot(dx, dy) > 0.1;

    if (!moving) {
      player.animTimer = 0;
      return;
    }

    // Speed-Multiplikator
    const wSpeedMult  = World.getSpeedMult();
    const puSpeedMult = player.activePowerUps.speed > 0 ? 2.0 : 1.0;
    const totalMult   = wSpeedMult * puSpeedMult;

    // Bewegungsinterval (je weniger = schneller)
    const interval = Math.max(2, Math.round(14 / totalMult));
    if (++player.moveTimer < interval) return;
    player.moveTimer = 0;

    const mag = Math.hypot(dx, dy);
    const ndx = dx / mag, ndy = dy / mag;
    const spd = TILE;

    const nx = player.x + ndx * spd;
    const ny = player.y + ndy * spd;
    const margin = TILE * 0.12;

    // Kollision prüfen (4 Ecken)
    const corners = [
      [nx + margin,        ny + margin       ],
      [nx + TILE - margin, ny + margin       ],
      [nx + margin,        ny + TILE - margin],
      [nx + TILE - margin, ny + TILE - margin],
    ];

    const okX = [
      [nx + margin,        player.y + margin       ],
      [nx + TILE - margin, player.y + margin       ],
      [nx + margin,        player.y + TILE - margin],
      [nx + TILE - margin, player.y + TILE - margin],
    ].every(([cx, cy]) => !MapSystem.isBlockingAtPixel(cx, cy));

    const okY = [
      [player.x + margin,        ny + margin       ],
      [player.x + TILE - margin, ny + margin       ],
      [player.x + margin,        ny + TILE - margin],
      [player.x + TILE - margin, ny + TILE - margin],
    ].every(([cx, cy]) => !MapSystem.isBlockingAtPixel(cx, cy));

    // Welt-Grenzen
    const wMax = MapSystem.worldWidth * TILE - TILE;
    const hMax = MapSystem.worldHeight * TILE - TILE;

    if (okX) player.x = Math.max(0, Math.min(wMax, nx));
    if (okY) player.y = Math.max(0, Math.min(hMax, ny));

    // Animations-Frame
    if (++player.animTimer > 6) {
      player.animTimer = 0;
      player.animFrame = (player.animFrame + 1) % 4;
    }
  }

  // ── Kamera ────────────────────────────────────────────────
  function updateCamera() {
    const targetX = player.x - viewW / 2 + TILE / 2;
    const targetY = player.y - viewH / 2 + TILE / 2;

    // Welt-Grenzen
    const maxCX = MapSystem.worldWidth  * TILE - viewW;
    const maxCY = MapSystem.worldHeight * TILE - viewH;

    const clampedX = Math.max(0, Math.min(maxCX, targetX));
    const clampedY = Math.max(0, Math.min(maxCY, targetY));

    // Sanfte Kamera (Lerp)
    cam.x += (clampedX - cam.x) * 0.12;
    cam.y += (clampedY - cam.y) * 0.12;
  }

  // ── Power-Up Ticks ────────────────────────────────────────
  function updatePowerUps() {
    const pu = player.activePowerUps;
    for (const k of Object.keys(pu)) {
      if (pu[k] > 0) pu[k]--;
    }
  }

  // ── Magnet-Effekt ─────────────────────────────────────────
  function checkMagnet() {
    if (player.activePowerUps.magnet <= 0) return;
    const radius = 3.5 * TILE;
    const plTX = Math.floor(player.x / TILE);
    const plTY = Math.floor(player.y / TILE);
    const r    = Math.ceil(radius / TILE) + 1;

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const tx = plTX + dx, ty = plTY + dy;
        const tile = MapSystem.getTileWorld(tx, ty);
        if (tile === MapSystem.T.COIN) {
          if (Math.hypot(dx, dy) * TILE < radius) {
            collectTile(tx, ty, tile);
          }
        }
      }
    }
  }

  // ── Bombe ─────────────────────────────────────────────────
  function checkBomb() {
    if (player.bomb <= 0) return;
    player.bomb = 0;

    // 5-Block-Radius: alle Banditen wegpushen + kurz einfrieren
    const radius = 5 * TILE;
    Enemies.bandits.forEach(b => {
      const d = Math.hypot(b.x - player.x, b.y - player.y);
      if (d < radius) {
        // Wegpushen
        const angle = Math.atan2(b.y - player.y, b.x - player.x);
        b.x += Math.cos(angle) * TILE * 4;
        b.y += Math.sin(angle) * TILE * 4;
        // Zurück in STATE.EXPLORE
        b.state = 1;
        b.path  = [];
      }
    });
    player.activePowerUps.freeze = 120; // 2 Sek Freeze

    Particles.powerUpEffect && Particles.powerUpEffect(
      player.x + TILE/2, player.y + TILE/2, '#ff8844'
    );
    UI.flashAlert('rgba(255,100,0,0.3)');
    UI.setStatus('💣 BOMBE! Banditen vertrieben!');
  }

  // ── Pickups einsammeln ────────────────────────────────────
  function checkPickups() {
    const plTX = Math.floor(player.x / TILE);
    const plTY = Math.floor(player.y / TILE);
    const T = MapSystem.T;

    // 2×2 Tiles um Spieler prüfen
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const tx = plTX + dx, ty = plTY + dy;
        const tile = MapSystem.getTileWorld(tx, ty);
        if (tile !== T.EMPTY && !MapSystem.isBlocking(tile)) {
          collectTile(tx, ty, tile);
        }
      }
    }
  }

  function collectTile(tx, ty, tile) {
    const collected = MapSystem.collectAt(tx, ty);
    if (!collected) return;
    const T = MapSystem.T;

    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    // Canvas-Position für Float
    const sx = cx - cam.x;
    const sy = cy - cam.y;

    if (collected === T.COIN) {
      const mult   = World.getCoinMult() * UI.getComboMult();
      const base   = 10 * player.level;
      const gained = Math.round(base * mult);

      player.coins++;
      player.score += gained;

      const newCombo = UI.addCombo();
      if (newCombo > player.bestCombo) player.bestCombo = newCombo;

      Particles.coinBurst && Particles.coinBurst(cx, cy, UI.comboCount);
      UI.spawnScoreFloat(sx, sy - 20, gained);

    } else if (collected >= T.PU_SPEED && collected <= T.PU_BOMB) {
      collectPowerUp(collected, cx, cy, sx, sy);
    }
  }

  function collectPowerUp(tile, cx, cy, sx, sy) {
    const T  = MapSystem.T;
    const pu = player.activePowerUps;

    const defs = {
      [T.PU_SPEED]:  { key: 'speed',  dur: 300, color: '#facc15', msg: '⚡ SPEED!',      icon: '⚡' },
      [T.PU_SHIELD]: { key: 'shield', dur: 300, color: '#60a5fa', msg: '🛡 SHIELD!',     icon: '🛡' },
      [T.PU_FREEZE]: { key: 'freeze', dur: 240, color: '#22d3ee', msg: '❄ FREEZE!',      icon: '❄' },
      [T.PU_MAGNET]: { key: 'magnet', dur: 360, color: '#c084fc', msg: '🧲 MAGNET!',     icon: '🧲' },
      [T.PU_INVIS]:  { key: 'invis',  dur: 240, color: '#ffffff', msg: '👻 UNSICHTBAR!', icon: '👻' },
      [T.PU_BOMB]:   { key: null,     dur: 0,   color: '#ff8844', msg: '💣 BOMBE!',      icon: '💣' },
    };

    const def = defs[tile];
    if (!def) return;

    if (def.key) {
      pu[def.key] = def.dur;
    } else {
      player.bomb = 1;
    }

    Particles.powerUpEffect && Particles.powerUpEffect(cx, cy, def.color);
    UI.spawnScoreFloat(sx, sy - 30, def.msg, def.color);
    UI.setStatus(def.msg);
    Auth && Auth.updateStats({ powerUpsUsed: 1 });
  }

  // ── Feind-Kollisionen ─────────────────────────────────────
  function checkEnemyCollisions() {
    if (player.invFrames > 0) { player.invFrames--; return; }
    if (player.activePowerUps.shield > 0) return;
    if (player.activePowerUps.invis > 0) {
      // Banditen ignorieren unsichtbaren Spieler
      Enemies.bandits.forEach(b => {
        if (b.state === 3) { b.state = 1; b.path = []; }
      });
      return;
    }

    const hits = Enemies.checkCollisions(player.x, player.y);
    if (hits.length === 0) return;

    player.hp--;
    player.invFrames = 90;
    UI.resetCombo();
    UI.flashAlert();
    Particles.hitEffect && Particles.hitEffect(player.x + TILE/2, player.y + TILE/2);

    if (player.hp <= 0) {
      endGame();
    } else {
      UI.setStatus('💔 Getroffen! HP: ' + player.hp);
    }
  }

  // ── Level-Up prüfen ───────────────────────────────────────
  function checkLevelUp() {
    if (player.coins < player.coinsForNextLevel) return;

    player.level++;
    player.coinsForNextLevel = Math.floor(player.coinsForNextLevel * 1.6 + 10);
    player.maxHp = Math.min(6, player.maxHp + 1);
    player.hp    = Math.min(player.hp + 1, player.maxHp);

    // Neue Banditen spawnen
    const extraBandits = 1 + Math.floor(player.level / 3);
    const spawn = MapSystem.findSpawnPoint();
    for (let i = 0; i < extraBandits; i++) {
      Enemies.bandits.push(new Enemies.Bandit(
        player.x + (Math.random() - 0.5) * 20 * TILE,
        player.y + (Math.random() - 0.5) * 20 * TILE,
        player.level,
        Enemies.bandits.length
      ));
    }

    // Level-Up UI
    const changes = [
      { icon: '❤️', type: 'g', text: '+1 Max HP!',              },
      { icon: '⭐', type: 'w', text: `Level ${player.level}!`    },
      { icon: '⚔️', type: 'd', text: `+${extraBandits} Banditen` },
      { icon: '🪙', type: 'i', text: `Nächstes Level: ${player.coinsForNextLevel} Coins` },
    ];

    Input.lock();
    UI.showLevelUp(player.level, changes);

    // Achievements prüfen
    const profile = Auth ? Auth.getActiveProfile() : null;
    if (profile) {
      const newAchs = Scoreboard.checkAchievements(profile.stats);
      newAchs.forEach(a => UI.showAchievement(a));
    }
  }

  // ── Ambiente Partikel ─────────────────────────────────────
  function spawnAmbientParticles() {
    const weather = World.getWeather();
    const season  = World.getSeason();
    const wSpd    = World.getWindSpeed();
    const wDef    = World.getWeatherDef();

    Particles.spawnWeather(weather, wSpd, cam.x, cam.y, viewW, viewH);

    if (tick % 4 === 0) {
      Particles.spawnSeasonalAmbient(season, cam.x, cam.y, viewW, viewH, wSpd);
    }
  }

  // ── Mini-Map Update ───────────────────────────────────────
  function updateMiniMap() {
    if (tick % 3 !== 0) return;
    UI.updateMiniMap(cam.x, cam.y, player.x, player.y, Enemies.bandits);
  }

  // ── HUD Update ────────────────────────────────────────────
  function updateHUD() {
    if (tick % 4 !== 0) return;

    const nearbyBandits = Enemies.bandits.filter(b => {
      return Math.hypot(b.x - player.x, b.y - player.y) < 12 * TILE;
    }).length;

    UI.updateHUD({
      level: player.level,
      score: player.score,
      coins: player.coins,
      hp:    player.hp,
      maxHp: player.maxHp,
      activePowerUps: player.activePowerUps,
      nearbyBandits,
    });
  }

  // ══════════════════════════════════════════════════════════
  //  RENDERING
  // ══════════════════════════════════════════════════════════
  function renderFrame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, viewW, viewH);

    // Hintergrund
    ctx.fillStyle = '#060e03';
    ctx.fillRect(0, 0, viewW, viewH);

    const season = World.getSeason();
    const wPhase = World.getWindPhase();
    const wSpd   = World.getWindSpeed();
    const isNight = World.isNight();
    const T = MapSystem.T;

    // ── Chunks rendern ──────────────────────────────────────
    const chunks = MapSystem.getChunksInView(cam.x, cam.y, viewW, viewH);
    const CHUNK  = MapSystem.CHUNK_SIZE;

    for (const chunk of chunks) {
      const chunkPixX = chunk.cx * CHUNK * TILE;
      const chunkPixY = chunk.cy * CHUNK * TILE;

      for (let ly = 0; ly < CHUNK; ly++) {
        for (let lx = 0; lx < CHUNK; lx++) {
          const wx  = chunk.cx * CHUNK + lx;
          const wy  = chunk.cy * CHUNK + ly;
          const tile = chunk.tiles[ly * CHUNK + lx];

          const sx = Math.round(wx * TILE - cam.x);
          const sy = Math.round(wy * TILE - cam.y);

          // Außerhalb sichtbarer Fläche überspringen
          if (sx > viewW + TILE || sy > viewH + TILE || sx < -TILE || sy < -TILE) continue;

          drawTile(ctx, sx, sy, wx, wy, tile, season, wPhase, wSpd, isNight);
        }
      }
    }

    // ── Partikel (unter Spieler) ────────────────────────────
    Particles.update(ctx, cam.x, cam.y);

    // ── Banditen rendern ────────────────────────────────────
    const visibleBandits = Enemies.getBanditsInView(cam.x, cam.y, viewW, viewH);
    visibleBandits.forEach(b => {
      const sx = Math.round(b.x - cam.x);
      const sy = Math.round(b.y - cam.y);
      b.mode   = b.state; // alias für Graphics
      Graphics.drawBandit(ctx, { ...b, x: sx, y: sy }, player.activePowerUps.freeze > 0, tick);
    });

    // ── Spieler ─────────────────────────────────────────────
    const psx = Math.round(player.x - cam.x);
    const psy = Math.round(player.y - cam.y);
    Graphics.drawPlayer(
      ctx, psx, psy,
      player.invFrames,
      player.animFrame,
      player.activePowerUps.shield > 0,
      player.activePowerUps.speed > 0,
      player.activePowerUps.invis > 0,
      tick
    );

    // ── Spieler-Lichtkegel (Nacht) ───────────────────────────
    Graphics.drawPlayerLight(ctx, player.x, player.y, cam.x, cam.y, viewW, viewH, isNight);

    // ── Vignette ───────────────────────────────────────────
    Graphics.drawVignette(ctx, viewW, viewH);
  }

  // ── Einzelne Tile zeichnen ────────────────────────────────
  function drawTile(ctx, sx, sy, wx, wy, tile, season, wPhase, wSpd, isNight) {
    const T = MapSystem.T;

    switch (tile) {
      case T.EMPTY:
        Graphics.drawGrass(ctx, sx, sy, wx, wy, season, wPhase, wSpd);
        break;
      case T.TALL_GRASS:
        Graphics.drawTallGrass(ctx, sx, sy, wx, wy, wPhase, wSpd, season);
        break;
      case T.FLOWER:
        Graphics.drawGrass(ctx, sx, sy, wx, wy, season, wPhase, wSpd);
        break;
      case T.WALL:
      case T.RUIN_WALL:
        Graphics.drawWall(ctx, sx, sy);
        break;
      case T.TREE:
        Graphics.drawGrass(ctx, sx, sy, wx, wy, season, wPhase, wSpd);
        Graphics.drawTree(ctx, sx, sy, wx, wy, wPhase, wSpd, season);
        break;
      case T.BUSH:
        Graphics.drawBush(ctx, sx, sy, season);
        break;
      case T.WATER:
      case T.DEEP_WATER:
        Graphics.drawWater(ctx, sx, sy, tick, wx, wy, season);
        break;
      case T.ICE:
        Graphics.drawWater(ctx, sx, sy, tick, wx, wy, 'winter');
        break;
      case T.ROCK:
        Graphics.drawRock(ctx, sx, sy);
        break;
      case T.MOUNTAIN:
        Graphics.drawMountain(ctx, sx, sy, 1, season);
        break;
      case T.MOUNTAIN2:
        Graphics.drawMountain(ctx, sx, sy, 2, season);
        break;
      case T.SNOWPEAK:
        Graphics.drawMountain(ctx, sx, sy, 3, season);
        break;
      case T.SAND:
        ctx.fillStyle = '#c8b060';
        ctx.fillRect(sx, sy, TILE, TILE);
        break;
      case T.SNOW:
        ctx.fillStyle = '#ddeeff';
        ctx.fillRect(sx, sy, TILE, TILE);
        ctx.fillStyle = '#eef4ff';
        ctx.fillRect(sx + 3, sy + 3, TILE - 6, TILE - 6);
        break;
      case T.PATH:
        Graphics.drawPath(ctx, sx, sy);
        break;
      case T.HOUSE_WALL:
        Graphics.drawHouseWall(ctx, sx, sy);
        break;
      case T.HOUSE_ROOF:
        Graphics.drawHouseRoof(ctx, sx, sy);
        break;
      case T.HOUSE_DOOR:
        Graphics.drawHouseDoor(ctx, sx, sy);
        break;
      case T.HOUSE_WIN:
        Graphics.drawHouseWindow(ctx, sx, sy);
        break;
      case T.FENCE:
        Graphics.drawFence(ctx, sx, sy);
        break;
      case T.WELL:
        Graphics.drawWell(ctx, sx, sy);
        break;
      case T.LANTERN:
        Graphics.drawLantern(ctx, sx, sy, tick, isNight);
        break;
      case T.COIN:
        Graphics.drawGrass(ctx, sx, sy, wx, wy, season, wPhase, wSpd);
        Graphics.drawCoin(ctx, sx, sy, tick, wx, wy);
        break;
      case T.PU_SPEED:
      case T.PU_SHIELD:
      case T.PU_FREEZE:
      case T.PU_MAGNET:
      case T.PU_INVIS:
      case T.PU_BOMB:
        Graphics.drawGrass(ctx, sx, sy, wx, wy, season, wPhase, wSpd);
        Graphics.drawPowerUp(ctx, sx, sy, tick, tile);
        break;
      default:
        Graphics.drawGrass(ctx, sx, sy, wx, wy, season, wPhase, wSpd);
    }
  }

  // ── Pause-Render ──────────────────────────────────────────
  function renderPaused() {
    // Frame still sichtbar, aber keine Updates
  }

  // ── Pause toggeln ─────────────────────────────────────────
  function togglePause() {
    if (!gameActive) return;
    paused = !paused;
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.classList.toggle('show', paused);

    if (paused) {
      Input.lock();
    } else {
      Input.unlock();
    }
  }

  // ── Level-Up weiter ───────────────────────────────────────
  function continueAfterLevelUp() {
    UI.showScreen('screen-game');
    Input.unlock();
  }

  // ── Spiel beenden ─────────────────────────────────────────
  function endGame() {
    gameActive = false;
    Input.lock();

    const timeSeconds = Math.floor(player.gameTime / 60);

    // Score speichern
    const playerName = Auth ? Auth.getDisplayName() : 'GAST';
    const rank = Scoreboard.addScore(
      player.score, player.level, player.coins,
      player.bestCombo, timeSeconds, playerName
    );
    Auth && Auth.saveScore(
      player.score, player.level, player.coins,
      player.bestCombo, timeSeconds
    );

    // Statistiken
    Auth && Auth.updateStats({ banditsAvoided: Enemies.bandits.length });

    // Achievements prüfen
    const profile = Auth ? Auth.getActiveProfile() : null;
    if (profile) {
      const newAchs = Scoreboard.checkAchievements(profile.stats);
      newAchs.forEach(a => UI.showAchievement(a));
    }

    // Game-Over UI
    UI.showGameOver({
      score:    player.score,
      level:    player.level,
      coins:    player.coins,
      bestCombo: player.bestCombo,
      time:     timeSeconds,
    });

    // Scoreboard neu rendern
    Scoreboard.renderTop3Menu && Scoreboard.renderTop3Menu();
  }

  // ── Menü zurück ───────────────────────────────────────────
  function goToMenu() {
    gameActive = false;
    paused = false;
    Input.lock();
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    Enemies.clear();
    Particles.clear();
    UI.showScreen('screen-menu');
    Scoreboard.renderTop3Menu && Scoreboard.renderTop3Menu();
    Auth && Auth.applySettingsToUI && Auth.applySettingsToUI();
    setTimeout(() => { Input.unlock(); }, 100);
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    startGame,
    togglePause,
    continueAfterLevelUp,
    endGame,
    goToMenu,
    resizeCanvas,
    get player() { return player; },
    get cam()    { return cam;    },
    get tick()   { return tick;   },
    get paused() { return paused; },
  };

})();
