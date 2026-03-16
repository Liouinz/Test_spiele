// ═══════════════════════════════════════════════════════════════
//  COIN FOREST  –  game.js  v3.0
//  Komplett neu geschrieben – maximale Qualität
//  Features:
//    • Q-Learning KI mit Erkennungsradius + Alarm-System
//    • Sackgassen-Erkennung
//    • Power-Ups: Speed, Shield, Freeze, Magnet
//    • Top-3 Highscore (localStorage)
//    • Einstellungen: Weltgröße, Gegner, Tempo, Wände, Coins, KI, Wetter, Minimap
//    • Tag/Nacht-Zyklus (Gegner nachts aggressiver)
//    • Wetter: Klar, Regen, Nebel, Sturm
//    • Partikel: Blätter, Coin-Funken, Regen, Schnee, Nebel, Staub
//    • Animierte Pixel-Charaktere (laufende Beine, wackelnde Arme)
//    • Lebendige Bäume (Wind-Animation)
//    • Mini-Map
//    • Combo-System
//    • Achievements
//    • Pause, Fortfahren, Menü-Navigation
//    • Floating Score Text
//    • Alarm-Flash
//    • Status-Bar Nachrichten
//    • Level-Up Screen mit Details
//    • Stats (Spielzeit, ausgewichen etc.)
// ═══════════════════════════════════════════════════════════════

'use strict';

// ─────────────────────────────────────────────────────────────
//  KONSTANTEN
// ─────────────────────────────────────────────────────────────
const TILE = 40;

// Tile-Typen
const T = {
  EMPTY: 0, WALL: 1, COIN: 2, TREE: 3, BUSH: 4,
  WATER: 5, ROCK: 6,
  PU_SPEED: 10, PU_SHIELD: 11, PU_FREEZE: 12, PU_MAGNET: 13,
};

// Gegner-Modi
const MODE = { PATROL: 0, CHASE: 1, LINGER: 2, ALERT: 3, FLEE: 4 };

// Wetter
const WEATHER = { CLEAR: 0, RAIN: 1, FOG: 2, STORM: 3 };

// Tageszeit-Konstanten
const DAY_TICKS   = 2400;  // 1 Spieltag
const DAWN_START  = 0;
const DAY_START   = 300;
const DUSK_START  = 1800;
const NIGHT_START = 2100;

// Erkennungsradien
const DETECT_DAY   = 5 * TILE;
const DETECT_NIGHT = 7 * TILE;   // Nachts weiter
const LINGER_EXTRA = 4 * TILE;
const ALARM_RADIUS = 10 * TILE;

// Power-Up-Definitionen
const PU_DEF = {
  [T.PU_SPEED]:  { icon: '⚡', cls: 'speed',  label: 'SPEED',  dur: 300, color: '#facc15' },
  [T.PU_SHIELD]: { icon: '🛡️', cls: 'shield', label: 'SHIELD', dur: 300, color: '#60a5fa' },
  [T.PU_FREEZE]: { icon: '❄️', cls: 'freeze', label: 'FREEZE', dur: 240, color: '#22d3ee' },
  [T.PU_MAGNET]: { icon: '🧲', cls: 'magnet', label: 'MAGNET', dur: 360, color: '#c084fc' },
};

// Achievement-Definitionen
const ACHIEVEMENTS = [
  { id: 'first_coin',   icon: '🪙', name: 'Erste Münze!',     desc: 'Ersten Coin eingesammelt',   check: s => s.totalCoinsPicked >= 1   },
  { id: 'coin_50',      icon: '💰', name: 'Schatzjäger',       desc: '50 Coins gesammelt',          check: s => s.totalCoinsPicked >= 50  },
  { id: 'coin_200',     icon: '🏅', name: 'Goldgräber',        desc: '200 Coins gesammelt',         check: s => s.totalCoinsPicked >= 200 },
  { id: 'level_5',      icon: '⭐', name: 'Aufsteiger',        desc: 'Level 5 erreicht',            check: s => s.level >= 5              },
  { id: 'level_10',     icon: '🌟', name: 'Veteran',           desc: 'Level 10 erreicht',           check: s => s.level >= 10             },
  { id: 'speed_pu',     icon: '⚡', name: 'Flash',             desc: 'Speed-Power-Up benutzt',      check: s => s.puUsed.speed            },
  { id: 'freeze_pu',    icon: '❄️', name: 'Eiszeit',           desc: 'Freeze-Power-Up benutzt',     check: s => s.puUsed.freeze           },
  { id: 'no_hit_level', icon: '🛡️', name: 'Unberührbar',      desc: 'Level ohne Treffer beendet',  check: s => s.levelNoHit              },
  { id: 'combo_5',      icon: '🔥', name: 'Combo King',        desc: '5× Combo erreicht',           check: s => s.maxCombo >= 5           },
  { id: 'score_1000',   icon: '💎', name: 'Tausendpunkte',     desc: '1000 Punkte erreicht',        check: s => s.score >= 1000           },
];

// ─────────────────────────────────────────────────────────────
//  CANVAS-FARBEN (Pixel-Zeichnung)
// ─────────────────────────────────────────────────────────────
const COL = {
  // Gras
  grass1: '#2d5a1b', grass2: '#3a7224', grass3: '#243d10', grass4: '#1e3508',
  // Wege/Boden
  path1: '#8B7355', path2: '#A0845A',
  // Wände
  wall1: '#5c4a2a', wall2: '#3d3020', wall3: '#7a6040', wall4: '#2a1e10',
  // Bäume
  treeDk: '#1a3d0a', treeMd: '#2a6a15', treeLt: '#3a8820', treeTrunk: '#6b4423', treeTrunk2: '#543618',
  // Büsche
  bush1: '#1e4d10', bush2: '#2a6a18',
  // Wasser
  water1: '#1a4a6a', water2: '#2266aa', water3: '#3388cc', waterFoam: '#88ccff',
  // Fels
  rock1: '#5a5a5a', rock2: '#787878', rock3: '#3a3a3a',
  // Coins
  coin1: '#ffd700', coin2: '#ffec6e', coinShine: '#fffae0', coinDark: '#c8a000',
  // Player
  playerSkin: '#e8d5b7', playerHair: '#4a3020', playerShirt: '#3a6a2a', playerPants: '#2a3a5a', playerShoes: '#1a1008',
  // Enemy colors by index
  enemyBase: [
    '#e74c3c', '#e67e22', '#9b59b6', '#2980b9', '#16a085', '#c0392b',
  ],
  enemyEye: '#ffffff',
  enemyPupil: '#111111',
  // Night
  nightBase: 'rgba(0,0,40,',
  // Fog
  fogCol: 'rgba(200,220,200,',
};

// ─────────────────────────────────────────────────────────────
//  PIXEL-ART ZEICHENHILFEN
// ─────────────────────────────────────────────────────────────

// Zeichne ein einzelnes Pixel (skaliert auf TILE-Einheiten)
function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// Rahmen in Pixel-Art-Stil
function pixelBorder(ctx, x, y, w, h, col, thickness = 2) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, thickness);          // top
  ctx.fillRect(x, y + h - thickness, w, thickness); // bottom
  ctx.fillRect(x, y, thickness, h);          // left
  ctx.fillRect(x + w - thickness, y, thickness, h); // right
}

// Schachbrett-Muster für Boden
function drawCheckerFloor(ctx, x, y, w, h, c1, c2, tileSize = 8) {
  for (let ry = 0; ry < h; ry += tileSize) {
    for (let rx = 0; rx < w; rx += tileSize) {
      const even = (Math.floor(rx / tileSize) + Math.floor(ry / tileSize)) % 2 === 0;
      ctx.fillStyle = even ? c1 : c2;
      ctx.fillRect(x + rx, y + ry, Math.min(tileSize, w - rx), Math.min(tileSize, h - ry));
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  GLOBALER SPIELZUSTAND
// ─────────────────────────────────────────────────────────────
let G = null;       // Haupt-Spielzustand
let RAF = null;     // requestAnimationFrame handle
let TICK = 0;       // globaler Tick-Counter
let PAUSED = false;
let PENDING_LEVEL = 1;
let GAME_START_TIME = 0;

// Einstellungen (mit Defaults)
const CFG = {
  worldSize: 64,
  enemies:   1.0,
  speed:     1.0,
  walls:     1.0,
  coins:     1.0,
  ai:        1.0,
  weather:   1,
  minimap:   1,
};

// Joystick-State
const JOY = { active: false, dx: 0, dy: 0, ox: 0, oy: 0 };

// Keyboard-State
const KEYS = {};

// Partikel-Pool
let PARTICLES = [];

// Floating Texts
let FLOAT_TEXTS = [];

// Achievements bereits freigeschaltet
const UNLOCKED_ACH = new Set(JSON.parse(localStorage.getItem('cf_ach') || '[]'));

// ─────────────────────────────────────────────────────────────
//  HILFSFUNKTIONEN
// ─────────────────────────────────────────────────────────────
function isBlocking(map, r, c) {
  const t = map[r]?.[c];
  return t === T.WALL || t === T.TREE || t === T.WATER || t === T.ROCK;
}

function tileAt(map, r, c) { return map[r]?.[c] ?? T.WALL; }

function lerp(a, b, t) { return a + (b - a) * t; }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// Setze Status-Bar-Nachricht
let statusTimer = 0;
function setStatus(msg) {
  const el = document.getElementById('status-msg');
  if (el) el.textContent = msg;
  statusTimer = 180;
}

// ─────────────────────────────────────────────────────────────
//  PARTIKEL-SYSTEM
// ─────────────────────────────────────────────────────────────
const PT = {
  SPARK:   0,   // Coin-Funken
  LEAF:    1,   // Blatt
  RAIN:    2,   // Regen
  SNOW:    3,   // Schnee
  FOG:     4,   // Nebel
  DUST:    5,   // Staub
  SMOKE:   6,   // Rauch
  BLOOD:   7,   // Treffer-Effekt (rot)
  STAR:    8,   // Level-Up-Sterne
  BUBBLE:  9,   // Wasser-Blasen
};

function spawnParticle(type, x, y, opts = {}) {
  const p = { type, x, y, vx: 0, vy: 0, life: 60, maxLife: 60, r: 3, color: '#fff', rot: 0, rotV: 0, ...opts };
  PARTICLES.push(p);
}

function spawnCoinBurst(x, y) {
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 / 8) * i + Math.random() * 0.3;
    const spd = 1.5 + Math.random() * 2;
    spawnParticle(PT.SPARK, x, y, {
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 0.5,
      life: 25 + Math.floor(Math.random() * 15),
      maxLife: 40, r: 2 + Math.random() * 2,
      color: Math.random() > 0.5 ? COL.coin1 : COL.coin2,
    });
  }
}

function spawnHitEffect(x, y) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    spawnParticle(PT.BLOOD, x, y, {
      vx: Math.cos(a) * (1 + Math.random() * 2),
      vy: Math.sin(a) * (1 + Math.random() * 2) - 1,
      life: 20, maxLife: 20, r: 2 + Math.random() * 2, color: '#ff2222',
    });
  }
}

