// ═══════════════════════════════════════════════════
//  COIN FOREST  –  game.js
//  Reine Spiellogik: Map, Physik, KI, Canvas-Rendering
// ═══════════════════════════════════════════════════

const TILE  = 40;
const COLS  = 30;
const ROWS  = 25;
const MAP_W = COLS * TILE;
const MAP_H = ROWS * TILE;

const EMPTY = 0, WALL = 1, COIN = 2, TREE = 3, BUSH = 4;

// ── Farben (nur für Canvas-Zeichnung) ───────────────
const C = {
  grass:      "#2d5a1b",
  grassAlt:   "#3a7224",
  wall:       "#5c4a2a",
  wallDark:   "#3d3020",
  treeDark:   "#1a3d0a",
  treeMid:    "#2a6a15",
  trunk:      "#6b4423",
  bush:       "#1e4d10",
  coin:       "#ffd700",
  coinShine:  "#fff9",
  player:     "#e8d5b7",
  ghost0:     "hsl(10,85%,55%)",
};

// ── State ────────────────────────────────────────────
let g = null;      // Spielzustand
let raf = null;
let tick = 0;
let pendingNextLevel = 1;

// ── Joystick ─────────────────────────────────────────
const joy = { active: false, dx: 0, dy: 0, ox: 0, oy: 0 };

// ─────────────────────────────────────────────────────
//  HILFSFUNKTIONEN
// ─────────────────────────────────────────────────────
function isBlocking(tile) { return tile === WALL || tile === TREE; }

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// ─────────────────────────────────────────────────────
//  MAP-GENERATOR
// ─────────────────────────────────────────────────────
function generateMap(level) {
  const map = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
  const rand = seededRand(level * 9301 + 49297);
  const used = new Set();

  // Rahmen
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (r === 0 || r === ROWS-1 || c === 0 || c === COLS-1)
        map[r][c] = WALL;

  // Spawn-Schutz
  for (let r = 1; r <= 2; r++)
    for (let c = 1; c <= 2; c++)
      used.add(`${r},${c}`);

  // Wände & Bäume
  const wallCount = 30 + level * 5;
  for (let i = 0; i < wallCount; i++) {
    const r = 2 + Math.floor(rand() * (ROWS - 4));
    const c = 2 + Math.floor(rand() * (COLS - 4));
    const key = `${r},${c}`;
    if (!used.has(key)) {
      map[r][c] = rand() > 0.4 ? TREE : WALL;
      used.add(key);
      if (rand() > 0.5) {
        const r2 = r + (rand() > .5 ? 1 : 0);
        const c2 = c + (rand() > .5 ? 0 : 1);
        const k2 = `${r2},${c2}`;
        if (r2 > 0 && r2 < ROWS-1 && c2 > 0 && c2 < COLS-1 && !used.has(k2)) {
          map[r2][c2] = WALL; used.add(k2);
        }
      }
    }
  }

  // Büsche
  for (let i = 0; i < 20; i++) {
    const r = 2 + Math.floor(rand() * (ROWS - 4));
    const c = 2 + Math.floor(rand() * (COLS - 4));
    if (map[r][c] === EMPTY) map[r][c] = BUSH;
  }

  // Coins
  const need = 15 + level * 3;
  let placed = 0, tries = 0;
  while (placed < need && tries++ < 3000) {
    const r = 1 + Math.floor(rand() * (ROWS - 2));
    const c = 1 + Math.floor(rand() * (COLS - 2));
    if (map[r][c] === EMPTY && !(r <= 2 && c <= 2)) {
      map[r][c] = COIN; placed++;
    }
  }

  return map;
}

// ─────────────────────────────────────────────────────
//  Q-LEARNING GEGNER
// ─────────────────────────────────────────────────────
class Enemy {
  constructor(x, y, level, idx) {
    this.x = x; this.y = y;
    this.px = x; this.py = y;
    this.Q = {};
    this.lr   = 0.15;
    this.gamma = 0.9;
    this.eps  = Math.max(0.05, 0.8 - level * 0.07);
    this.interval = Math.max(6, 18 - level * 1.2);
    this.timer = 0;
    this.lastS = null; this.lastA = null;
    this.hue   = (idx * 60 + 10) % 360;
  }

