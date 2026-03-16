// ═══════════════════════════════════════════════════════
//  COIN FOREST  –  game.js  v2.0
//  Features: Power-Ups, Highscore, Alarm-System,
//            Sackgassen-KI, Animationen, Tag/Nacht,
//            Wetter, Partikel, Einstellungen
// ═══════════════════════════════════════════════════════

// ── Tile-Typen ───────────────────────────────────────
const EMPTY = 0, WALL = 1, COIN = 2, TREE = 3, BUSH = 4;
const PU_SPEED = 5, PU_SHIELD = 6, PU_FREEZE = 7, PU_MAGNET = 8;

// ── Farben ───────────────────────────────────────────
const C = {
  grass: "#2d5a1b", grassAlt: "#3a7224",
  wall: "#5c4a2a",  wallDark: "#3d3020",
  treeDark: "#1a3d0a", treeMid: "#2a6a15", trunk: "#6b4423",
  bush: "#1e4d10",
  coin: "#ffd700",  coinShine: "#fff9",
  player: "#e8d5b7",
  nightTint: "rgba(0,0,40,",
};

const PU_INFO = {
  [PU_SPEED]:  { icon: "⚡", color: "#facc15", label: "SPEED",   duration: 300 },
  [PU_SHIELD]: { icon: "🛡️", color: "#60a5fa", label: "SHIELD",  duration: 300 },
  [PU_FREEZE]: { icon: "❄️", color: "#22d3ee", label: "FREEZE",  duration: 240 },
  [PU_MAGNET]: { icon: "🧲", color: "#c084fc", label: "MAGNET",  duration: 360 },
};

// ── Globaler State ───────────────────────────────────
let g = null;
let raf = null;
let tick = 0;
let pendingNextLevel = 1;

// ── Einstellungen ────────────────────────────────────
const settings = { worldSize: 64, enemies: 2, speed: 1, walls: 1, coins: 1 };

// ── Joystick ─────────────────────────────────────────
const joy = { active: false, dx: 0, dy: 0, ox: 0, oy: 0 };

// ── Partikel ─────────────────────────────────────────
let particles = [];

function spawnParticles(x, y, type) {
  if (type === "coin") {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i;
      particles.push({ x, y, vx: Math.cos(a)*2, vy: Math.sin(a)*2 - 1, life: 30, maxLife: 30, color: "#ffd700", r: 3, type: "spark" });
    }
  } else if (type === "leaf") {
    particles.push({ x, y, vx: (Math.random()-.5)*1.5, vy: -Math.random()*1.5, life: 60, maxLife: 60, color: `hsl(${100+Math.random()*40},60%,35%)`, r: 2.5, type: "leaf", rot: Math.random()*Math.PI*2 });
  } else if (type === "rain") {
    particles.push({ x, y, vx: 0.5, vy: 6+Math.random()*3, life: 20, maxLife: 20, color: "#60a5fa99", r: 1, type: "rain" });
  } else if (type === "fog") {
    particles.push({ x, y, vx: (Math.random()-.5)*0.3, vy: -0.1, life: 180, maxLife: 180, color: "#ffffff", r: 18+Math.random()*14, type: "fog" });
  }
}