function spawnPowerUpEffect(x, y, color) {
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 / 12) * i;
    spawnParticle(PT.STAR, x, y, {
      vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5 - 1,
      life: 35, maxLife: 35, r: 3, color,
    });
  }
}

function spawnLeaf(x, y) {
  spawnParticle(PT.LEAF, x, y, {
    vx: (Math.random() - 0.5) * 1.5, vy: -0.5 - Math.random(),
    life: 80, maxLife: 80,
    r: 2 + Math.random() * 2,
    color: `hsl(${90 + Math.floor(Math.random() * 50)},55%,${25 + Math.floor(Math.random() * 20)}%)`,
    rot: Math.random() * Math.PI * 2,
    rotV: (Math.random() - 0.5) * 0.15,
  });
}

function spawnRainDrop(camX, camY, vw, vh) {
  spawnParticle(PT.RAIN, camX + Math.random() * vw, camY - 10, {
    vx: 0.8 + Math.random() * 0.5, vy: 8 + Math.random() * 4,
    life: 18, maxLife: 18, r: 1,
    color: '#88bbff99',
  });
}

function spawnSnowFlake(camX, camY, vw) {
  spawnParticle(PT.SNOW, camX + Math.random() * vw, camY - 5, {
    vx: (Math.random() - 0.5) * 0.8, vy: 1 + Math.random() * 1.5,
    life: 120, maxLife: 120, r: 1.5 + Math.random() * 2,
    color: '#ddeeff',
  });
}

function spawnFogPuff(camX, camY, vw, vh) {
  spawnParticle(PT.FOG, camX + Math.random() * vw, camY + Math.random() * vh, {
    vx: (Math.random() - 0.5) * 0.3, vy: -0.08,
    life: 220, maxLife: 220, r: 20 + Math.random() * 30,
    color: '#aaccaa',
  });
}