  q(s, a)      { return this.Q[`${s}:${a}`] || 0; }
  setQ(s, a, v){ this.Q[`${s}:${a}`] = v; }

  state(px, py) {
    const dx   = Math.sign(px - this.x);
    const dy   = Math.sign(py - this.y);
    const dist = Math.min(8, Math.floor(Math.hypot(px - this.x, py - this.y) / TILE));
    return `${dx},${dy},${dist}`;
  }

  act(s) {
    if (Math.random() < this.eps) return Math.floor(Math.random() * 4);
    let best = 0, bv = this.q(s, 0);
    for (let a = 1; a < 4; a++) { const v = this.q(s, a); if (v > bv) { bv = v; best = a; } }
    return best;
  }

  learn(ps, pa, r, ns) {
    const maxQ = Math.max(...[0,1,2,3].map(a => this.q(ns, a)));
    const old  = this.q(ps, pa);
    this.setQ(ps, pa, old + this.lr * (r + this.gamma * maxQ - old));
  }

  update(map, px, py) {
    if (++this.timer < this.interval) return;
    this.timer = 0;

    const DIRS = [[0,-1],[0,1],[-1,0],[1,0]];
    const s  = this.state(px, py);
    const a  = this.act(s);
    const [dc, dr] = DIRS[a];
    const nx = this.x + dc * TILE;
    const ny = this.y + dr * TILE;
    const nc = Math.floor(nx / TILE);
    const nr = Math.floor(ny / TILE);

    let r = -0.1;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !isBlocking(map[nr][nc])) {
      this.px = this.x; this.py = this.y;
      this.x  = nx;     this.y  = ny;
      const newD = Math.hypot(px - nx, py - ny);
      const oldD = Math.hypot(px - this.px, py - this.py);
      r = oldD - newD > 0 ? 1 : -0.5;
    } else {
      r = -1;
    }

    if (this.lastS !== null) this.learn(this.lastS, this.lastA, r, s);
    this.lastS = s; this.lastA = a;
  }
}