function updateParticles(ctx, camX, camY) {
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy; p.life--;
    if (p.type === "leaf") { p.vy += 0.04; p.rot += 0.1; }
    if (p.type === "rain") { p.vy += 0.1; }

    const alpha = p.life / p.maxLife;
    const sx = p.x - camX, sy = p.y - camY;

    ctx.save();
    ctx.globalAlpha = alpha * (p.type === "fog" ? 0.12 : 0.9);
    ctx.fillStyle = p.color;

    if (p.type === "leaf") {
      ctx.translate(sx, sy);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.r, -p.r/2, p.r*2, p.r);
    } else if (p.type === "rain") {
      ctx.fillRect(sx, sy, 1.5, 6);
    } else if (p.type === "fog") {
      ctx.beginPath();
      ctx.arc(sx, sy, p.r, 0, Math.PI*2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(sx, sy, p.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
}

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
  const SIZE = settings.worldSize;
  const map = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  const rand = seededRand(level * 9301 + 49297);
  const used = new Set();

  // Rahmen
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (r === 0 || r === SIZE-1 || c === 0 || c === SIZE-1)
        map[r][c] = WALL;

  // Spawn-Schutz
  for (let r = 1; r <= 3; r++)
    for (let c = 1; c <= 3; c++)
      used.add(`${r},${c}`);

  // Wände & Bäume
  const wallCount = Math.floor((20 + level * 4) * settings.walls * (SIZE / 32));
  for (let i = 0; i < wallCount; i++) {
    const r = 2 + Math.floor(rand() * (SIZE - 4));
    const c = 2 + Math.floor(rand() * (SIZE - 4));
    const key = `${r},${c}`;
    if (!used.has(key)) {
      map[r][c] = rand() > 0.4 ? TREE : WALL;
      used.add(key);
      if (rand() > 0.5) {
        const r2 = r + (rand() > .5 ? 1 : 0);
        const c2 = c + (rand() > .5 ? 0 : 1);
        const k2 = `${r2},${c2}`;
        if (r2 > 0 && r2 < SIZE-1 && c2 > 0 && c2 < SIZE-1 && !used.has(k2)) {
          map[r2][c2] = WALL; used.add(k2);
        }
      }
    }
  }

  // Büsche
  for (let i = 0; i < Math.floor(15 * (SIZE/32)); i++) {
    const r = 2 + Math.floor(rand() * (SIZE - 4));
    const c = 2 + Math.floor(rand() * (SIZE - 4));
    if (map[r][c] === EMPTY) map[r][c] = BUSH;
  }

  // Coins
  const need = Math.floor((12 + level * 3) * settings.coins * (SIZE / 32));
  let placed = 0, tries = 0;
  while (placed < need && tries++ < 5000) {
    const r = 1 + Math.floor(rand() * (SIZE - 2));
    const c = 1 + Math.floor(rand() * (SIZE - 2));
    if (map[r][c] === EMPTY && !(r <= 3 && c <= 3)) {
      map[r][c] = COIN; placed++;
    }
  }

  // Power-Ups
  const puTypes = [PU_SPEED, PU_SHIELD, PU_FREEZE, PU_MAGNET];
  for (let i = 0; i < 4 + Math.floor(level/2); i++) {
    let pt = 0, trs = 0;
    do {
      pt = 1 + Math.floor(rand() * (SIZE - 2));
    } while (map[pt]?.[Math.floor(rand() * (SIZE-2)) + 1] !== EMPTY && trs++ < 200);
    const pc = 1 + Math.floor(rand() * (SIZE - 2));
    const pr = 1 + Math.floor(rand() * (SIZE - 2));
    if (map[pr]?.[pc] === EMPTY && !(pr <= 3 && pc <= 3)) {
      map[pr][pc] = puTypes[i % 4];
    }
  }

  return map;
}

// ─────────────────────────────────────────────────────
//  Q-LEARNING GEGNER mit Erkennungsradius + Alarm
// ─────────────────────────────────────────────────────
const MODE_PATROL = "patrol";
const MODE_CHASE  = "chase";
const MODE_LINGER = "linger";
const MODE_ALERT  = "alert";   // alarmiert durch anderen Gegner

const TILE = 40;
const DETECT_RADIUS = 5 * TILE;
const LINGER_RADIUS = 9 * TILE;
const LINGER_TICKS  = 90;

class Enemy {
  constructor(x, y, level, idx) {
    this.x = x; this.y = y;
    this.Q = {};
    this.lr = 0.15; this.gamma = 0.9;
    this.eps = Math.max(0.05, 0.8 - level * 0.07);
    this.interval = Math.max(5, Math.floor((18 - level * 1.2) / settings.speed));
    this.timer = 0;
    this.lastS = null; this.lastA = null;
    this.hue = (idx * 60 + 10) % 360;
    this.mode = MODE_PATROL;
    this.lingerTimer = 0;
    this.alertDelay = 0;   // Verzögerung bevor Alarmierung wirkt
    this.patrolDir = Math.floor(Math.random() * 4);
    this.patrolWait = 0;
    this.stuckCount = 0;   // Sackgassen-Erkennung
    this.lastPos = { x, y };
    // Animationsframe
    this.animFrame = 0;
    this.animTimer = 0;
  }

  q(s, a)       { return this.Q[`${s}:${a}`] || 0; }
  setQ(s, a, v) { this.Q[`${s}:${a}`] = v; }

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

  learn(ps, pa, reward, ns) {
    const maxQ = Math.max(...[0,1,2,3].map(a => this.q(ns, a)));
    const old  = this.q(ps, pa);
    this.setQ(ps, pa, old + this.lr * (reward + this.gamma * maxQ - old));
  }

  tryMove(map, dirIdx) {
    const DIRS = [[0,-1],[0,1],[-1,0],[1,0]];
    const [dc, dr] = DIRS[dirIdx];
    const nx = this.x + dc * TILE;
    const ny = this.y + dr * TILE;
    const SIZE = settings.worldSize;
    const nc = Math.floor(nx / TILE);
    const nr = Math.floor(ny / TILE);
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !isBlocking(map[nr][nc])) {
      this.x = nx; this.y = ny;
      return true;
    }
    return false;
  }

  // Sackgassen-Erkennung: wenn Gegner sich kaum bewegt → neue Richtung
  checkStuck() {
    const moved = Math.hypot(this.x - this.lastPos.x, this.y - this.lastPos.y);
    if (moved < TILE * 0.5) {
      this.stuckCount++;
    } else {
      this.stuckCount = 0;
    }
    this.lastPos = { x: this.x, y: this.y };
    // Bei 3x festgesteckt → zufällige Ausweichrichtung
    if (this.stuckCount >= 3) {
      this.stuckCount = 0;
      return Math.floor(Math.random() * 4);
    }
    return null;
  }

  // Von außen alarmieren (mit Verzögerung in Ticks)
  alarm(delay) {
    if (this.mode === MODE_PATROL) {
      this.alertDelay = delay;
      this.mode = MODE_ALERT;
    }
  }

  update(map, px, py, frozen) {
    if (frozen) return;
    if (++this.timer < this.interval) return;
    this.timer = 0;

    // Animations-Update
    if (++this.animTimer > 6) { this.animFrame = (this.animFrame + 1) % 4; this.animTimer = 0; }

    const dist = Math.hypot(px - this.x, py - this.y);

    // ── Modus bestimmen ─────────────────────────────
    if (dist <= DETECT_RADIUS) {
      this.mode = MODE_CHASE;
      this.lingerTimer = LINGER_TICKS;
    } else if (this.mode === MODE_CHASE) {
      this.mode = MODE_LINGER;
      this.lingerTimer = LINGER_TICKS;
    } else if (this.mode === MODE_LINGER) {
      this.lingerTimer--;
      if (this.lingerTimer <= 0 || dist > LINGER_RADIUS) this.mode = MODE_PATROL;
    } else if (this.mode === MODE_ALERT) {
      if (this.alertDelay > 0) { this.alertDelay--; return; }
      this.mode = MODE_CHASE;
      this.lingerTimer = LINGER_TICKS * 2;
    }

    // ── Sackgassen-Check ────────────────────────────
    const escapeDir = this.checkStuck();

    // ── Verhalten ───────────────────────────────────
    if (this.mode === MODE_CHASE || this.mode === MODE_LINGER) {
      const s = this.state(px, py);
      const a = escapeDir !== null ? escapeDir : this.act(s);
      const oldDist = Math.hypot(px - this.x, py - this.y);
      const moved = this.tryMove(map, a);
      const newDist = Math.hypot(px - this.x, py - this.y);
      const reward = moved ? (oldDist - newDist > 0 ? 1 : -0.5) : -1;
      if (this.lastS !== null) this.learn(this.lastS, this.lastA, reward, s);
      this.lastS = s; this.lastA = a;

    } else {
      // Patrouille
      if (this.patrolWait > 0) { this.patrolWait--; return; }
      const dir = escapeDir !== null ? escapeDir : this.patrolDir;
      const moved = this.tryMove(map, dir);
      if (!moved) {
        this.patrolDir = Math.floor(Math.random() * 4);
        this.patrolWait = 3 + Math.floor(Math.random() * 5);
      } else if (Math.random() < 0.12) {
        this.patrolDir = Math.floor(Math.random() * 4);
      }
    }
  }
}