function updateAndDrawParticles(ctx, camX, camY) {
  const next = [];
  for (const p of PARTICLES) {
    p.x  += p.vx;
    p.y  += p.vy;
    p.rot += p.rotV || 0;
    p.life--;

    if (p.type === PT.LEAF)  { p.vy += 0.04; }
    if (p.type === PT.RAIN)  { p.vy += 0.3; }
    if (p.type === PT.SPARK) { p.vy += 0.08; p.vx *= 0.96; }
    if (p.type === PT.BLOOD) { p.vy += 0.12; p.vx *= 0.9; }
    if (p.type === PT.STAR)  { p.vx *= 0.92; p.vy *= 0.92; }
    if (p.type === PT.SNOW)  { p.vx += (Math.random() - 0.5) * 0.1; }

    if (p.life <= 0) continue;
    next.push(p);

    const alpha = p.life / p.maxLife;
    const sx = p.x - camX;
    const sy = p.y - camY;

    ctx.save();
    ctx.globalAlpha = alpha * (p.type === PT.FOG ? 0.10 : p.type === PT.RAIN ? 0.6 : 0.9);

    if (p.type === PT.LEAF) {
      ctx.translate(sx, sy);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
    } else if (p.type === PT.RAIN) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + p.vx * 1.5, sy + p.vy * 1.5);
      ctx.stroke();
    } else if (p.type === PT.FOG) {
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.r);
      grad.addColorStop(0, `rgba(${hexToRgb(p.color)},0.15)`);
      grad.addColorStop(1, `rgba(${hexToRgb(p.color)},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === PT.STAR) {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  PARTICLES = next;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ─────────────────────────────────────────────────────────────
//  FLOATING SCORE TEXTE
// ─────────────────────────────────────────────────────────────
function spawnFloatText(text, canvasX, canvasY, color = '#ffd700') {
  const el = document.createElement('div');
  el.className = 'float-text';
  el.textContent = text;
  el.style.left = canvasX + 'px';
  el.style.top  = canvasY + 'px';
  el.style.color = color;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ─────────────────────────────────────────────────────────────
//  MAP-GENERATOR
// ─────────────────────────────────────────────────────────────
function generateMap(level) {
  const SIZE = CFG.worldSize;
  const map  = Array.from({ length: SIZE }, () => new Uint8Array(SIZE));
  const rand = seededRand(level * 13337 + 99991);
  const used = new Set();

  // Äußere Wände
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (r === 0 || r === SIZE - 1 || c === 0 || c === SIZE - 1) {
        map[r][c] = T.WALL;
      }
    }
  }

  // Spawn-Schutzzone
  for (let r = 1; r <= 4; r++) for (let c = 1; c <= 4; c++) used.add(`${r},${c}`);

  // ── Innenwände & Bäume ─────────────────────────────
  const wallCount = Math.floor((25 + level * 5) * CFG.walls * (SIZE / 32));
  for (let i = 0; i < wallCount; i++) {
    const r = 2 + Math.floor(rand() * (SIZE - 4));
    const c = 2 + Math.floor(rand() * (SIZE - 4));
    const key = `${r},${c}`;
    if (used.has(key)) continue;

    const tileType = rand() > 0.45 ? T.TREE : T.WALL;
    map[r][c] = tileType;
    used.add(key);

    // Gelegentlich kurze Wände ziehen
    if (rand() > 0.45) {
      const horizontal = rand() > 0.5;
      const len = 1 + Math.floor(rand() * 3);
      for (let j = 1; j <= len; j++) {
        const r2 = r + (horizontal ? 0 : j);
        const c2 = c + (horizontal ? j : 0);
        const k2 = `${r2},${c2}`;
        if (r2 > 0 && r2 < SIZE - 1 && c2 > 0 && c2 < SIZE - 1 && !used.has(k2)) {
          map[r2][c2] = tileType;
          used.add(k2);
        }
      }
    }
  }

  // ── Felsen ─────────────────────────────────────────
  const rockCount = Math.floor(8 * (SIZE / 32));
  for (let i = 0; i < rockCount; i++) {
    const r = 3 + Math.floor(rand() * (SIZE - 6));
    const c = 3 + Math.floor(rand() * (SIZE - 6));
    if (map[r][c] === T.EMPTY && !used.has(`${r},${c}`)) {
      map[r][c] = T.ROCK;
      used.add(`${r},${c}`);
    }
  }

  // ── Wasser-Patches ─────────────────────────────────
  const waterCount = Math.floor(3 * (SIZE / 64));
  for (let i = 0; i < waterCount; i++) {
    const cr = 6 + Math.floor(rand() * (SIZE - 12));
    const cc = 6 + Math.floor(rand() * (SIZE - 12));
    const rad = 2 + Math.floor(rand() * 3);
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.sqrt(dr * dr + dc * dc) <= rad) {
          const wr = cr + dr, wc = cc + dc;
          const key = `${wr},${wc}`;
          if (wr > 1 && wr < SIZE - 2 && wc > 1 && wc < SIZE - 2 && !used.has(key) && map[wr][wc] === T.EMPTY) {
            map[wr][wc] = T.WATER;
            used.add(key);
          }
        }
      }
    }
  }

  // ── Büsche ─────────────────────────────────────────
  const bushCount = Math.floor(18 * (SIZE / 32));
  for (let i = 0; i < bushCount; i++) {
    const r = 2 + Math.floor(rand() * (SIZE - 4));
    const c = 2 + Math.floor(rand() * (SIZE - 4));
    if (map[r][c] === T.EMPTY && !used.has(`${r},${c}`)) {
      map[r][c] = T.BUSH;
    }
  }

  // ── Coins ──────────────────────────────────────────
  const coinCount = Math.floor((12 + level * 3) * CFG.coins * (SIZE / 32));
  let placed = 0, tries = 0;
  while (placed < coinCount && tries++ < 6000) {
    const r = 1 + Math.floor(rand() * (SIZE - 2));
    const c = 1 + Math.floor(rand() * (SIZE - 2));
    if (map[r][c] === T.EMPTY && !(r <= 4 && c <= 4)) {
      map[r][c] = T.COIN;
      placed++;
    }
  }

  // ── Power-Ups ──────────────────────────────────────
  const puTypes  = [T.PU_SPEED, T.PU_SHIELD, T.PU_FREEZE, T.PU_MAGNET];
  const puCount  = 4 + Math.floor(level / 2);
  let puPlaced   = 0;
  tries = 0;
  while (puPlaced < puCount && tries++ < 3000) {
    const r = 2 + Math.floor(rand() * (SIZE - 4));
    const c = 2 + Math.floor(rand() * (SIZE - 4));
    if (map[r][c] === T.EMPTY && !(r <= 4 && c <= 4)) {
      map[r][c] = puTypes[puPlaced % 4];
      puPlaced++;
    }
  }

  return map;
}

// ─────────────────────────────────────────────────────────────
//  TILE-ZEICHENFUNKTIONEN (Pixel-Art)
// ─────────────────────────────────────────────────────────────

// Gras mit Variation
function drawGrassTile(ctx, tx, ty, r, c) {
  const v = (r * 7 + c * 13) % 4;
  const colors = [COL.grass1, COL.grass2, COL.grass3, COL.grass1];
  ctx.fillStyle = colors[v];
  ctx.fillRect(tx, ty, TILE, TILE);

  // Kleine Gras-Pixel-Details
  ctx.fillStyle = COL.grass2;
  if ((r + c) % 3 === 0) { ctx.fillRect(tx + 4, ty + 6,  2, 4); ctx.fillRect(tx + 10, ty + 12, 2, 3); }
  if ((r + c) % 5 === 0) { ctx.fillRect(tx + 20, ty + 8,  2, 4); ctx.fillRect(tx + 32, ty + 18, 2, 3); }
  ctx.fillStyle = COL.grass3;
  if ((r * c) % 7 === 0) { ctx.fillRect(tx + 14, ty + 22, 2, 3); }
}

// Wand mit Steinmuster
function drawWallTile(ctx, tx, ty) {
  ctx.fillStyle = COL.wall1;
  ctx.fillRect(tx, ty, TILE, TILE);

  // Steinblock-Muster
  ctx.fillStyle = COL.wall2;
  ctx.fillRect(tx,       ty,       18, 18);
  ctx.fillRect(tx + 22,  ty + 22,  18, 18);
  ctx.fillRect(tx,       ty + 22,  18, 18);
  ctx.fillRect(tx + 22,  ty,       18, 18);

  // Highlights
  ctx.fillStyle = COL.wall3;
  ctx.fillRect(tx + 1, ty + 1, 16, 2);
  ctx.fillRect(tx + 1, ty + 1, 2, 16);
  ctx.fillRect(tx + 23, ty + 23, 16, 2);
  ctx.fillRect(tx + 23, ty + 23, 2, 16);

  // Dunke Schatten
  ctx.fillStyle = COL.wall4;
  ctx.fillRect(tx + 17, ty,    5, TILE);
  ctx.fillRect(tx,      ty+17, TILE, 5);
}

// Baum mit Wind-Animation
function drawTreeTile(ctx, tx, ty, windPhase, r, c) {
  const sway = Math.sin(windPhase + c * 0.6 + r * 0.4) * 2.5;
  const T2   = TILE / 2;

  // Stamm
  ctx.fillStyle = COL.treeTrunk;
  ctx.fillRect(tx + T2 - 5, ty + T2, 10, T2);
  ctx.fillStyle = COL.treeTrunk2;
  ctx.fillRect(tx + T2 - 3, ty + T2, 4, T2);

  // Baum-Krone (3 Ebenen)
  ctx.save();
  ctx.translate(tx + T2 + sway, ty + T2 - 2);

  ctx.fillStyle = COL.treeDk;
  ctx.beginPath(); ctx.arc(0, 2, 17, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = COL.treeMd;
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = COL.treeLt;
  ctx.beginPath(); ctx.arc(-4, -3, 9, 0, Math.PI * 2); ctx.fill();

  // Highlight
  ctx.fillStyle = '#4aaa25';
  ctx.beginPath(); ctx.arc(-5, -6, 4, 0, Math.PI * 2); ctx.fill();

  ctx.restore();

  // Gelegentlich Blatt spawnen
  if (Math.random() < 0.004) spawnLeaf(tx + T2 + sway, ty + 4);
}

// Busch
function drawBushTile(ctx, tx, ty) {
  ctx.fillStyle = COL.grass1;
  ctx.fillRect(tx, ty, TILE, TILE);

  ctx.fillStyle = COL.bush1;
  ctx.beginPath(); ctx.arc(tx + 20, ty + 24, 14, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(tx + 30, ty + 26, 12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(tx + 12, ty + 26, 10, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = COL.bush2;
  ctx.beginPath(); ctx.arc(tx + 20, ty + 22, 10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(tx + 28, ty + 20, 8,  0, Math.PI * 2); ctx.fill();
}

// Wasser (animiert)
function drawWaterTile(ctx, tx, ty) {
  ctx.fillStyle = COL.water1;
  ctx.fillRect(tx, ty, TILE, TILE);

  const wave = Math.sin(TICK * 0.05) * 2;
  ctx.fillStyle = COL.water2;
  for (let i = 0; i < 3; i++) {
    const wy = ty + 8 + i * 11 + wave * (i % 2 === 0 ? 1 : -1);
    ctx.fillRect(tx + 2, wy, TILE - 4, 4);
  }
  ctx.fillStyle = COL.waterFoam;
  ctx.fillRect(tx + 4, ty + 2, TILE - 8, 2);
  ctx.fillRect(tx + 2, ty + 4, 2, 2);
  ctx.fillRect(tx + TILE - 4, ty + 4, 2, 2);
}

// Fels
function drawRockTile(ctx, tx, ty) {
  drawGrassTile(ctx, tx, ty, 0, 0);

  ctx.fillStyle = COL.rock1;
  ctx.beginPath();
  ctx.ellipse(tx + 20, ty + 24, 16, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COL.rock2;
  ctx.beginPath();
  ctx.ellipse(tx + 18, ty + 21, 12, 9, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COL.rock3;
  ctx.fillRect(tx + 26, ty + 26, 4, 6);
}

// Coin (animiert, glänzend)
function drawCoinTile(ctx, tx, ty, r, c) {
  drawGrassTile(ctx, tx, ty, r, c);

  const phase = TICK * 0.08 + r * 0.7 + c * 1.1;
  const scale = 0.82 + 0.18 * Math.sin(phase);
  const cx = tx + TILE / 2;
  const cy = ty + TILE / 2;
  const rad = TILE * 0.28 * scale;

  ctx.save();
  ctx.shadowColor = COL.coin1;
  ctx.shadowBlur = 10;

  // Äußerer Glanz-Ring
  ctx.fillStyle = COL.coinDark;
  ctx.beginPath(); ctx.arc(cx, cy, rad + 2, 0, Math.PI * 2); ctx.fill();

  // Hauptkörper
  ctx.fillStyle = COL.coin1;
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();

  // Inneres Detail
  ctx.fillStyle = COL.coin2;
  ctx.beginPath(); ctx.arc(cx - rad * 0.1, cy - rad * 0.1, rad * 0.65, 0, Math.PI * 2); ctx.fill();

  // Highlight
  ctx.fillStyle = COL.coinShine;
  ctx.beginPath(); ctx.arc(cx - rad * 0.3, cy - rad * 0.35, rad * 0.28, 0, Math.PI * 2); ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

// Power-Up (pulsierend, farbig)
function drawPowerUpTile(ctx, tx, ty, r, c, tileType) {
  drawGrassTile(ctx, tx, ty, r, c);

  const def   = PU_DEF[tileType];
  const phase = TICK * 0.1 + r + c;
  const scale = 0.8 + 0.2 * Math.sin(phase);
  const cx    = tx + TILE / 2;
  const cy    = ty + TILE / 2;

  ctx.save();
  ctx.shadowColor = def.color;
  ctx.shadowBlur  = 14;

  // Hintergrund-Kreis
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = def.color;
  ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.44 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // Rotierende Punkte
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 / 6) * i + TICK * 0.04;
    const px2 = cx + Math.cos(a) * TILE * 0.3 * scale;
    const py2 = cy + Math.sin(a) * TILE * 0.3 * scale;
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(px2, py2, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // Icon
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.font = `${Math.floor(TILE * 0.4 * scale)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.icon, cx, cy);

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
//  SPIELER ZEICHNEN (Pixel-Art, animiert)
// ─────────────────────────────────────────────────────────────
function drawPlayer(ctx, x, y, inv, animFrame, shielded, speedActive) {
  if (inv > 0 && TICK % 8 < 4) return;

  const p = TILE / 10;  // Pixel-Einheit

  ctx.save();

  // Shield-Glow
  if (shielded) {
    ctx.shadowColor = '#60a5fa';
    ctx.shadowBlur  = 16;
    const pulse = 0.9 + 0.1 * Math.sin(TICK * 0.2);
    ctx.strokeStyle = '#60a5fa88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.55 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  } else if (speedActive) {
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur  = 10;
    // Geschwindigkeits-Streifen
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.12 * (4 - i);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x - i * 6, y + p * 3, p * 4, p * 6);
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.shadowColor = '#ffe08a';
    ctx.shadowBlur  = 8;
  }

  // ── Lauf-Animation ──
  const legSwing = Math.sin(animFrame * Math.PI / 2);
  const armSwing = Math.sin(animFrame * Math.PI / 2 + Math.PI);

  // Schatten am Boden
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x + TILE / 2, y + TILE - 3, p * 3.5, p * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Schuhe
  ctx.fillStyle = COL.playerShoes;
  ctx.fillRect(x + p * 2,   y + p * 8 + legSwing * p,    p * 2.5, p * 1.5);
  ctx.fillRect(x + p * 5.5, y + p * 8 - legSwing * p,    p * 2.5, p * 1.5);

  // Hosen
  ctx.fillStyle = COL.playerPants;
  ctx.fillRect(x + p * 2,   y + p * 6.5 + legSwing * p * 0.5, p * 2.5, p * 2);
  ctx.fillRect(x + p * 5.5, y + p * 6.5 - legSwing * p * 0.5, p * 2.5, p * 2);

  // Körper / Hemd
  ctx.fillStyle = COL.playerShirt;
  ctx.fillRect(x + p * 2,   y + p * 3, p * 6, p * 4);

  // Arme
  ctx.fillStyle = COL.playerSkin;
  ctx.fillRect(x + p * 1,   y + p * 3.5 + armSwing * p,    p * 1.5, p * 3);
  ctx.fillRect(x + p * 7.5, y + p * 3.5 - armSwing * p,    p * 1.5, p * 3);

  // Hals
  ctx.fillStyle = COL.playerSkin;
  ctx.fillRect(x + p * 4, y + p * 2, p * 2, p * 1.5);

  // Kopf
  ctx.fillStyle = COL.playerSkin;
  ctx.fillRect(x + p * 3, y, p * 4, p * 3);

  // Haare
  ctx.fillStyle = COL.playerHair;
  ctx.fillRect(x + p * 3, y, p * 4, p * 1);
  ctx.fillRect(x + p * 3, y, p * 1, p * 1.5);

  // Augen
  ctx.fillStyle = '#333';
  ctx.fillRect(x + p * 3.8, y + p * 1.2, p * 0.8, p * 0.8);
  ctx.fillRect(x + p * 5.4, y + p * 1.2, p * 0.8, p * 0.8);

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
//  GEGNER ZEICHNEN (Pixel-Art Ghost-Style, animiert)
// ─────────────────────────────────────────────────────────────
function drawEnemy(ctx, e, frozen, isNight, dayAlpha) {
  const p    = TILE / 10;
  const baseColor = frozen ? '#22d3ee' : COL.enemyBase[e.idx % COL.enemyBase.length];
  const bob  = Math.sin(TICK * 0.12 + e.idx * 1.3) * 2.5;
  const eyeX = e.mode === MODE.CHASE || e.mode === MODE.ALERT ? 1 : 0;  // Augen zur Seite bei Jagd

  ctx.save();

  // Schatten
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(e.x + TILE / 2, e.y + TILE - 3, p * 3.5, p * 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Alarm-Ausrufezeichen
  if (e.mode === MODE.ALERT && e.alertDelay > 0) {
    const blinkOn = Math.floor(TICK / 8) % 2 === 0;
    if (blinkOn) {
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8;
      ctx.fillText('!', e.x + TILE / 2, e.y - 4);
      ctx.shadowBlur = 0;
    }
  }

  // Chase-Indikator
  if ((e.mode === MODE.CHASE || e.mode === MODE.LINGER) && TICK % 60 < 8) {
    ctx.font = '11px monospace';
    ctx.fillStyle = '#ff4444';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 6;
    ctx.fillText('👁', e.x + TILE / 2, e.y - 4);
    ctx.shadowBlur = 0;
  }

  // Glow je nach Modus
  if (e.mode === MODE.CHASE) {
    ctx.shadowColor = frozen ? '#22d3ee' : '#ff2222';
    ctx.shadowBlur  = 14;
  } else if (frozen) {
    ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 10;
  } else {
    ctx.shadowColor = baseColor; ctx.shadowBlur = 4;
  }

  // Körper
  ctx.fillStyle = baseColor;
  ctx.fillRect(e.x + p * 2, e.y + bob,         p * 6, p * 5);
  ctx.fillRect(e.x + p,     e.y + p * 3 + bob,  p * 8, p * 3);

  // Welliger Unterkörper
  for (let i = 0; i < 3; i++) {
    const waveOff = Math.sin(TICK * 0.15 + i * 2.1 + e.idx) * 1.5;
    ctx.fillRect(e.x + p * (1 + i * 2.5), e.y + p * 6 + bob + waveOff, p * 2, p * 2);
  }

  // Dunkle Details / Schattierung
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(e.x + p * 7, e.y + bob,       p * 1.5, p * 5);
  ctx.fillRect(e.x + p,     e.y + p * 5 + bob, p * 8, p * 1);

  // Augen – weiß
  ctx.fillStyle = COL.enemyEye;
  ctx.fillRect(e.x + p * (2.5 + eyeX), e.y + p * 1.5 + bob, p * 2, p * 2);
  ctx.fillRect(e.x + p * (5.5 + eyeX), e.y + p * 1.5 + bob, p * 2, p * 2);

  // Pupillen
  ctx.fillStyle = COL.enemyPupil;
  ctx.fillRect(e.x + p * (3 + eyeX),   e.y + p * 2 + bob,   p * 1, p * 1);
  ctx.fillRect(e.x + p * (6 + eyeX),   e.y + p * 2 + bob,   p * 1, p * 1);

  // Frozen: Eisschicht
  if (frozen) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#88eeff';
    ctx.fillRect(e.x + p, e.y + bob, p * 8, p * 7);
    ctx.globalAlpha = 1;
  }

  // Patrol-Modus: etwas transparent (schlafend)
  if (e.mode === MODE.PATROL) {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#000';
    ctx.fillRect(e.x + p * 2.5, e.y + p * 1.5 + bob, p * 2, p * 1);
    ctx.fillRect(e.x + p * 5.5, e.y + p * 1.5 + bob, p * 2, p * 1);
    ctx.globalAlpha = 1;
    // ZZZ
    ctx.font = '8px monospace';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    if (Math.floor(TICK / 40) % 2 === 0) ctx.fillText('z', e.x + TILE - 2, e.y + 4);
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
//  Q-LEARNING GEGNER
// ─────────────────────────────────────────────────────────────
class Enemy {
  constructor(x, y, level, idx) {
    this.x     = x;
    this.y     = y;
    this.idx   = idx;
    // Q-Learning
    this.Q     = {};
    this.lr    = 0.15 * CFG.ai;
    this.gamma = 0.9;
    this.eps   = Math.max(0.03, (0.85 - level * 0.06) / CFG.ai);
    // Timing
    this.interval   = Math.max(4, Math.floor((20 - level * 1.1) / CFG.speed));
    this.timer      = Math.floor(Math.random() * 20);  // versetzt starten
    this.lastS      = null;
    this.lastA      = null;
    // Modus
    this.mode        = MODE.PATROL;
    this.lingerTimer = 0;
    this.alertDelay  = 0;
    // Patrouille
    this.patrolDir   = Math.floor(Math.random() * 4);
    this.patrolWait  = 0;
    // Sackgassen-Erkennung
    this.stuckCount  = 0;
    this.lastX       = x;
    this.lastY       = y;
    this.stuckTimer  = 0;
    // Animations-State
    this.animFrame   = 0;
    this.animTimer   = 0;
    // Statistik
    this.totalMoves  = 0;
  }

  // Q-Tabelle
  q(s, a)        { return this.Q[`${s}:${a}`] || 0; }
  setQ(s, a, v)  { this.Q[`${s}:${a}`] = v; }

  // State-Kodierung
  encodeState(px, py, isNight) {
    const dx    = Math.sign(px - this.x);
    const dy    = Math.sign(py - this.y);
    const dBin  = Math.min(9, Math.floor(Math.hypot(px - this.x, py - this.y) / TILE));
    const night = isNight ? 1 : 0;
    return `${dx},${dy},${dBin},${night},${this.mode}`;
  }

  // Aktion wählen
  chooseAction(state) {
    if (Math.random() < this.eps) return Math.floor(Math.random() * 4);
    let best = 0, bv = this.q(state, 0);
    for (let a = 1; a < 4; a++) {
      const v = this.q(state, a);
      if (v > bv) { bv = v; best = a; }
    }
    return best;
  }

  // Q-Update
  learn(prevState, action, reward, nextState) {
    const maxQ = Math.max(...[0, 1, 2, 3].map(a => this.q(nextState, a)));
    const old  = this.q(prevState, action);
    this.setQ(prevState, action, old + this.lr * (reward + this.gamma * maxQ - old));
  }

  // Bewegungsversuch
  tryMove(map, dirIdx) {
    const DIRS = [[0, -TILE], [0, TILE], [-TILE, 0], [TILE, 0]];
    const [dx, dy] = DIRS[dirIdx];
    const nx = this.x + dx;
    const ny = this.y + dy;
    const nc = Math.floor(nx / TILE);
    const nr = Math.floor(ny / TILE);
    const SIZE = CFG.worldSize;
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !isBlocking(G.map, nr, nc)) {
      this.x = nx; this.y = ny;
      this.totalMoves++;
      return true;
    }
    return false;
  }

  // Sackgassen-Prüfung
  checkStuck() {
    if (++this.stuckTimer < 3) return null;
    this.stuckTimer = 0;
    const moved = Math.hypot(this.x - this.lastX, this.y - this.lastY);
    this.lastX = this.x; this.lastY = this.y;
    if (moved < TILE * 0.5) {
      this.stuckCount++;
      if (this.stuckCount >= 2) {
        this.stuckCount = 0;
        return Math.floor(Math.random() * 4);  // Zufalls-Ausweichrichtung
      }
    } else {
      this.stuckCount = 0;
    }
    return null;
  }

  // Alarm von außen empfangen
  alarm(delay) {
    if (this.mode === MODE.PATROL || this.mode === MODE.LINGER) {
      this.mode       = MODE.ALERT;
      this.alertDelay = delay;
    }
  }

  // Haupt-Update
  update(px, py, frozen, isNight) {
    if (frozen) return;
    if (++this.timer < this.interval) return;
    this.timer = 0;

    if (++this.animTimer > 8) { this.animFrame = (this.animFrame + 1) % 4; this.animTimer = 0; }

    const detectR = isNight ? DETECT_NIGHT : DETECT_DAY;
    const d = Math.hypot(px - this.x, py - this.y);

    // ── Modus-Logik ───────────────────────────────────
    if (d <= detectR) {
      if (this.mode !== MODE.CHASE) {
        this.mode        = MODE.CHASE;
        this.lingerTimer = 120;
        // Alarm an andere senden
        G.enemies.forEach(other => {
          if (other !== this) {
            const od = Math.hypot(other.x - this.x, other.y - this.y);
            if (od < ALARM_RADIUS) {
              const delay = Math.floor(od / TILE * 4);
              other.alarm(delay);
            }
          }
        });
        G.lastAlarmTick = TICK;
      }
    } else if (this.mode === MODE.CHASE) {
      this.mode        = MODE.LINGER;
      this.lingerTimer = 100;
    } else if (this.mode === MODE.LINGER) {
      if (--this.lingerTimer <= 0 || d > detectR + LINGER_EXTRA) {
        this.mode = MODE.PATROL;
      }
    } else if (this.mode === MODE.ALERT) {
      if (--this.alertDelay <= 0) {
        this.mode        = MODE.CHASE;
        this.lingerTimer = 150;
      }
    }

    // ── Sackgassen ────────────────────────────────────
    const escapeDir = this.checkStuck();

    // ── Bewegung ──────────────────────────────────────
    if (this.mode === MODE.CHASE || this.mode === MODE.LINGER) {
      const state  = this.encodeState(px, py, isNight);
      const action = escapeDir !== null ? escapeDir : this.chooseAction(state);
      const oldD   = Math.hypot(px - this.x, py - this.y);
      const moved  = this.tryMove(G.map, action);
      const newD   = Math.hypot(px - this.x, py - this.y);
      const reward = moved ? (oldD - newD > 0 ? 1.2 : -0.4) : -1;
      if (this.lastS !== null) this.learn(this.lastS, this.lastA, reward, state);
      this.lastS = state; this.lastA = action;

    } else if (this.mode === MODE.ALERT) {
      // Warten (alertDelay läuft ab)
    } else {
      // Patrouille
      if (this.patrolWait > 0) { this.patrolWait--; return; }
      const dir   = escapeDir !== null ? escapeDir : this.patrolDir;
      const moved = this.tryMove(G.map, dir);
      if (!moved) {
        this.patrolDir  = Math.floor(Math.random() * 4);
        this.patrolWait = 4 + Math.floor(Math.random() * 6);
      } else if (Math.random() < 0.1) {
        this.patrolDir = Math.floor(Math.random() * 4);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  HIGHSCORE-SYSTEM
// ─────────────────────────────────────────────────────────────
function loadHS() {
  try { return JSON.parse(localStorage.getItem('cf_hs_v2') || '[]'); }
  catch { return []; }
}

function saveHS(name, score, level) {
  let hs = loadHS();
  hs.push({ name: (name || 'ANON').toUpperCase().slice(0, 8), score, level });
  hs.sort((a, b) => b.score - a.score);
  hs = hs.slice(0, 3);
  localStorage.setItem('cf_hs_v2', JSON.stringify(hs));
  return hs;
}

function renderHS() {
  const hs = loadHS();
  for (let i = 1; i <= 3; i++) {
    const e = hs[i - 1];
    const nameEl  = document.getElementById(`hs${i}-name`);
    const scoreEl = document.getElementById(`hs${i}-score`);
    const levEl   = document.getElementById(`hs${i}-level`);
    if (nameEl)  nameEl.textContent  = e?.name  || '---';
    if (scoreEl) scoreEl.textContent = e?.score || 0;
    if (levEl)   levEl.textContent   = e ? `Lv.${e.level}` : 'Lv.0';
  }
}

// ─────────────────────────────────────────────────────────────
//  ACHIEVEMENT-SYSTEM
// ─────────────────────────────────────────────────────────────
function checkAchievements() {
  if (!G) return;
  for (const ach of ACHIEVEMENTS) {
    if (UNLOCKED_ACH.has(ach.id)) continue;
    if (ach.check(G.stats)) {
      UNLOCKED_ACH.add(ach.id);
      localStorage.setItem('cf_ach', JSON.stringify([...UNLOCKED_ACH]));
      showAchievement(ach);
    }
  }
}

let achTimeout = null;
function showAchievement(ach) {
  const pop = document.getElementById('achievement-popup');
  document.getElementById('ach-icon').textContent = ach.icon;
  document.getElementById('ach-name').textContent = ach.name;
  document.getElementById('ach-desc').textContent = ach.desc;
  pop.classList.add('show');
  if (achTimeout) clearTimeout(achTimeout);
  achTimeout = setTimeout(() => pop.classList.remove('show'), 3000);
}

// ─────────────────────────────────────────────────────────────
//  SCREEN-MANAGEMENT
// ─────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function goToMenu() {
  cancelAnimationFrame(RAF);
  PAUSED = false;
  document.getElementById('pause-overlay').classList.remove('visible');
  document.getElementById('mini-map-canvas').style.display = 'none';
  renderHS();
  showScreen('screen-menu');
}

// ─────────────────────────────────────────────────────────────
//  LOADING SCREEN
// ─────────────────────────────────────────────────────────────
const LOADING_HINTS = [
  'Bäume werden gepflanzt...', 'Münzen werden versteckt...', 'Gegner trainieren KI...',
  'Wind pfeift durch die Blätter...', 'Map wird generiert...', 'Partikel werden geladen...',
  'Tag/Nacht-Zyklus kalibriert...', 'Q-Tabellen werden initialisiert...',
];

function showLoading(onDone) {
  const ls = document.getElementById('loading-screen');
  const bar = document.getElementById('loading-bar');
  const hint = document.getElementById('loading-hint');
  ls.classList.add('visible');
  let pct = 0;
  const iv = setInterval(() => {
    pct += 8 + Math.random() * 10;
    bar.style.width = Math.min(pct, 100) + '%';
    hint.textContent = LOADING_HINTS[Math.floor(Math.random() * LOADING_HINTS.length)];
    if (pct >= 100) {
      clearInterval(iv);
      setTimeout(() => { ls.classList.remove('visible'); onDone(); }, 150);
    }
  }, 80);
}

// ─────────────────────────────────────────────────────────────
//  SPIEL INITIALISIEREN
// ─────────────────────────────────────────────────────────────
function handleStart() {
  showLoading(() => startGame(1));
}

function startGame(level) {
  cancelAnimationFrame(RAF);
  TICK = 0;
  PAUSED = false;
  PARTICLES = [];
  FLOAT_TEXTS = [];
  document.getElementById('pause-overlay').classList.remove('visible');

  const SIZE   = CFG.worldSize;
  const map    = generateMap(level);
  const totalCoins = Array.from(map).reduce((sum, row) =>
    sum + Array.from(row).filter(t => t === T.COIN).length, 0);

  // Gegner erstellen
  const eBase   = Math.max(1, Math.round((1 + Math.floor(level * 0.6)) * CFG.enemies));
  const eCount  = Math.min(eBase, 10);
  const enemies = [];
  const usedSpots = new Set();
  for (let r = 1; r <= 5; r++) for (let c = 1; c <= 5; c++) usedSpots.add(`${r},${c}`);

  for (let i = 0; i < eCount; i++) {
    let er, ec, tries = 0;
    do {
      er = 3 + Math.floor(Math.random() * (SIZE - 6));
      ec = 3 + Math.floor(Math.random() * (SIZE - 6));
      tries++;
    } while ((map[er]?.[ec] !== T.EMPTY || usedSpots.has(`${er},${ec}`) || (er < 7 && ec < 7)) && tries < 800);
    usedSpots.add(`${er},${ec}`);
    enemies.push(new Enemy(ec * TILE, er * TILE, level, i));
  }

  G = {
    map,
    level,
    score: 0,
    lives: 3,
    coinsLeft: totalCoins,
    totalCoins,
    invincible: 0,
    camX: 0, camY: 0,
    player: { x: TILE, y: TILE, animFrame: 0, animTimer: 0, facing: 1 },
    enemies,
    powerUps: {
      [T.PU_SPEED]:  0,
      [T.PU_SHIELD]: 0,
      [T.PU_FREEZE]: 0,
      [T.PU_MAGNET]: 0,
    },
    // Tag/Nacht
    dayTick: 0,
    // Wetter
    weather: WEATHER.CLEAR,
    weatherTimer: 600 + Math.floor(Math.random() * 600),
    // Wind
    windPhase: 0,
    // Alarm
    lastAlarmTick: -999,
    // Combo
    combo: 0,
    comboTimer: 0,
    lastCoinTick: -999,
    // Stats
    stats: {
      level,
      score: 0,
      totalCoinsPicked: 0,
      levelNoHit: true,
      maxCombo: 0,
      dodges: 0,
      puUsed: { speed: false, shield: false, freeze: false, magnet: false },
    },
    // Spielzeit
    startTime: Date.now(),
  };

  GAME_START_TIME = Date.now();

  // Canvas-Größe
  const canvas = document.getElementById('gameCanvas');
  const vw = Math.min(window.innerWidth, 500);
  const topH    = 52;  // hud-top
  const puH     = 26;  // hud-powerups
  const bottomH = 145; // status + joystick
  canvas.width  = vw;
  canvas.height = Math.max(120, window.innerHeight - topH - puH - bottomH);

  // Mini-Map
  const mm = document.getElementById('mini-map-canvas');
  mm.style.display = CFG.minimap ? 'block' : 'none';

  updateHUD();
  showScreen('screen-game');
  loop();
}

function nextLevel() {
  showLoading(() => {
    const nextLvl = PENDING_LEVEL;
    const oldScore = G ? G.score : 0;
    const oldLives = G ? G.lives : 3;
    startGame(nextLvl);
    G.score = oldScore;
    G.lives = Math.min(oldLives + 1, 5);  // +1 Leben pro Level
    updateHUD();
  });
}

function continueFromDead() {
  if (!G) return;
  const lv = G.level;
  startGame(lv);
}

// ─────────────────────────────────────────────────────────────
//  PAUSE
// ─────────────────────────────────────────────────────────────
function togglePause() {
  PAUSED = !PAUSED;
  const overlay = document.getElementById('pause-overlay');
  if (PAUSED) {
    overlay.classList.add('visible');
    cancelAnimationFrame(RAF);
  } else {
    overlay.classList.remove('visible');
    loop();
  }
}

function resumeGame() {
  PAUSED = false;
  document.getElementById('pause-overlay').classList.remove('visible');
  loop();
}

// ─────────────────────────────────────────────────────────────
//  HUD UPDATE
// ─────────────────────────────────────────────────────────────
function updateHUD() {
  if (!G) return;
  const { level, score, lives, coinsLeft, totalCoins, dayTick, powerUps } = G;
  const iq = Math.min(100, Math.floor(level * 8 * CFG.ai));

  document.getElementById('hud-level').textContent = level;
  document.getElementById('hud-score').textContent = score;
  document.getElementById('hud-coins').textContent = `${totalCoins - coinsLeft}/${totalCoins}`;
  document.getElementById('hud-lives').textContent = '❤️'.repeat(Math.max(0, lives));
  document.getElementById('iq-value').textContent  = iq;

  // IQ-Bar
  const bar = document.getElementById('iq-bar');
  bar.style.width = iq + '%';
  bar.style.background = `hsl(${Math.floor(120 - iq * 1.2)},80%,55%)`;

  // Tag/Nacht-Anzeige
  const phase = (dayTick % DAY_TICKS) / DAY_TICKS;
  let dayLabel = '☀️';
  if (phase > 0.875 || phase < 0.125) dayLabel = '🌅';
  else if (phase > 0.75) dayLabel = '🌙';
  else if (phase > 0.625) dayLabel = '🌆';
  document.getElementById('hud-daytime').textContent = dayLabel;

  // Power-Up Badges
  const puEl = document.getElementById('hud-powerups');
  puEl.innerHTML = '';
  for (const [type, remaining] of Object.entries(powerUps)) {
    if (remaining > 0) {
      const def  = PU_DEF[parseInt(type)];
      if (!def) continue;
      const secs = Math.ceil(remaining / 60);
      const badge = document.createElement('div');
      badge.className = `pu-badge ${def.cls}`;
      badge.innerHTML = `${def.icon} <span>${secs}s</span>`;
      puEl.appendChild(badge);
    }
  }

  // Wetter-Status
  const wLabels = ['☀️ Klar', '🌧️ Regen', '🌫️ Nebel', '⛈️ Sturm'];
  const statusWeath = document.getElementById('status-weather');
  if (statusWeath) statusWeath.textContent = wLabels[G.weather] || '☀️';
}

// ─────────────────────────────────────────────────────────────
//  MINI-MAP ZEICHNEN
// ─────────────────────────────────────────────────────────────
function drawMiniMap() {
  if (!CFG.minimap || !G) return;
  const mm  = document.getElementById('mini-map-canvas');
  const ctx = mm.getContext('2d');
  const W   = mm.width;
  const H   = mm.height;
  const SIZE = CFG.worldSize;
  const cs  = W / SIZE;  // cell size in px

  ctx.fillStyle = '#050e02';
  ctx.fillRect(0, 0, W, H);

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const t = G.map[r][c];
      let col = null;
      if (t === T.WALL || t === T.ROCK) col = '#5c4a2a';
      else if (t === T.TREE)            col = '#2a6a15';
      else if (t === T.WATER)           col = '#2266aa';
      else if (t === T.COIN)            col = '#ffd70080';
      else if (t >= T.PU_SPEED)        col = '#cc88ff80';
      if (col) { ctx.fillStyle = col; ctx.fillRect(c * cs, r * cs, cs, cs); }
    }
  }

  // Gegner
  G.enemies.forEach(e => {
    const ec = e.x / TILE * cs, er = e.y / TILE * cs;
    ctx.fillStyle = e.mode === MODE.CHASE ? '#ff4444' : '#ff880088';
    ctx.fillRect(ec - cs, er - cs, cs * 2, cs * 2);
  });

  // Spieler
  const pc = G.player.x / TILE * cs, pr = G.player.y / TILE * cs;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pc - cs, pr - cs, cs * 2.5, cs * 2.5);

  // Kamera-Rahmen
  const cam = document.getElementById('gameCanvas');
  const fx = G.camX / TILE * cs, fy = G.camY / TILE * cs;
  const fw = (cam.width / TILE)  * cs, fh = (cam.height / TILE) * cs;
  ctx.strokeStyle = '#ffffff44';
  ctx.lineWidth = 1;
  ctx.strokeRect(fx, fy, fw, fh);
}

// ─────────────────────────────────────────────────────────────
//  TAG/NACHT OVERLAY
// ─────────────────────────────────────────────────────────────
function updateDayNight() {
  if (!G) return;
  G.dayTick = (G.dayTick + 1) % DAY_TICKS;
  const phase = G.dayTick / DAY_TICKS;  // 0..1

  let nightAlpha = 0;
  if (phase >= 0 && phase < 0.25)       nightAlpha = 0;               // Tag
  else if (phase < 0.35)                nightAlpha = (phase - 0.25) / 0.10 * 0.55;  // Dämmerung
  else if (phase < 0.65)                nightAlpha = 0.55;             // Nacht
  else if (phase < 0.75)                nightAlpha = (0.75 - phase) / 0.10 * 0.55;  // Morgengrauen
  else                                   nightAlpha = 0;

  document.getElementById('night-overlay').style.background
    = `rgba(0,0,40,${nightAlpha.toFixed(3)})`;
}

function isNight() {
  if (!G) return false;
  const phase = G.dayTick / DAY_TICKS;
  return phase >= 0.35 && phase < 0.65;
}

// ─────────────────────────────────────────────────────────────
//  WETTER-SYSTEM
// ─────────────────────────────────────────────────────────────
function updateWeather() {
  if (!G || !CFG.weather) return;
  G.weatherTimer--;
  if (G.weatherTimer <= 0) {
    const choices = [WEATHER.CLEAR, WEATHER.CLEAR, WEATHER.CLEAR, WEATHER.RAIN, WEATHER.FOG];
    if (G.level > 5) choices.push(WEATHER.STORM);
    G.weather      = choices[Math.floor(Math.random() * choices.length)];
    G.weatherTimer = 500 + Math.floor(Math.random() * 800);
    const names = ['Klar', 'Regen', 'Nebel', 'Sturm'];
    setStatus(`🌦️ Wetter ändert sich: ${names[G.weather]}`);
  }
}

function spawnWeatherParticles(camX, camY, vw, vh) {
  if (!CFG.weather || !G) return;
  switch (G.weather) {
    case WEATHER.RAIN:
      for (let i = 0; i < 5; i++) spawnRainDrop(camX, camY, vw, vh);
      break;
    case WEATHER.STORM:
      for (let i = 0; i < 10; i++) spawnRainDrop(camX, camY, vw, vh);
      if (Math.random() < 0.05) {
        // Blitz-Flash
        document.getElementById('alert-flash').style.background = 'rgba(200,200,255,0.15)';
        setTimeout(() => { document.getElementById('alert-flash').style.background = 'rgba(255,0,0,0)'; }, 80);
      }
      break;
    case WEATHER.FOG:
      if (Math.random() < 0.12) spawnFogPuff(camX, camY, vw, vh);
      break;
  }
}

// ─────────────────────────────────────────────────────────────
//  KARTEN-RENDERING
// ─────────────────────────────────────────────────────────────
function renderMap(ctx, camX, camY, vw, vh) {
  const SIZE = CFG.worldSize;
  const cMin = Math.max(0, Math.floor(camX / TILE) - 1);
  const cMax = Math.min(SIZE - 1, Math.ceil((camX + vw) / TILE) + 1);
  const rMin = Math.max(0, Math.floor(camY / TILE) - 1);
  const rMax = Math.min(SIZE - 1, Math.ceil((camY + vh) / TILE) + 1);

  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      const t  = G.map[r][c];
      const tx = c * TILE;
      const ty = r * TILE;

      switch (t) {
        case T.EMPTY: drawGrassTile(ctx, tx, ty, r, c); break;
        case T.WALL:  drawWallTile(ctx, tx, ty); break;
        case T.TREE:  drawTreeTile(ctx, tx, ty, G.windPhase, r, c); break;
        case T.BUSH:  drawBushTile(ctx, tx, ty); break;
        case T.WATER: drawWaterTile(ctx, tx, ty); break;
        case T.ROCK:  drawRockTile(ctx, tx, ty); break;
        case T.COIN:  drawCoinTile(ctx, tx, ty, r, c); break;
        default:
          if (t >= T.PU_SPEED && t <= T.PU_MAGNET) {
            drawPowerUpTile(ctx, tx, ty, r, c, t);
          } else {
            drawGrassTile(ctx, tx, ty, r, c);
          }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  COMBO-SYSTEM
// ─────────────────────────────────────────────────────────────
function addCombo() {
  const COMBO_WINDOW = 90;  // Ticks
  if (TICK - G.lastCoinTick < COMBO_WINDOW) {
    G.combo++;
    if (G.combo > G.stats.maxCombo) G.stats.maxCombo = G.combo;
    const el = document.getElementById('combo-display');
    document.getElementById('combo-num').textContent = `×${G.combo}`;
    el.style.opacity = '1';
    G.comboTimer = 120;
  } else {
    G.combo = 1;
  }
  G.lastCoinTick = TICK;
}

function updateComboDisplay() {
  if (!G) return;
  if (G.comboTimer > 0) {
    G.comboTimer--;
    if (G.comboTimer <= 0) {
      document.getElementById('combo-display').style.opacity = '0';
      G.combo = 0;
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  SPIELER-BEWEGUNG
// ─────────────────────────────────────────────────────────────
function movePlayer() {
  if (!G) return;
  const SIZE  = CFG.worldSize;
  const MAP_W = SIZE * TILE;
  const MAP_H = SIZE * TILE;
  const speedMult = G.powerUps[T.PU_SPEED] > 0 ? 2.2 : 1.0;
  const weatherPenalty = (G.weather === WEATHER.RAIN || G.weather === WEATHER.STORM) ? 0.8 : 1.0;
  const spd   = 2.5 * CFG.speed * speedMult * weatherPenalty;

  if (!JOY.active || (Math.abs(JOY.dx) < 0.04 && Math.abs(JOY.dy) < 0.04)) return;

  const mag = Math.hypot(JOY.dx, JOY.dy) || 1;
  const vx  = (JOY.dx / mag) * spd;
  const vy  = (JOY.dy / mag) * spd;

  // Facing-Richtung
  if (Math.abs(vx) > Math.abs(vy)) G.player.facing = vx > 0 ? 1 : -1;

  // X-Achse
  const nx = G.player.x + vx;
  const rowsCur = [
    Math.floor((G.player.y + TILE * 0.12) / TILE),
    Math.floor((G.player.y + TILE * 0.88) / TILE),
  ];
  const colsNX = [
    Math.floor((nx + TILE * 0.12) / TILE),
    Math.floor((nx + TILE * 0.88) / TILE),
  ];
  if (colsNX.every(c => rowsCur.every(r => !isBlocking(G.map, r, c)))) {
    G.player.x = clamp(nx, 0, MAP_W - TILE);
  }

  // Y-Achse
  const ny = G.player.y + vy;
  const colsCur = [
    Math.floor((G.player.x + TILE * 0.12) / TILE),
    Math.floor((G.player.x + TILE * 0.88) / TILE),
  ];
  const rowsNY = [
    Math.floor((ny + TILE * 0.12) / TILE),
    Math.floor((ny + TILE * 0.88) / TILE),
  ];
  if (rowsNY.every(r => colsCur.every(c => !isBlocking(G.map, r, c)))) {
    G.player.y = clamp(ny, 0, MAP_H - TILE);
  }

  // Animations-Update
  if (++G.player.animTimer > 5) {
    G.player.animFrame = (G.player.animFrame + 1) % 4;
    G.player.animTimer = 0;
  }
}

// ─────────────────────────────────────────────────────────────
//  COIN & POWER-UP EINSAMMELN
// ─────────────────────────────────────────────────────────────
function collectItems(canvas) {
  const pc = Math.floor((G.player.x + TILE / 2) / TILE);
  const pr = Math.floor((G.player.y + TILE / 2) / TILE);
  const t  = G.map[pr]?.[pc];
  if (t === undefined) return;

  if (t === T.COIN) {
    G.map[pr][pc] = T.EMPTY;
    G.coinsLeft--;
    addCombo();
    const pts = 10 * G.level * Math.max(1, G.combo);
    G.score += pts;
    G.stats.score = G.score;
    G.stats.totalCoinsPicked++;

    // Partikel & Float-Text
    const wx = G.player.x + TILE / 2 - G.camX;
    const wy = G.player.y - G.camY + 20;
    spawnCoinBurst(G.player.x + TILE / 2, G.player.y + TILE / 2);
    const rect = canvas.getBoundingClientRect();
    spawnFloatText(`+${pts}`, rect.left + wx, rect.top + wy, G.combo > 2 ? '#ff8844' : '#ffd700');
    updateHUD();
    checkAchievements();

  } else if (t === T.PU_SPEED || t === T.PU_SHIELD || t === T.PU_FREEZE || t === T.PU_MAGNET) {
    G.map[pr][pc] = T.EMPTY;
    const def = PU_DEF[t];
    G.powerUps[t] = def.dur;
    setStatus(`${def.icon} ${def.label} aktiviert!`);
    spawnPowerUpEffect(G.player.x + TILE / 2, G.player.y + TILE / 2, def.color);
    const rect = canvas.getBoundingClientRect();
    spawnFloatText(def.icon, rect.left + G.player.x + TILE / 2 - G.camX, rect.top + G.player.y - G.camY);

    // Statistik
    if (t === T.PU_SPEED)  G.stats.puUsed.speed  = true;
    if (t === T.PU_FREEZE) G.stats.puUsed.freeze = true;
    updateHUD();
    checkAchievements();
  }

  // Magnet: Coins in Radius einsammeln
  if (G.powerUps[T.PU_MAGNET] > 0) {
    const MAGNET_R = 3;
    const SIZE = CFG.worldSize;
    for (let dr = -MAGNET_R; dr <= MAGNET_R; dr++) {
      for (let dc = -MAGNET_R; dc <= MAGNET_R; dc++) {
        if (Math.hypot(dr, dc) > MAGNET_R) continue;
        const mr = pr + dr, mc = pc + dc;
        if (mr >= 0 && mr < SIZE && mc >= 0 && mc < SIZE && G.map[mr][mc] === T.COIN) {
          G.map[mr][mc] = T.EMPTY;
          G.coinsLeft--;
          const pts2 = 10 * G.level;
          G.score += pts2;
          G.stats.totalCoinsPicked++;
          spawnCoinBurst(mc * TILE + TILE / 2, mr * TILE + TILE / 2);
        }
      }
    }
    updateHUD();
  }
}

// ─────────────────────────────────────────────────────────────
//  KOLLISIONS-ERKENNUNG
// ─────────────────────────────────────────────────────────────
function checkEnemyCollision(canvas) {
  const shielded = G.powerUps[T.PU_SHIELD] > 0;
  if (G.invincible > 0 || shielded) { G.invincible--; return; }

  for (const e of G.enemies) {
    if (dist(e.x, e.y, G.player.x, G.player.y) < TILE * 0.65) {
      G.lives--;
      G.invincible = 130;
      G.stats.levelNoHit = false;
      updateHUD();
      spawnHitEffect(G.player.x + TILE / 2, G.player.y + TILE / 2);
      // Alarm-Flash
      document.getElementById('alert-flash').style.background = 'rgba(255,0,0,0.25)';
      setTimeout(() => document.getElementById('alert-flash').style.background = 'rgba(255,0,0,0)', 200);
      if (G.lives <= 0) { showDead(); return; }
      setStatus(`💥 Treffer! Noch ${G.lives} Leben`);
      break;
    }
    // Dodges zählen (Gegner knapp vorbei)
    if (dist(e.x, e.y, G.player.x, G.player.y) < TILE * 1.4 && e.mode === MODE.CHASE) {
      G.stats.dodges++;
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  POWER-UP TIMER
// ─────────────────────────────────────────────────────────────
function tickPowerUps() {
  for (const type of [T.PU_SPEED, T.PU_SHIELD, T.PU_FREEZE, T.PU_MAGNET]) {
    if (G.powerUps[type] > 0) {
      G.powerUps[type]--;
      if (G.powerUps[type] === 0) {
        const def = PU_DEF[type];
        setStatus(`${def.icon} ${def.label} abgelaufen`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  KAMERA
// ─────────────────────────────────────────────────────────────
function updateCamera(vw, vh) {
  const SIZE  = CFG.worldSize;
  const MAP_W = SIZE * TILE;
  const MAP_H = SIZE * TILE;
  const targetX = G.player.x + TILE / 2 - vw / 2;
  const targetY = G.player.y + TILE / 2 - vh / 2;
  // Sanftes Folgen
  G.camX = lerp(G.camX, targetX, 0.12);
  G.camY = lerp(G.camY, targetY, 0.12);
  G.camX = clamp(G.camX, 0, Math.max(0, MAP_W - vw));
  G.camY = clamp(G.camY, 0, Math.max(0, MAP_H - vh));
}

// ─────────────────────────────────────────────────────────────
//  LEVEL-UP & GAME OVER SCREENS
// ─────────────────────────────────────────────────────────────
function showLevelUp(nextLevel) {
  cancelAnimationFrame(RAF);
  PENDING_LEVEL = nextLevel;
  const iq    = Math.min(100, Math.floor(nextLevel * 8 * CFG.ai));
  const eNew  = Math.min(Math.max(1, Math.round((1 + Math.floor(nextLevel * 0.6)) * CFG.enemies)), 10);

  document.getElementById('levelup-num').textContent  = `LEVEL ${nextLevel}`;
  document.getElementById('levelup-next').textContent = nextLevel;

  const changes = [
    { cls: 'warn',   text: `🧠 KI-IQ steigt auf ${iq}` },
    { cls: 'danger', text: `👾 ${eNew} Gegner aktiv` },
    { cls: 'good',   text: `🪙 Neue Coins auf der Map` },
    { cls: 'info',   text: `🗺️ Neue Map wird generiert` },
    { cls: 'good',   text: `❤️ +1 Leben für nächstes Level` },
  ];
  if (G.stats.levelNoHit) changes.push({ cls: 'good', text: '🏅 Perfektes Level – kein Treffer!' });

  const container = document.getElementById('levelup-changes');
  container.innerHTML = changes.map(c =>
    `<div class="lu-change ${c.cls}">${c.text}</div>`
  ).join('');

  // Achievement-Check
  G.stats.level = nextLevel;
  checkAchievements();

  showScreen('screen-levelup');
}

function showDead() {
  cancelAnimationFrame(RAF);
  const elapsed = Math.round((Date.now() - GAME_START_TIME) / 1000);
  const m = Math.floor(elapsed / 60), s = elapsed % 60;

  document.getElementById('dead-level').textContent  = G.level;
  document.getElementById('dead-score').textContent  = G.score;
  document.getElementById('dead-coins').textContent  = G.stats.totalCoinsPicked;
  document.getElementById('dead-dodged').textContent = G.stats.dodges;
  document.getElementById('dead-time').textContent   = `${m}:${String(s).padStart(2, '0')}`;

  // Highscore
  const hs = loadHS();
  const playerName = document.getElementById('player-name').value || 'ANON';
  const isNew = hs.length < 3 || G.score > (hs[hs.length - 1]?.score || 0);
  if (isNew) {
    saveHS(playerName, G.score, G.level);
    document.getElementById('new-hs-banner').style.display = 'block';
  } else {
    document.getElementById('new-hs-banner').style.display = 'none';
  }
  renderHS();
  document.getElementById('mini-map-canvas').style.display = 'none';
  showScreen('screen-dead');
}

// ─────────────────────────────────────────────────────────────
//  MAIN GAME LOOP
// ─────────────────────────────────────────────────────────────
function loop() {
  if (PAUSED || !G) return;

  TICK++;
  G.windPhase += 0.018;

  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');
  const vw     = canvas.width;
  const vh     = canvas.height;

  // ── Updates ───────────────────────────────────────────────
  tickPowerUps();
  updateDayNight();
  updateWeather();
  movePlayer();
  collectItems(canvas);

  const night   = isNight();
  const frozen  = G.powerUps[T.PU_FREEZE] > 0;

  G.enemies.forEach(e => e.update(
    G.player.x + TILE / 2, G.player.y + TILE / 2,
    frozen, night
  ));

  checkEnemyCollision(canvas);
  updateComboDisplay();
  updateCamera(vw, vh);

  // Level Up?
  if (G.coinsLeft <= 0) { showLevelUp(G.level + 1); return; }

  // Status-Timer
  if (--statusTimer <= 0) {
    const el = document.getElementById('status-msg');
    if (el) el.textContent = `Level ${G.level} – Noch ${G.coinsLeft} Coins!`;
    statusTimer = 180;
  }

  // ── Rendering ─────────────────────────────────────────────
  ctx.fillStyle = COL.grass1;
  ctx.fillRect(0, 0, vw, vh);

  ctx.save();
  ctx.translate(-G.camX, -G.camY);

  // Map
  renderMap(ctx, G.camX, G.camY, vw, vh);

  // Partikel (vor Charakteren)
  spawnWeatherParticles(G.camX, G.camY, vw, vh);

  // Gegner
  G.enemies.forEach(e => drawEnemy(ctx, e, frozen, night, 1));

  // Spieler
  drawPlayer(
    ctx, G.player.x, G.player.y,
    G.invincible, G.player.animFrame,
    G.powerUps[T.PU_SHIELD] > 0,
    G.powerUps[T.PU_SPEED]  > 0
  );

  // Partikel
  updateAndDrawParticles(ctx, G.camX, G.camY);

  ctx.restore();

  // ── Vignette/Overlay-Effekte ──────────────────────────────
  // Wetter-Overlay für Nebel
  if (G.weather === WEATHER.FOG) {
    const grad = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.1, vw / 2, vh / 2, vh * 0.8);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(10,20,5,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vw, vh);
  }

  // Regen-Tint
  if (G.weather === WEATHER.RAIN || G.weather === WEATHER.STORM) {
    ctx.fillStyle = 'rgba(50,80,120,0.06)';
    ctx.fillRect(0, 0, vw, vh);
  }

  // Vignette
  const vig = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.25, vw / 2, vh / 2, vh * 0.85);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, vw, vh);

  // HUD alle 8 Ticks
  if (TICK % 8 === 0) updateHUD();

  // Mini-Map alle 6 Ticks
  if (TICK % 6 === 0) drawMiniMap();

  // Achievement-Check alle 120 Ticks
  if (TICK % 120 === 0) checkAchievements();

  RAF = requestAnimationFrame(loop);
}

// ─────────────────────────────────────────────────────────────
//  EINSTELLUNGS-BUTTONS
// ─────────────────────────────────────────────────────────────
function setupSettingGroup(id, key) {
  const wrap = document.getElementById(id);
  if (!wrap) return;
  // Verhindere dass Klick auf Kind-Elemente den Button verfehlt
  wrap.querySelectorAll('.s-btn *').forEach(child => {
    child.style.pointerEvents = 'none';
  });
  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.s-btn');
    if (!btn) return;
    wrap.querySelectorAll('.s-btn').forEach(b => {
      b.classList.remove('active');
      b.style.background = '';
      b.style.color = '';
      b.style.borderColor = '';
    });
    btn.classList.add('active');
    btn.style.background = 'var(--accent)';
    btn.style.color = '#060e03';
    btn.style.borderColor = 'var(--accent)';
    CFG[key] = parseFloat(btn.dataset.val);
  });
}

setupSettingGroup('set-world',   'worldSize');
setupSettingGroup('set-enemies', 'enemies');
setupSettingGroup('set-speed',   'speed');
setupSettingGroup('set-walls',   'walls');
setupSettingGroup('set-coins',   'coins');
setupSettingGroup('set-ai',      'ai');
setupSettingGroup('set-weather', 'weather');
setupSettingGroup('set-minimap', 'minimap');

function resetHighscores() {
  localStorage.removeItem('cf_hs_v2');
  renderHS();
}

// ─────────────────────────────────────────────────────────────
//  JOYSTICK – TOUCH
// ─────────────────────────────────────────────────────────────
const jZone  = document.getElementById('joystick-zone');
const jThumb = document.getElementById('joystick-thumb');
const jBase  = document.getElementById('joystick-base');
const MAX_R  = 28;

function setThumbPos(dx, dy) {
  const jc = document.getElementById('joystick-container');
  const cx = jc.offsetWidth / 2;
  const cy = jc.offsetHeight / 2;
  jThumb.style.left = (cx + dx) + 'px';
  jThumb.style.top  = (cy + dy) + 'px';
}

jZone.addEventListener('touchstart', e => {
  const t = e.touches[0];
  const rect = document.getElementById('joystick-container').getBoundingClientRect();
  JOY.ox = t.clientX - rect.left - rect.width / 2;
  JOY.oy = t.clientY - rect.top  - rect.height / 2;
  JOY.active = true;
  jThumb.classList.add('active');
  e.preventDefault();
}, { passive: false });

jZone.addEventListener('touchmove', e => {
  const t = e.touches[0];
  const rect = document.getElementById('joystick-container').getBoundingClientRect();
  let dx = t.clientX - rect.left - rect.width / 2;
  let dy = t.clientY - rect.top  - rect.height / 2;
  const mag = Math.hypot(dx, dy);
  if (mag > MAX_R) { dx = dx / mag * MAX_R; dy = dy / mag * MAX_R; }
  JOY.dx = dx / MAX_R;
  JOY.dy = dy / MAX_R;
  setThumbPos(dx, dy);
  e.preventDefault();
}, { passive: false });

jZone.addEventListener('touchend', () => {
  JOY.active = false; JOY.dx = 0; JOY.dy = 0;
  jThumb.classList.remove('active');
  setThumbPos(0, 0);
});

jZone.addEventListener('touchcancel', () => {
  JOY.active = false; JOY.dx = 0; JOY.dy = 0;
  jThumb.classList.remove('active');
  setThumbPos(0, 0);
});

// ─────────────────────────────────────────────────────────────
//  TASTATUR
// ─────────────────────────────────────────────────────────────
function updateJoyFromKeys() {
  const dx = ((KEYS['ArrowRight'] || KEYS['d'] || KEYS['D']) ? 1 : 0)
           - ((KEYS['ArrowLeft']  || KEYS['a'] || KEYS['A']) ? 1 : 0);
  const dy = ((KEYS['ArrowDown']  || KEYS['s'] || KEYS['S']) ? 1 : 0)
           - ((KEYS['ArrowUp']    || KEYS['w'] || KEYS['W']) ? 1 : 0);
  JOY.active = dx !== 0 || dy !== 0;
  JOY.dx = dx; JOY.dy = dy;
}

window.addEventListener('keydown', e => {
  KEYS[e.key] = true;
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause();
  updateJoyFromKeys();
});
window.addEventListener('keyup', e => {
  KEYS[e.key] = false;
  updateJoyFromKeys();
});

// ─────────────────────────────────────────────────────────────
//  WINDOW RESIZE
// ─────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  if (!G) return;
  const canvas = document.getElementById('gameCanvas');
  const vw = Math.min(window.innerWidth, 500);
  canvas.width  = vw;
  canvas.height = Math.max(120, window.innerHeight - 52 - 26 - 145);
});

// ─────────────────────────────────────────────────────────────
//  INITIALISIERUNG
// ─────────────────────────────────────────────────────────────
renderHS();

// Zufällige Sterne im Menü-Hintergrund generieren
(function generateStars() {
  const container = document.getElementById('menu-stars');
  if (!container) return;
  for (let i = 0; i < 60; i++) {
    const star = document.createElement('div');
    const size = Math.random() > 0.7 ? 'star-l' : Math.random() > 0.5 ? 'star-m' : 'star-s';
    star.className = `star ${size}`;
    star.style.left    = Math.random() * 100 + '%';
    star.style.top     = Math.random() * 100 + '%';
    star.style.opacity = 0.2 + Math.random() * 0.8;
    star.style.animation = `twinkle ${1.5 + Math.random() * 3}s ease-in-out infinite`;
    star.style.animationDelay = Math.random() * 3 + 's';
    container.appendChild(star);
  }
})();
