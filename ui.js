// ═══════════════════════════════════════════════════════════════
//  COIN FOREST v5.1 – ui.js
//  HUD, Mini-Map, Combo-System, Achievements, Ladescreen
// ═══════════════════════════════════════════════════════════════

'use strict';

const UI = (() => {

  // ── State ──────────────────────────────────────────────────
  let comboCount     = 0;
  let comboTimer     = 0;
  const COMBO_WINDOW = 180; // Ticks (3 Sekunden bei 60fps)
  const COMBO_MULT   = [1, 1, 1.5, 2, 2.5, 3, 4, 5, 7, 10];

  let miniMapVisible = true;
  let miniMapCanvas  = null;
  let miniMapCtx     = null;

  let achievementQueue = [];
  let achievementTimer = 0;
  let scoreFloats      = [];

  let loadingPhase     = 0;
  let loadingPct       = 0;
  let loadingCanvas    = null;
  let loadingCtx       = null;
  let loadingTick      = 0;
  let loadingForestOff = 0;

  // ── HUD initialisieren ────────────────────────────────────
  function initHUD() {
    miniMapCanvas = document.getElementById('mini-map-canvas');
    if (miniMapCanvas) {
      miniMapCanvas.width  = 90;
      miniMapCanvas.height = 90;
      miniMapCtx = miniMapCanvas.getContext('2d');
    }
  }

  // ── HUD aktualisieren ─────────────────────────────────────
  function updateHUD(gameState) {
    // Level
    const lvlEl = document.getElementById('hud-level');
    if (lvlEl) lvlEl.textContent = gameState.level;

    // Score
    const scEl = document.getElementById('hud-score');
    if (scEl) scEl.textContent = Scoreboard
      ? Scoreboard.formatScore(gameState.score)
      : gameState.score;

    // Coins
    const cnEl = document.getElementById('hud-coins');
    if (cnEl) cnEl.textContent = gameState.coins;

    // HP
    const hpEl = document.getElementById('hud-hp');
    if (hpEl) {
      hpEl.textContent = gameState.hp + '/' + gameState.maxHp;
      hpEl.parentElement.style.color =
        gameState.hp <= 1 ? 'var(--red)' : gameState.hp <= 2 ? 'var(--orange)' : 'var(--red)';
    }

    // IQ / Gefahren-Bar (Banditen in der Nähe)
    const iqBar = document.getElementById('iq-bar');
    if (iqBar) {
      const pct = Math.min(100, (gameState.nearbyBandits || 0) * 12);
      iqBar.style.width = pct + '%';
      iqBar.style.background = pct > 70 ? 'var(--red)' : pct > 40 ? 'var(--orange)' : 'var(--green)';
    }
    const iqNum = document.getElementById('iq-num');
    if (iqNum) iqNum.textContent = (gameState.nearbyBandits || 0) + ' ⚔';

    // Jahreszeit & Wetter
    if (typeof World !== 'undefined') World.updateHUDSeason();

    // Power-Up Badges
    updatePowerUpHUD(gameState.activePowerUps || {});

    // Combo
    updateComboDisplay();
  }

  // ── Power-Up HUD ──────────────────────────────────────────
  function updatePowerUpHUD(active) {
    const row = document.getElementById('hud-powerups');
    if (!row) return;

    row.innerHTML = '';
    const defs = {
      speed:  { icon: '⚡', label: 'SPEED',  cls: 'speed'  },
      shield: { icon: '🛡', label: 'SHIELD', cls: 'shield' },
      freeze: { icon: '❄', label: 'FREEZE', cls: 'freeze' },
      magnet: { icon: '🧲', label: 'MAGNET', cls: 'magnet' },
      invis:  { icon: '👻', label: 'INVIS',  cls: 'invis'  },
      bomb:   { icon: '💣', label: 'BOMB',   cls: 'bomb'   },
    };

    for (const [key, def] of Object.entries(defs)) {
      const rem = active[key];
      if (!rem || rem <= 0) continue;
      const secs = Math.ceil(rem / 60);
      const badge = document.createElement('div');
      badge.className = `pu-badge ${def.cls}`;
      badge.innerHTML = `<span>${def.icon}</span><span>${def.label}</span><span>${secs}s</span>`;
      row.appendChild(badge);
    }
  }

  // ── Status-Bar ────────────────────────────────────────────
  function setStatus(msg) {
    const el = document.getElementById('status-msg');
    if (el) { el.textContent = msg; }
  }

  // ── Combo-System ──────────────────────────────────────────
  function addCombo() {
    comboCount++;
    comboTimer = COMBO_WINDOW;
    updateComboDisplay();
    return getComboMult();
  }

  function resetCombo() {
    if (comboCount > 1) {
      setStatus(`Combo unterbrochen! War: x${comboCount}`);
    }
    comboCount = 0;
    comboTimer = 0;
    updateComboDisplay();
  }

  function tickCombo() {
    if (comboTimer > 0) {
      comboTimer--;
      if (comboTimer === 0) resetCombo();
    }
  }

  function getComboMult() {
    const idx = Math.min(comboCount, COMBO_MULT.length - 1);
    return COMBO_MULT[idx];
  }

  function updateComboDisplay() {
    const el = document.getElementById('combo-display');
    if (!el) return;

    if (comboCount < 2) {
      el.style.opacity = '0';
      return;
    }
    el.style.opacity = '1';
    const mult = getComboMult();
    const pct  = comboTimer / COMBO_WINDOW;

    el.innerHTML = `
      <div class="combo-num">${comboCount}x</div>
      <div class="combo-lbl">×${mult.toFixed(1)} COMBO</div>
      <div style="width:60px;height:3px;background:var(--dark2);margin:3px auto 0">
        <div style="width:${Math.round(pct*100)}%;height:100%;background:var(--accent);transition:width 0.1s"></div>
      </div>
    `;
    // Skalierungs-Animation
    const scale = 1 + 0.08 * Math.sin(Date.now() * 0.015);
    el.style.transform = `translateX(-50%) scale(${scale.toFixed(3)})`;
  }

  // ── Score-Float (schwebende Zahlen) ──────────────────────
  function spawnScoreFloat(x, y, value, color) {
    const el = document.createElement('div');
    el.className = 'float-score';
    el.textContent = '+' + (typeof Scoreboard !== 'undefined'
      ? Scoreboard.formatScore(value) : value);
    el.style.left  = x + 'px';
    el.style.top   = y + 'px';
    if (color) el.style.color = color;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  // ── Achievement-Popup ─────────────────────────────────────
  function showAchievement(ach) {
    achievementQueue.push(ach);
    if (achievementQueue.length === 1) showNextAchievement();
  }

  function showNextAchievement() {
    if (achievementQueue.length === 0) return;
    const ach = achievementQueue[0];
    const pop = document.getElementById('achievement-pop');
    if (!pop) return;

    pop.querySelector('.ach-icon').textContent = ach.icon;
    pop.querySelector('.ach-name').textContent = ach.name;
    pop.querySelector('.ach-desc').textContent = ach.desc;
    pop.classList.add('show');

    setTimeout(() => {
      pop.classList.remove('show');
      achievementQueue.shift();
      setTimeout(() => {
        if (achievementQueue.length > 0) showNextAchievement();
      }, 400);
    }, 3200);
  }

  // ── Mini-Map ──────────────────────────────────────────────
  function toggleMiniMap() {
    miniMapVisible = !miniMapVisible;
    if (miniMapCanvas) {
      miniMapCanvas.style.display = miniMapVisible ? 'block' : 'none';
    }
  }

  function updateMiniMap(camX, camY, playerPX, playerPY, bandits) {
    if (!miniMapCtx || !miniMapVisible) return;

    const ctx   = miniMapCtx;
    const W     = miniMapCanvas.width;
    const H     = miniMapCanvas.height;
    const TILE  = MapSystem ? MapSystem.TILE_SIZE : 40;
    const RANGE = 50; // Tile-Radius

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);

    const plTX = Math.floor(playerPX / TILE);
    const plTY = Math.floor(playerPY / TILE);
    const scale = W / (RANGE * 2);

    // Tiles rendern
    if (MapSystem) {
      for (let dy = -RANGE; dy < RANGE; dy++) {
        for (let dx = -RANGE; dx < RANGE; dx++) {
          const tx = plTX + dx, ty = plTY + dy;
          const tile = MapSystem.getTileWorld(tx, ty);
          let color = null;

          const T = MapSystem.T;
          switch (tile) {
            case T.EMPTY:      color = '#1a3a0a'; break;
            case T.WALL:       color = '#6a5030'; break;
            case T.COIN:       color = '#ffd700'; break;
            case T.TREE:       color = '#1a5a08'; break;
            case T.BUSH:       color = '#1a4a08'; break;
            case T.WATER:
            case T.DEEP_WATER: color = '#1a3a6a'; break;
            case T.ROCK:       color = '#5a5a5a'; break;
            case T.MOUNTAIN:
            case T.MOUNTAIN2:  color = '#7a7060'; break;
            case T.SNOWPEAK:   color = '#ddeeff'; break;
            case T.PATH:       color = '#9a8050'; break;
            case T.HOUSE_WALL:
            case T.HOUSE_ROOF:
            case T.HOUSE_DOOR: color = '#c87040'; break;
            case T.SAND:       color = '#c8b060'; break;
            case T.TALL_GRASS: color = '#2a5a10'; break;
            case T.RUIN_WALL:  color = '#5a4a3a'; break;
            default:
              if (tile >= 30 && tile <= 35) color = '#ff88ff'; // Power-Ups
              break;
          }

          if (color) {
            const mx = Math.floor((dx + RANGE) * scale);
            const my = Math.floor((dy + RANGE) * scale);
            const ms = Math.max(1, Math.ceil(scale));
            ctx.fillStyle = color;
            ctx.fillRect(mx, my, ms, ms);
          }
        }
      }
    }

    // Banditen
    if (bandits) {
      bandits.forEach(b => {
        const bTX = Math.floor(b.x / TILE) - plTX + RANGE;
        const bTY = Math.floor(b.y / TILE) - plTY + RANGE;
        if (bTX < 0 || bTY < 0 || bTX >= RANGE * 2 || bTY >= RANGE * 2) return;
        ctx.fillStyle = b.state === 3 ? '#ff2222' : '#ff8844';
        ctx.fillRect(Math.floor(bTX * scale) - 1, Math.floor(bTY * scale) - 1, 3, 3);
      });
    }

    // Spieler (Mitte)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(W / 2 - 2, H / 2 - 2, 5, 5);
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(W / 2 - 1, H / 2 - 1, 3, 3);

    // Rahmen
    ctx.strokeStyle = 'var(--border2)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(0, 0, W, H);

    // Nord-Pfeil
    ctx.fillStyle = '#aaaaaa';
    ctx.font       = '7px monospace';
    ctx.textAlign  = 'right';
    ctx.fillText('N', W - 2, 9);
  }

  // ── Lade-Screen ───────────────────────────────────────────
  const TIPS = [
    'Sammle Coins schnell hintereinander für Combo-Bonus!',
    'Nutze Büsche als Deckung vor Banditen.',
    'Im Winter bewegen sich alle langsamer.',
    'Laternen in Dörfern leuchten die Nacht.',
    'Banditen im Schlaf haben einen kleinen Radius.',
    'Das Freeze-Power-Up friert alle Banditen ein.',
    'Magnet zieht Coins im 3-Block-Radius an.',
    'Ruinen haben mehr Coins aber auch mehr Banditen.',
    'Drücke M für die Mini-Map.',
    'Im Gewitter kannst du schlechter sehen.',
  ];

  function initLoadingScreen() {
    loadingCanvas = document.getElementById('loading-canvas');
    if (!loadingCanvas) return;
    loadingCanvas.width  = window.innerWidth;
    loadingCanvas.height = window.innerHeight;
    loadingCtx = loadingCanvas.getContext('2d');

    // Tipp-Rotation
    const hintEl = document.getElementById('loading-hint');
    let tipIdx = 0;
    if (hintEl) {
      hintEl.textContent = TIPS[0];
      setInterval(() => {
        tipIdx = (tipIdx + 1) % TIPS.length;
        hintEl.style.animation = 'none';
        hintEl.offsetHeight; // reflow
        hintEl.style.animation = 'hintFade 0.5s ease';
        hintEl.textContent = TIPS[tipIdx];
      }, 2800);
    }
  }

  function animateLoadingScreen() {
    if (!loadingCtx) return;
    const ctx  = loadingCtx;
    const w    = loadingCanvas.width;
    const h    = loadingCanvas.height;

    loadingTick++;
    loadingForestOff = (loadingForestOff + 0.4) % (w * 2);

    // Himmel-Gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#010a03');
    sky.addColorStop(0.6, '#021505');
    sky.addColorStop(1, '#030e04');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Sterne
    ctx.fillStyle = 'rgba(255,255,200,0.6)';
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 137.508 * 7 + 50) % w);
      const sy = ((i * 137.508 * 3 + 20) % (h * 0.55));
      const twink = 0.4 + 0.6 * Math.abs(Math.sin(loadingTick * 0.03 + i * 0.4));
      ctx.globalAlpha = twink * 0.7;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    // Mond
    const moonX = w * 0.82, moonY = h * 0.14;
    ctx.fillStyle = '#e8e8d0';
    ctx.beginPath(); ctx.arc(moonX, moonY, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0c0a8';
    ctx.beginPath(); ctx.arc(moonX - 8, moonY - 6, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8e8d0';
    ctx.beginPath(); ctx.arc(moonX + 4, moonY + 5, 5, 0, Math.PI * 2); ctx.fill();

    // Mond-Glow
    const glow = ctx.createRadialGradient(moonX, moonY, 20, moonX, moonY, 60);
    glow.addColorStop(0, 'rgba(230,230,180,0.12)');
    glow.addColorStop(1, 'rgba(230,230,180,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(moonX, moonY, 60, 0, Math.PI * 2); ctx.fill();

    // Nebel-Schichten
    for (let i = 0; i < 3; i++) {
      const ny = h * (0.55 + i * 0.08);
      const nx = -loadingForestOff * 0.2 + i * 80;
      const g = ctx.createLinearGradient(0, ny - 20, 0, ny + 30);
      g.addColorStop(0, 'rgba(10,40,10,0)');
      g.addColorStop(0.5, `rgba(10,40,10,${0.12 + i * 0.04})`);
      g.addColorStop(1, 'rgba(10,40,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, ny - 20, w, 50);
    }

    // Hintergrund-Bäume (weit weg, klein, dunkel)
    drawLoadingTrees(ctx, w, h, -loadingForestOff * 0.15, 0.35, '#061408', 22, 35);
    drawLoadingTrees(ctx, w, h, -loadingForestOff * 0.3, 0.42, '#0a1e08', 28, 44);
    drawLoadingTrees(ctx, w, h, -loadingForestOff * 0.55, 0.50, '#0e2c0a', 36, 56);

    // Wind-Effekt auf Vordergrund-Bäumen
    const windOff = Math.sin(loadingTick * 0.022) * 2.5;
    drawLoadingTrees(ctx, w, h, -loadingForestOff * 1.0 + windOff, 0.60, '#122808', 46, 70);

    // Boden
    const ground = ctx.createLinearGradient(0, h * 0.72, 0, h);
    ground.addColorStop(0, '#0e2808');
    ground.addColorStop(0.3, '#1a3c10');
    ground.addColorStop(1, '#0a1a06');
    ctx.fillStyle = ground;
    ctx.fillRect(0, h * 0.72, w, h * 0.28);

    // Gras-Streifen
    ctx.fillStyle = '#1e4810';
    ctx.fillRect(0, h * 0.72, w, 6);
    ctx.fillStyle = '#2a6018';
    ctx.fillRect(0, h * 0.72 + 3, w, 3);

    // Glühwürmchen
    for (let i = 0; i < 12; i++) {
      const gx = (w * 0.1 + ((i * 173 + loadingTick * 0.3) % (w * 0.8)));
      const gy = h * 0.62 + Math.sin(loadingTick * 0.03 + i * 0.8) * 30;
      const bright = 0.4 + 0.6 * Math.abs(Math.sin(loadingTick * 0.08 + i * 0.6));
      ctx.globalAlpha = bright;
      ctx.shadowColor = '#aaff44';
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = '#aaff44';
      ctx.beginPath(); ctx.arc(gx, gy, 2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
    }

    // Münzen-Spur
    for (let i = 0; i < 5; i++) {
      const cx2 = (w * 0.1 + i * w * 0.18 + loadingTick * 0.5) % w;
      const cy2 = h * 0.64 - Math.abs(Math.sin((cx2 / w) * Math.PI * 3)) * 30;
      const bright = 0.3 + 0.7 * Math.abs(Math.sin(loadingTick * 0.05 + i));
      ctx.globalAlpha = bright;
      ctx.fillStyle   = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur  = 6;
      ctx.beginPath(); ctx.arc(cx2, cy2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
    }
  }

  function drawLoadingTrees(ctx, w, h, offsetX, yFrac, color, crownR, trunkH) {
    const baseY  = h * yFrac;
    const count  = Math.ceil(w / (crownR * 2 + 4)) + 3;
    const spacing = crownR * 2 + 4 + Math.floor(crownR * 0.5);

    for (let i = 0; i < count; i++) {
      const tx2 = ((i * spacing + offsetX) % (w + crownR * 2)) - crownR;
      const th  = trunkH * (0.85 + (i % 3) * 0.1);
      const cr  = crownR * (0.8 + (i % 4) * 0.1);
      const ty2 = baseY - th;
      const wind = Math.sin(loadingTick * 0.02 + i * 0.8) * 2;

      // Stamm
      ctx.fillStyle = '#2a1008';
      ctx.fillRect(tx2 - 2, baseY - th, 4, th);

      // Krone (2 Schichten)
      ctx.fillStyle = '#081404';
      ctx.beginPath(); ctx.arc(tx2 + wind * 0.3, ty2 - cr * 0.3, cr * 1.05, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(tx2 + wind, ty2 - cr * 0.5, cr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ctx.fillStyle + '80';
      ctx.beginPath(); ctx.arc(tx2 + wind * 0.6 - cr * 0.3, ty2 - cr * 0.7, cr * 0.65, 0, Math.PI * 2); ctx.fill();
    }
  }

  function updateLoadingBar(pct) {
    loadingPct = pct;
    const bar = document.getElementById('loading-bar-inner');
    if (bar) bar.style.width = Math.round(pct) + '%';

    const pctEl = document.getElementById('loading-pct');
    if (pctEl) pctEl.textContent = Math.round(pct) + '%';

    // Sprungmünzen verschieben
    const coinsRow = document.getElementById('loading-coins-row');
    if (coinsRow && bar) {
      coinsRow.style.left = Math.round(pct) + '%';
    }
  }

  // ── Game-Over-Screen befüllen ─────────────────────────────
  function showGameOver(stats) {
    const s = stats;

    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setEl('dead-score', Scoreboard ? Scoreboard.formatScore(s.score) : s.score);
    setEl('dead-level', s.level);
    setEl('dead-coins', s.coins);
    setEl('dead-combo', 'x' + s.bestCombo);
    setEl('dead-time',  Scoreboard ? Scoreboard.formatTime(s.time) : s.time + 's');

    // Neuer Highscore?
    const nhEl = document.getElementById('dead-new-hs');
    if (nhEl) {
      nhEl.style.display = Scoreboard && Scoreboard.isNewHighscore(s.score) ? 'block' : 'none';
    }

    showScreen('screen-dead');
  }

  // ── Level-Up-Screen befüllen ──────────────────────────────
  function showLevelUp(level, changes) {
    const el = document.getElementById('lu-number');
    if (el) el.textContent = level;

    const chList = document.getElementById('lu-changes');
    if (chList) {
      chList.innerHTML = '';
      changes.forEach(c => {
        const div = document.createElement('div');
        div.className = `lu-change ${c.type}`;
        div.innerHTML = `<span>${c.icon}</span><span>${c.text}</span>`;
        chList.appendChild(div);
      });
    }

    showScreen('screen-levelup');
  }

  // ── Screen-Wechsel ────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  // ── Alert-Flash ───────────────────────────────────────────
  function flashAlert(color = 'rgba(255,0,0,0.25)') {
    const el = document.getElementById('alert-flash');
    if (!el) return;
    el.style.background = color;
    setTimeout(() => { el.style.background = 'transparent'; }, 120);
  }

  // ── Tick (aufgerufen pro Frame) ───────────────────────────
  function tick() {
    tickCombo();
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    initHUD,
    updateHUD,
    updatePowerUpHUD,
    setStatus,
    addCombo,
    resetCombo,
    tickCombo,
    getComboMult,
    spawnScoreFloat,
    showAchievement,
    toggleMiniMap,
    updateMiniMap,
    initLoadingScreen,
    animateLoadingScreen,
    updateLoadingBar,
    showGameOver,
    showLevelUp,
    showScreen,
    flashAlert,
    tick,
    get comboCount() { return comboCount; },
  };

})();

// Globale setStatus-Funktion (von anderen Modulen genutzt)
function setStatus(msg) { UI.setStatus(msg); }