// ─────────────────────────────────────────────────────
//  ALARM-SYSTEM: Gegner alarmieren sich gegenseitig
// ─────────────────────────────────────────────────────
function triggerAlarm(spotter, enemies) {
  enemies.forEach(e => {
    if (e === spotter) return;
    const dist = Math.hypot(e.x - spotter.x, e.y - spotter.y);
    // Je weiter weg, desto länger die Verzögerung
    const delay = Math.floor(dist / TILE * 3);  // ~3 Ticks pro Block
    if (delay < 200) e.alarm(delay);
  });
}

let lastAlarmTick = -999;

// ─────────────────────────────────────────────────────
//  CANVAS ZEICHENFUNKTIONEN
// ─────────────────────────────────────────────────────
function drawTile(ctx, r, c, tile, windPhase) {
  const SIZE = settings.worldSize;
  const tx = c * TILE, ty = r * TILE;

  ctx.fillStyle = (r + c) % 2 === 0 ? C.grassAlt : C.grass;
  ctx.fillRect(tx, ty, TILE, TILE);

  if (tile === WALL) {
    ctx.fillStyle = C.wall;
    ctx.fillRect(tx, ty, TILE, TILE);
    ctx.fillStyle = C.wallDark;
    ctx.fillRect(tx, ty, TILE, 4);
    ctx.fillRect(tx, ty, 4, TILE);

  } else if (tile === TREE) {
    // Wind-Wackeln
    const sway = Math.sin(windPhase + c * 0.7 + r * 0.5) * 2;
    ctx.fillStyle = C.trunk;
    ctx.fillRect(tx + TILE*.4, ty + TILE*.5, TILE*.2, TILE*.5);
    ctx.save();
    ctx.translate(tx + TILE/2 + sway, ty + TILE*.5);
    ctx.fillStyle = C.treeDark;
    ctx.beginPath(); ctx.arc(0, -TILE*.15, TILE*.38, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.treeMid;
    ctx.beginPath(); ctx.arc(-TILE*.15, -TILE*.1, TILE*.22, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Gelegentlich Blatt-Partikel
    if (Math.random() < 0.003) spawnParticles(tx + TILE/2, ty + TILE*.3, "leaf");

  } else if (tile === BUSH) {
    ctx.fillStyle = C.bush;
    [[.5,.6,.35],[.35,.65,.25],[.65,.65,.25]].forEach(([bx,by,br]) => {
      ctx.beginPath(); ctx.arc(tx+TILE*bx, ty+TILE*by, TILE*br, 0, Math.PI*2); ctx.fill();
    });

  } else if (tile === COIN) {
    const pulse = 0.85 + 0.15 * Math.sin(tick * 0.1 + r*7 + c*13);
    const cx = tx+TILE/2, cy = ty+TILE/2, rad = TILE*0.3*pulse;
    ctx.shadowColor = "#ffec6e"; ctx.shadowBlur = 8;
    ctx.fillStyle = C.coin;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.coinShine;
    ctx.beginPath(); ctx.arc(cx-rad*.2, cy-rad*.2, rad*.35, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

  } else if (tile >= PU_SPEED && tile <= PU_MAGNET) {
    const info = PU_INFO[tile];
    const pulse = 0.8 + 0.2 * Math.sin(tick * 0.15 + c + r);
    ctx.shadowColor = info.color; ctx.shadowBlur = 10;
    ctx.fillStyle = info.color + "44";
    ctx.beginPath(); ctx.arc(tx+TILE/2, ty+TILE/2, TILE*0.42*pulse, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = `${TILE*0.45}px serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(info.icon, tx+TILE/2, ty+TILE/2);
  }
}

// Animierter Spieler (laufende Beine)
function drawPlayer(ctx, x, y, inv, animFrame, shield) {
  if (inv > 0 && tick % 10 < 5) return;
  const p = TILE / 8;
  if (shield) { ctx.shadowColor = "#60a5fa"; ctx.shadowBlur = 14; }
  else        { ctx.shadowColor = "#ffe08a"; ctx.shadowBlur = 8; }
  ctx.fillStyle = C.player;
  // Kopf
  ctx.fillRect(x + p*3, y, p*2, p*2);
  // Körper
  ctx.fillRect(x + p*2, y + p*2, p*4, p*3);
  // Arme (wackeln)
  const armSwing = Math.sin(animFrame * Math.PI / 2) * p;
  ctx.fillRect(x + p,   y + p*2 + armSwing, p, p*2);
  ctx.fillRect(x + p*6, y + p*2 - armSwing, p, p*2);
  // Beine (laufend)
  const leg1 = Math.sin(animFrame * Math.PI / 2) * p * 1.2;
  const leg2 = -leg1;
  ctx.fillRect(x + p*2,   y + p*5 + leg1, p*1.5, p*3);
  ctx.fillRect(x + p*4.5, y + p*5 + leg2, p*1.5, p*3);
  if (shield) {
    ctx.strokeStyle = "#60a5fa88"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x+TILE/2, y+TILE/2, TILE*0.55, 0, Math.PI*2); ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawEnemy(ctx, e, frozen) {
  const p = TILE / 8;
  const color = frozen ? "#22d3ee" : `hsl(${e.hue},85%,55%)`;
  if (e.mode === MODE_CHASE || e.mode === MODE_ALERT) {
    ctx.shadowColor = frozen ? "#22d3ee" : "#ff0000"; ctx.shadowBlur = 12;
  } else {
    ctx.shadowBlur = 4; ctx.shadowColor = color;
  }
  ctx.fillStyle = color;
  // Animierter Geister-Körper
  const bob = Math.sin(tick * 0.15 + e.hue) * 2;
  ctx.fillRect(e.x + p*2, e.y + bob,       p*4, p*4);
  ctx.fillRect(e.x + p,   e.y + p*2 + bob, p*6, p*4);
  ctx.fillRect(e.x + p,   e.y + p*6 + bob, p,   p*2);
  ctx.fillRect(e.x + p*3, e.y + p*6 + bob, p,   p*2);
  ctx.fillRect(e.x + p*5, e.y + p*6 + bob, p,   p*2);
  ctx.fillStyle = "#fff";
  ctx.fillRect(e.x + p*2,   e.y + p*2 + bob, p*1.5, p*1.5);
  ctx.fillRect(e.x + p*4.5, e.y + p*2 + bob, p*1.5, p*1.5);
  ctx.fillStyle = "#000";
  ctx.fillRect(e.x + p*2.5, e.y + p*2.5 + bob, p, p);
  ctx.fillRect(e.x + p*5,   e.y + p*2.5 + bob, p, p);

  // Ausrufezeichen wenn alarmiert
  if (e.mode === MODE_ALERT || (e.mode === MODE_CHASE && tick % 60 < 10)) {
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#ffd700";
    ctx.fillText("!", e.x + TILE/2, e.y - 4);
  }
  ctx.shadowBlur = 0;
}

// ─────────────────────────────────────────────────────
//  HUD & Power-Up Anzeige
// ─────────────────────────────────────────────────────
function updateHUD() {
  const { level, score, lives, coinsLeft, totalCoins, powerUps } = g;
  const iq = Math.min(100, level * 8);
  const dayPhase = (tick % 1800) / 1800;
  const isNight = dayPhase > 0.5;
  const dayLabel = isNight ? "🌙 NACHT" : "☀️ TAG";

  document.getElementById("hud-level").textContent  = level;
  document.getElementById("hud-score").textContent  = score;
  document.getElementById("hud-coins").textContent  = `${totalCoins - coinsLeft}/${totalCoins}`;
  document.getElementById("hud-lives").textContent  = "❤️".repeat(Math.max(0, lives));
  document.getElementById("hud-iq").textContent     = iq;
  document.getElementById("hud-daytime").textContent = dayLabel;
  const bar = document.getElementById("iq-bar");
  bar.style.width = iq + "%";
  bar.style.background = `hsl(${120 - iq*1.2},80%,55%)`;

  // Power-Up Badges
  const puHud = document.getElementById("powerup-hud");
  puHud.innerHTML = "";
  for (const [type, remaining] of Object.entries(powerUps)) {
    if (remaining > 0) {
      const info = PU_INFO[type];
      const secs = Math.ceil(remaining / 60);
      const badge = document.createElement("div");
      badge.className = "pu-badge";
      badge.style.borderColor = info.color;
      badge.innerHTML = `${info.icon} <span class="pu-timer">${secs}s</span>`;
      puHud.appendChild(badge);
    }
  }

  // Tag/Nacht Overlay
  const nightAlpha = isNight ? Math.min(0.55, (dayPhase - 0.5) * 2 * 0.55) : Math.max(0, (0.5 - dayPhase) * 2 * 0.55);
  document.getElementById("night-overlay").style.background = `rgba(0,0,40,${nightAlpha})`;
}

// ─────────────────────────────────────────────────────
//  SCREEN MANAGEMENT
// ─────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ─────────────────────────────────────────────────────
//  HIGHSCORE
// ─────────────────────────────────────────────────────
function loadHS() {
  try { return JSON.parse(localStorage.getItem("cf_hs")) || []; } catch { return []; }
}
function saveHS(name, score) {
  let hs = loadHS();
  hs.push({ name: name.toUpperCase().slice(0,8) || "ANON", score });
  hs.sort((a,b) => b.score - a.score);
  hs = hs.slice(0, 3);
  localStorage.setItem("cf_hs", JSON.stringify(hs));
  return hs;
}
function renderHS() {
  const hs = loadHS();
  const list = document.getElementById("hs-list");
  list.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const entry = hs[i];
    const row = document.createElement("div");
    row.className = "hs-row";
    row.innerHTML = `<span class="hs-rank">#${i+1}</span><span class="hs-name">${entry?.name || "---"}</span><span class="hs-score">${entry?.score || 0}</span>`;
    list.appendChild(row);
  }
}

// ─────────────────────────────────────────────────────
//  SPIEL STARTEN
// ─────────────────────────────────────────────────────
function startGame(level) {
  cancelAnimationFrame(raf);
  tick = 0;
  particles = [];
  lastAlarmTick = -999;

  const SIZE = settings.worldSize;
  const map = generateMap(level);
  const total = map.flat().filter(t => t === COIN).length;
  const baseEnemies = Math.min(1 + Math.floor(level * 0.6 * settings.enemies), 8);
  const enemies = [];
  const used = new Set(["1,1","1,2","1,3","2,1","2,2","3,1"]);

  for (let i = 0; i < baseEnemies; i++) {
    let er, ec, tries = 0;
    do {
      er = 2 + Math.floor(Math.random() * (SIZE - 4));
      ec = 2 + Math.floor(Math.random() * (SIZE - 4));
      tries++;
    } while ((map[er]?.[ec] !== EMPTY || used.has(`${er},${ec}`) || (er < 6 && ec < 6)) && tries < 500);
    used.add(`${er},${ec}`);
    enemies.push(new Enemy(ec * TILE, er * TILE, level, i));
  }

  g = {
    map, level, score: 0, lives: 3,
    coinsLeft: total, totalCoins: total,
    invincible: 0, camX: 0, camY: 0,
    player: { x: TILE, y: TILE, animFrame: 0, animTimer: 0 },
    enemies,
    powerUps: { [PU_SPEED]: 0, [PU_SHIELD]: 0, [PU_FREEZE]: 0, [PU_MAGNET]: 0 },
    weather: "clear",   // clear, rain, fog
    weatherTimer: 600,
    windPhase: 0,
  };

  const canvas = document.getElementById("gameCanvas");
  const vw = Math.min(window.innerWidth, 480);
  canvas.width  = vw;
  canvas.height = Math.min(window.innerHeight - 220, 380);

  updateHUD();
  showScreen("screen-game");
  loop();
}

function nextLevel() { startGame(pendingNextLevel); }

// ─────────────────────────────────────────────────────
//  GAME LOOP
// ─────────────────────────────────────────────────────
function loop() {
  tick++;
  const canvas = document.getElementById("gameCanvas");
  const ctx    = canvas.getContext("2d");
  const vw = canvas.width, vh = canvas.height;
  const SIZE = settings.worldSize;
  const MAP_W = SIZE * TILE, MAP_H = SIZE * TILE;

  // ── Wind ──────────────────────────────────────────
  g.windPhase += 0.02;

  // ── Wetter ────────────────────────────────────────
  g.weatherTimer--;
  if (g.weatherTimer <= 0) {
    const weathers = ["clear","clear","clear","rain","fog"];
    g.weather = weathers[Math.floor(Math.random() * weathers.length)];
    g.weatherTimer = 400 + Math.floor(Math.random() * 600);
  }

  // ── Power-Up Timer ────────────────────────────────
  for (const type of [PU_SPEED, PU_SHIELD, PU_FREEZE, PU_MAGNET]) {
    if (g.powerUps[type] > 0) g.powerUps[type]--;
  }
  const frozen  = g.powerUps[PU_FREEZE] > 0;
  const speedMult = g.powerUps[PU_SPEED] > 0 ? 2.2 : 1;

  // ── Spieler-Animation ─────────────────────────────
  if (joy.active) {
    if (++g.player.animTimer > 6) { g.player.animFrame = (g.player.animFrame+1)%4; g.player.animTimer = 0; }
  }

  // ── Spielerbewegung ───────────────────────────────
  const spd = 2.5 * settings.speed * speedMult;
  if (joy.active && (Math.abs(joy.dx) > 0.05 || Math.abs(joy.dy) > 0.05)) {
    const mag = Math.hypot(joy.dx, joy.dy) || 1;
    const nx2 = g.player.x + (joy.dx / mag) * spd;
    const ny2 = g.player.y + (joy.dy / mag) * spd;
    const colsX = [Math.floor((nx2+TILE*.15)/TILE), Math.floor((nx2+TILE*.85)/TILE)];
    const rowsCur = [Math.floor((g.player.y+TILE*.15)/TILE), Math.floor((g.player.y+TILE*.85)/TILE)];
    if (colsX.every(c => rowsCur.every(r => !isBlocking(g.map[r]?.[c]))))
      g.player.x = Math.max(0, Math.min(MAP_W - TILE, nx2));
    const rowsY = [Math.floor((ny2+TILE*.15)/TILE), Math.floor((ny2+TILE*.85)/TILE)];
    const colsCur = [Math.floor((g.player.x+TILE*.15)/TILE), Math.floor((g.player.x+TILE*.85)/TILE)];
    if (rowsY.every(r => colsCur.every(c => !isBlocking(g.map[r]?.[c]))))
      g.player.y = Math.max(0, Math.min(MAP_H - TILE, ny2));
  }

  // ── Coin & Power-Up einsammeln ────────────────────
  const pc = Math.floor((g.player.x + TILE/2) / TILE);
  const pr = Math.floor((g.player.y + TILE/2) / TILE);
  const tile = g.map[pr]?.[pc];

  if (tile === COIN) {
    g.map[pr][pc] = EMPTY;
    g.coinsLeft--;
    g.score += 10 * g.level;
    spawnParticles(g.player.x + TILE/2, g.player.y + TILE/2, "coin");
    updateHUD();
  } else if (tile >= PU_SPEED && tile <= PU_MAGNET) {
    g.map[pr][pc] = EMPTY;
    g.powerUps[tile] = PU_INFO[tile].duration;
    updateHUD();
  }

  // ── Magnet: Coins in Radius einsammeln ───────────
  if (g.powerUps[PU_MAGNET] > 0) {
    const magnetR = 3;
    for (let dr = -magnetR; dr <= magnetR; dr++) {
      for (let dc = -magnetR; dc <= magnetR; dc++) {
        const mr = pr + dr, mc = pc + dc;
        if (g.map[mr]?.[mc] === COIN && Math.hypot(dr, dc) <= magnetR) {
          g.map[mr][mc] = EMPTY;
          g.coinsLeft--;
          g.score += 10 * g.level;
          spawnParticles(mc*TILE + TILE/2, mr*TILE + TILE/2, "coin");
        }
      }
    }
    updateHUD();
  }

  // ── Gegner updaten + Alarm-System ─────────────────
  let alarmSpotter = null;
  g.enemies.forEach(e => {
    const wasPatrol = e.mode === MODE_PATROL;
    e.update(g.map, g.player.x + TILE/2, g.player.y + TILE/2, frozen);
    // Wenn Gegner gerade Spieler entdeckt hat → Alarm
    if (wasPatrol && e.mode === MODE_CHASE && tick - lastAlarmTick > 60) {
      alarmSpotter = e;
      lastAlarmTick = tick;
    }
  });
  if (alarmSpotter) triggerAlarm(alarmSpotter, g.enemies);

  // ── Kollision ─────────────────────────────────────
  const shielded = g.powerUps[PU_SHIELD] > 0;
  if (g.invincible <= 0 && !shielded) {
    for (const e of g.enemies) {
      if (Math.hypot(e.x - g.player.x, e.y - g.player.y) < TILE * 0.7) {
        g.lives--;
        g.invincible = 120;
        updateHUD();
        if (g.lives <= 0) { showDead(); return; }
        break;
      }
    }
  } else if (g.invincible > 0) {
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

  // ── Wetter-Partikel spawnen ────────────────────────
  if (g.weather === "rain") {
    for (let i = 0; i < 4; i++)
      spawnParticles(g.camX + Math.random()*vw, g.camY + Math.random()*20, "rain");
  } else if (g.weather === "fog" && Math.random() < 0.15) {
    spawnParticles(g.camX + Math.random()*vw, g.camY + Math.random()*vh, "fog");
  }

  // ── Zeichnen ──────────────────────────────────────
  ctx.fillStyle = C.grass;
  ctx.fillRect(0, 0, vw, vh);

  ctx.save();
  ctx.translate(-g.camX, -g.camY);

  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      drawTile(ctx, r, c, g.map[r][c], g.windPhase);

  g.enemies.forEach(e => drawEnemy(ctx, e, frozen));
  drawPlayer(ctx, g.player.x, g.player.y, g.invincible, g.player.animFrame, g.powerUps[PU_SHIELD] > 0);

  // Partikel
  updateParticles(ctx, g.camX, g.camY);

  ctx.restore();

  // HUD alle 10 ticks updaten
  if (tick % 10 === 0) updateHUD();

  raf = requestAnimationFrame(loop);
}

// ─────────────────────────────────────────────────────
//  DEAD / LEVEL UP SCREENS
// ─────────────────────────────────────────────────────
function showDead() {
  cancelAnimationFrame(raf);
  document.getElementById("dead-level").textContent = g.level;
  document.getElementById("dead-score").textContent = g.score;
  document.getElementById("dead-coins").textContent = g.totalCoins - g.coinsLeft;

  const hs = loadHS();
  const isNewHS = hs.length < 3 || g.score > hs[hs.length - 1].score;
  const msg = document.getElementById("new-hs-msg");
  if (isNewHS) {
    const name = document.getElementById("player-name").value || "ANON";
    saveHS(name, g.score);
    msg.style.display = "block";
  } else {
    msg.style.display = "none";
  }
  renderHS();
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
//  EINSTELLUNGS-BUTTONS
// ─────────────────────────────────────────────────────
function setupSettingGroup(id, key) {
  const wrap = document.getElementById(id);
  wrap.querySelectorAll(".s-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      wrap.querySelectorAll(".s-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      settings[key] = parseFloat(btn.dataset.val);
    });
  });
}
setupSettingGroup("set-world",   "worldSize");
setupSettingGroup("set-enemies", "enemies");
setupSettingGroup("set-speed",   "speed");
setupSettingGroup("set-walls",   "walls");
setupSettingGroup("set-coins",   "coins");

// ─────────────────────────────────────────────────────
//  JOYSTICK – Touch
// ─────────────────────────────────────────────────────
const zone  = document.getElementById("joystick-zone");
const thumb = document.getElementById("joystick-thumb");
const base  = document.getElementById("joystick-base");
const MAX_R = 26;

zone.addEventListener("touchstart", e => {
  const t = e.touches[0];
  const rect = zone.getBoundingClientRect();
  joy.ox = t.clientX - rect.left;
  joy.oy = t.clientY - rect.top;
  base.style.left  = joy.ox + "px"; base.style.top  = joy.oy + "px";
  thumb.style.left = joy.ox + "px"; thumb.style.top = joy.oy + "px";
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
  joy.dx = dx / MAX_R; joy.dy = dy / MAX_R;
  e.preventDefault();
}, { passive: false });

zone.addEventListener("touchend", () => {
  joy.active = false; joy.dx = 0; joy.dy = 0;
  const rect = zone.getBoundingClientRect();
  const cx = rect.width/2, cy = rect.height/2;
  base.style.left  = cx+"px"; base.style.top  = cy+"px";
  thumb.style.left = cx+"px"; thumb.style.top = cy+"px";
});

// ─────────────────────────────────────────────────────
//  TASTATUR
// ─────────────────────────────────────────────────────
const keys = {};
window.addEventListener("keydown", e => {
  keys[e.key] = true;
  const dx = (keys["ArrowRight"]||keys["d"]?1:0)-(keys["ArrowLeft"]||keys["a"]?1:0);
  const dy = (keys["ArrowDown"] ||keys["s"]?1:0)-(keys["ArrowUp"]  ||keys["w"]?1:0);
  joy.active = dx!==0||dy!==0; joy.dx=dx; joy.dy=dy;
});
window.addEventListener("keyup", e => {
  keys[e.key] = false;
  const dx = (keys["ArrowRight"]||keys["d"]?1:0)-(keys["ArrowLeft"]||keys["a"]?1:0);
  const dy = (keys["ArrowDown"] ||keys["s"]?1:0)-(keys["ArrowUp"]  ||keys["w"]?1:0);
  joy.active = dx!==0||dy!==0; joy.dx=dx; joy.dy=dy;
});

// ── Init ─────────────────────────────────────────────
renderHS();