// ─────────────────────────────────────────────────────
//  CANVAS ZEICHENFUNKTIONEN
// ─────────────────────────────────────────────────────
function drawTile(ctx, r, c, tile) {
  const tx = c * TILE, ty = r * TILE;

  // Boden-Schachbrett
  ctx.fillStyle = (r + c) % 2 === 0 ? C.grassAlt : C.grass;
  ctx.fillRect(tx, ty, TILE, TILE);

  if (tile === WALL) {
    ctx.fillStyle = C.wall;
    ctx.fillRect(tx, ty, TILE, TILE);
    ctx.fillStyle = C.wallDark;
    ctx.fillRect(tx, ty, TILE, 4);
    ctx.fillRect(tx, ty, 4, TILE);

  } else if (tile === TREE) {
    ctx.fillStyle = C.trunk;
    ctx.fillRect(tx + TILE*.4, ty + TILE*.5, TILE*.2, TILE*.5);
    ctx.fillStyle = C.treeDark;
    ctx.beginPath();
    ctx.arc(tx + TILE/2, ty + TILE*.35, TILE*.38, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = C.treeMid;
    ctx.beginPath();
    ctx.arc(tx + TILE*.35, ty + TILE*.4, TILE*.22, 0, Math.PI*2);
    ctx.fill();

  } else if (tile === BUSH) {
    ctx.fillStyle = C.bush;
    [[.5,.6,.35],[.35,.65,.25],[.65,.65,.25]].forEach(([bx,by,br]) => {
      ctx.beginPath();
      ctx.arc(tx + TILE*bx, ty + TILE*by, TILE*br, 0, Math.PI*2);
      ctx.fill();
    });

  } else if (tile === COIN) {
    const pulse = 0.85 + 0.15 * Math.sin(tick * 0.1 + r*7 + c*13);
    const cx = tx + TILE/2, cy = ty + TILE/2;
    const rad = TILE * 0.3 * pulse;
    ctx.shadowColor = "#ffec6e"; ctx.shadowBlur = 8;
    ctx.fillStyle = C.coin;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.coinShine;
    ctx.beginPath(); ctx.arc(cx - rad*.2, cy - rad*.2, rad*.35, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawPlayer(ctx, x, y, inv) {
  if (inv > 0 && tick % 10 < 5) return;
  const p = TILE / 8;
  ctx.shadowColor = "#ffe08a"; ctx.shadowBlur = 8;
  ctx.fillStyle = C.player;
  // Kopf
  ctx.fillRect(x + p*3, y,       p*2, p*2);
  // Körper
  ctx.fillRect(x + p*2, y + p*2, p*4, p*3);
  // Arme
  ctx.fillRect(x + p,   y + p*2, p,   p*2);
  ctx.fillRect(x + p*6, y + p*2, p,   p*2);
  // Beine
  ctx.fillRect(x + p*2,   y + p*5, p*1.5, p*3);
  ctx.fillRect(x + p*4.5, y + p*5, p*1.5, p*3);
  ctx.shadowBlur = 0;
}

function drawEnemy(ctx, e) {
  const p = TILE / 8;
  ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 10;
  ctx.fillStyle = `hsl(${e.hue},85%,55%)`;
  // Körper
  ctx.fillRect(e.x + p*2, e.y,       p*4, p*4);
  ctx.fillRect(e.x + p,   e.y + p*2, p*6, p*4);
  ctx.fillRect(e.x + p,   e.y + p*6, p,   p*2);
  ctx.fillRect(e.x + p*3, e.y + p*6, p,   p*2);
  ctx.fillRect(e.x + p*5, e.y + p*6, p,   p*2);
  // Augen (weiß)
  ctx.fillStyle = "#fff";
  ctx.fillRect(e.x + p*2,   e.y + p*2, p*1.5, p*1.5);
  ctx.fillRect(e.x + p*4.5, e.y + p*2, p*1.5, p*1.5);
  // Pupillen
  ctx.fillStyle = "#000";
  ctx.fillRect(e.x + p*2.5, e.y + p*2.5, p, p);
  ctx.fillRect(e.x + p*5,   e.y + p*2.5, p, p);
  ctx.shadowBlur = 0;
}

// ─────────────────────────────────────────────────────
//  HUD updaten (DOM)
// ─────────────────────────────────────────────────────
function updateHUD() {
  const { level, score, lives, coinsLeft, totalCoins } = g;
  const iq = Math.min(100, level * 8);

  document.getElementById("hud-level").textContent = level;
  document.getElementById("hud-score").textContent = score;
  document.getElementById("hud-coins").textContent = `${totalCoins - coinsLeft}/${totalCoins}`;
  document.getElementById("hud-lives").textContent = "❤️".repeat(Math.max(0, lives));
  document.getElementById("hud-iq").textContent    = iq;

  const bar = document.getElementById("iq-bar");
  bar.style.width = iq + "%";
  bar.style.background = `hsl(${120 - iq*1.2},80%,55%)`;
}

// ─────────────────────────────────────────────────────
//  SCREEN-MANAGEMENT
// ─────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ─────────────────────────────────────────────────────
//  SPIEL INITIALISIEREN
// ─────────────────────────────────────────────────────
function startGame(level) {
  cancelAnimationFrame(raf);
  tick = 0;

  const map  = generateMap(level);
  const total = map.flat().filter(t => t === COIN).length;
  const eCount = Math.min(1 + Math.floor(level * 0.7), 6);
  const enemies = [];
  const used = new Set(["1,1","1,2","2,1","2,2"]);

  for (let i = 0; i < eCount; i++) {
    let er, ec, tries = 0;
    do {
      er = 2 + Math.floor(Math.random() * (ROWS - 4));
      ec = 2 + Math.floor(Math.random() * (COLS - 4));
      tries++;
    } while ((map[er]?.[ec] !== EMPTY || used.has(`${er},${ec}`) || (er < 5 && ec < 5)) && tries < 500);
    used.add(`${er},${ec}`);
    enemies.push(new Enemy(ec * TILE, er * TILE, level, i));
  }

  g = {
    map, level, score: 0, lives: 3,
    coinsLeft: total, totalCoins: total,
    invincible: 0, camX: 0, camY: 0,
    player: { x: TILE, y: TILE },
    enemies,
  };

  const canvas = document.getElementById("gameCanvas");
  const vw = Math.min(window.innerWidth, 420);
  canvas.width  = vw;
  canvas.height = Math.min(window.innerHeight - 240, 360);

  updateHUD();
  showScreen("screen-game");
  loop();
}

function nextLevel() {
  startGame(pendingNextLevel);
}

// ─────────────────────────────────────────────────────
//  GAME LOOP
// ─────────────────────────────────────────────────────
function loop() {
  tick++;
  const canvas = document.getElementById("gameCanvas");
  const ctx    = canvas.getContext("2d");
  const vw = canvas.width, vh = canvas.height;

  // ── Spielerbewegung ───────────────────────────────
  const spd = 2.5;
  if (joy.active && (Math.abs(joy.dx) > 0.05 || Math.abs(joy.dy) > 0.05)) {
    const mag = Math.hypot(joy.dx, joy.dy) || 1;
    const nx  = g.player.x + (joy.dx / mag) * spd;
    const ny  = g.player.y + (joy.dy / mag) * spd;

    const cols = [
      Math.floor((nx + TILE*.15) / TILE),
      Math.floor((nx + TILE*.85) / TILE),
    ];
    const rows = [
      Math.floor((ny + TILE*.15) / TILE),
      Math.floor((ny + TILE*.85) / TILE),
    ];

    const clearX = cols.every(c => rows.every(r => !isBlocking(g.map[r]?.[c])));
    const clearY = cols.every(c => rows.every(r => !isBlocking(g.map[r]?.[c])));

    // X-Achse
    const nx2 = g.player.x + (joy.dx / mag) * spd;
    const colsX = [Math.floor((nx2+TILE*.15)/TILE), Math.floor((nx2+TILE*.85)/TILE)];
    if (colsX.every(c => [Math.floor((g.player.y+TILE*.15)/TILE), Math.floor((g.player.y+TILE*.85)/TILE)].every(r => !isBlocking(g.map[r]?.[c]))))
      g.player.x = Math.max(0, Math.min(MAP_W - TILE, nx2));

    // Y-Achse
    const ny2 = g.player.y + (joy.dy / mag) * spd;
    const rowsY = [Math.floor((ny2+TILE*.15)/TILE), Math.floor((ny2+TILE*.85)/TILE)];
    if (rowsY.every(r => [Math.floor((g.player.x+TILE*.15)/TILE), Math.floor((g.player.x+TILE*.85)/TILE)].every(c => !isBlocking(g.map[r]?.[c]))))
      g.player.y = Math.max(0, Math.min(MAP_H - TILE, ny2));
  }

  // ── Coin einsammeln ───────────────────────────────
  const pc = Math.floor((g.player.x + TILE/2) / TILE);
  const pr = Math.floor((g.player.y + TILE/2) / TILE);
  if (g.map[pr]?.[pc] === COIN) {
    g.map[pr][pc] = EMPTY;
    g.coinsLeft--;
    g.score += 10 * g.level;
    updateHUD();
  }

  // ── Gegner updaten ────────────────────────────────
  g.enemies.forEach(e => e.update(g.map, g.player.x + TILE/2, g.player.y + TILE/2));

  // ── Kollision ─────────────────────────────────────
  if (g.invincible <= 0) {
    for (const e of g.enemies) {
      if (Math.hypot(e.x - g.player.x, e.y - g.player.y) < TILE * 0.7) {
        g.lives--;
        g.invincible = 120;
        updateHUD();
        if (g.lives <= 0) { showDead(); return; }
        break;
      }
    }
  } else {
    g.invincible--;
  }

  // ── Level Up ──────────────────────────────────────
  if (g.coinsLeft <= 0) {
    pendingNextLevel = g.level + 1;
    showLevelUp(pendingNextLevel);
    return;
  }

  // ── Kamera ────────────────────────────────────────
  g.camX = Math.max(0, Math.min(MAP_W - vw, g.player.x + TILE/2 - vw/2));
  g.camY = Math.max(0, Math.min(MAP_H - vh, g.player.y + TILE/2 - vh/2));

  // ── Zeichnen ──────────────────────────────────────
  ctx.fillStyle = C.grass;
  ctx.fillRect(0, 0, vw, vh);

  ctx.save();
  ctx.translate(-g.camX, -g.camY);

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawTile(ctx, r, c, g.map[r][c]);

  g.enemies.forEach(e => drawEnemy(ctx, e));
  drawPlayer(ctx, g.player.x, g.player.y, g.invincible);

  ctx.restore();

  raf = requestAnimationFrame(loop);
}

// ─────────────────────────────────────────────────────
//  SCREENS
// ─────────────────────────────────────────────────────
function showDead() {
  cancelAnimationFrame(raf);
  document.getElementById("dead-level").textContent = g.level;
  document.getElementById("dead-score").textContent = g.score;
  document.getElementById("dead-coins").textContent = g.totalCoins - g.coinsLeft;
  showScreen("screen-dead");
}

function showLevelUp(next) {
  cancelAnimationFrame(raf);
  const iq = Math.min(100, next * 8);
  document.getElementById("levelup-warn").textContent = `🧠 KI-IQ steigt auf ${iq}`;
  document.getElementById("levelup-info").innerHTML =
    `Weiter zu Level ${next}<br>Mehr Gegner • Neue Map • Mehr Coins`;
  showScreen("screen-levelup");
}

// ─────────────────────────────────────────────────────
//  JOYSTICK – Touch
// ─────────────────────────────────────────────────────
const zone  = document.getElementById("joystick-zone");
const thumb = document.getElementById("joystick-thumb");
const base  = document.getElementById("joystick-base");
const MAX_R = 28;

zone.addEventListener("touchstart", e => {
  const t = e.touches[0];
  const rect = zone.getBoundingClientRect();
  joy.ox = t.clientX - rect.left;
  joy.oy = t.clientY - rect.top;
  base.style.left  = joy.ox + "px";
  base.style.top   = joy.oy + "px";
  thumb.style.left = joy.ox + "px";
  thumb.style.top  = joy.oy + "px";
  joy.active = true;
  e.preventDefault();
}, { passive: false });

zone.addEventListener("touchmove", e => {
  const t = e.touches[0];
  const rect = zone.getBoundingClientRect();
  let dx = t.clientX - rect.left - joy.ox;
  let dy = t.clientY - rect.top  - joy.oy;
  const mag = Math.hypot(dx, dy);
  if (mag > MAX_R) { dx = dx/mag*MAX_R; dy = dy/mag*MAX_R; }
  thumb.style.left = (joy.ox + dx) + "px";
  thumb.style.top  = (joy.oy + dy) + "px";
  joy.dx = dx / MAX_R;
  joy.dy = dy / MAX_R;
  e.preventDefault();
}, { passive: false });

zone.addEventListener("touchend", () => {
  joy.active = false; joy.dx = 0; joy.dy = 0;
  // Thumb zurück zur Mitte
  const rect = zone.getBoundingClientRect();
  const cx = rect.width / 2, cy = rect.height / 2;
  base.style.left  = cx + "px"; base.style.top  = cy + "px";
  thumb.style.left = cx + "px"; thumb.style.top = cy + "px";
});

// ─────────────────────────────────────────────────────
//  TASTATUR
// ─────────────────────────────────────────────────────
const keys = {};
window.addEventListener("keydown", e => {
  keys[e.key] = true;
  const dx = (keys["ArrowRight"]||keys["d"] ? 1:0) - (keys["ArrowLeft"]||keys["a"] ? 1:0);
  const dy = (keys["ArrowDown"] ||keys["s"] ? 1:0) - (keys["ArrowUp"]  ||keys["w"] ? 1:0);
  joy.active = dx !== 0 || dy !== 0;
  joy.dx = dx; joy.dy = dy;
});
window.addEventListener("keyup", e => {
  keys[e.key] = false;
  const dx = (keys["ArrowRight"]||keys["d"] ? 1:0) - (keys["ArrowLeft"]||keys["a"] ? 1:0);
  const dy = (keys["ArrowDown"] ||keys["s"] ? 1:0) - (keys["ArrowUp"]  ||keys["w"] ? 1:0);
  joy.active = dx !== 0 || dy !== 0;
  joy.dx = dx; joy.dy = dy;
});
