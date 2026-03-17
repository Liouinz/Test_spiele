import { useState, useEffect, useRef, useCallback } from "react";

const TILE_SIZE = 40;
const MAP_COLS = 30;
const MAP_ROWS = 25;
const MAP_WIDTH = MAP_COLS * TILE_SIZE;
const MAP_HEIGHT = MAP_ROWS * TILE_SIZE;

// Tile types
const EMPTY = 0;
const WALL = 1;
const COIN = 2;
const TREE = 3;
const BUSH = 4;

// Colors - Forest theme
const COLORS = {
  grass: "#2d5a1b",
  grassLight: "#3a7224",
  wall: "#5c4a2a",
  wallDark: "#3d3020",
  tree: "#1a3d0a",
  treeTrunk: "#6b4423",
  bush: "#1e4d10",
  coin: "#ffd700",
  coinGlow: "#ffec6e",
  player: "#e8d5b7",
  playerOutline: "#8b6914",
  enemy: "#c0392b",
  enemyGlow: "#e74c3c",
  hud: "#0d1f07",
  hudBorder: "#4a7c2a",
  text: "#c8e6a0",
  accent: "#ffd700",
};

// Generate map for a given level
function generateMap(level) {
  const map = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(EMPTY));

  // Border walls
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) {
        map[r][c] = WALL;
      }
    }
  }

  // Seeded pseudo-random based on level
  const seed = level * 9301 + 49297;
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // Add internal walls/trees - more complex with higher level
  const wallCount = 30 + level * 5;
  const placed = new Set();
  placed.add("1,1"); placed.add("1,2"); placed.add("2,1"); // protect spawn

  for (let i = 0; i < wallCount; i++) {
    const r = 2 + Math.floor(rand() * (MAP_ROWS - 4));
    const c = 2 + Math.floor(rand() * (MAP_COLS - 4));
    const key = `${r},${c}`;
    if (!placed.has(key)) {
      map[r][c] = rand() > 0.4 ? TREE : WALL;
      placed.add(key);
      // Sometimes extend walls
      if (rand() > 0.5) {
        const dr = rand() > 0.5 ? 1 : 0;
        const dc = rand() > 0.5 ? 0 : 1;
        const r2 = r + dr, c2 = c + dc;
        const key2 = `${r2},${c2}`;
        if (r2 > 0 && r2 < MAP_ROWS - 1 && c2 > 0 && c2 < MAP_COLS - 1 && !placed.has(key2)) {
          map[r2][c2] = WALL;
          placed.add(key2);
        }
      }
    }
  }

  // Bushes
  for (let i = 0; i < 20; i++) {
    const r = 2 + Math.floor(rand() * (MAP_ROWS - 4));
    const c = 2 + Math.floor(rand() * (MAP_COLS - 4));
    if (map[r][c] === EMPTY && !placed.has(`${r},${c}`)) {
      map[r][c] = BUSH;
    }
  }

  // Coins
  const coinCount = 15 + level * 3;
  let coinsPlaced = 0;
  let attempts = 0;
  while (coinsPlaced < coinCount && attempts < 2000) {
    attempts++;
    const r = 1 + Math.floor(rand() * (MAP_ROWS - 2));
    const c = 1 + Math.floor(rand() * (MAP_COLS - 2));
    if (map[r][c] === EMPTY && !(r <= 2 && c <= 2)) {
      map[r][c] = COIN;
      coinsPlaced++;
    }
  }

  return map;
}

function isBlocking(tile) {
  return tile === WALL || tile === TREE;
}

// Q-Learning AI
class QLearningEnemy {
  constructor(x, y, level) {
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.qTable = {};
    this.learningRate = 0.15;
    this.discountFactor = 0.9;
    this.epsilon = Math.max(0.05, 0.8 - level * 0.07);
    this.lastState = null;
    this.lastAction = null;
    this.speed = 1.2 + level * 0.15;
    this.moveTimer = 0;
    this.moveInterval = Math.max(6, 18 - level * 1.2);
    this.intelligence = Math.min(100, level * 8);
    this.color = `hsl(${(level * 37) % 360}, 80%, 50%)`;
  }

  getState(px, py) {
    const dx = Math.sign(px - this.x);
    const dy = Math.sign(py - this.y);
    const dist = Math.floor(Math.sqrt((px - this.x) ** 2 + (py - this.y) ** 2) / TILE_SIZE);
    return `${dx},${dy},${Math.min(dist, 8)}`;
  }

  getQ(state, action) {
    return this.qTable[`${state}:${action}`] || 0;
  }

  setQ(state, action, value) {
    this.qTable[`${state}:${action}`] = value;
  }

  chooseAction(state) {
    if (Math.random() < this.epsilon) {
      return Math.floor(Math.random() * 4);
    }
    let best = 0, bestVal = this.getQ(state, 0);
    for (let a = 1; a < 4; a++) {
      const v = this.getQ(state, a);
      if (v > bestVal) { bestVal = v; best = a; }
    }
    return best;
  }

  learn(prevState, action, reward, newState) {
    const maxNextQ = Math.max(...[0,1,2,3].map(a => this.getQ(newState, a)));
    const oldQ = this.getQ(prevState, action);
    const newQ = oldQ + this.learningRate * (reward + this.discountFactor * maxNextQ - oldQ);
    this.setQ(prevState, action, newQ);
  }

  update(map, px, py) {
    this.moveTimer++;
    if (this.moveTimer < this.moveInterval) return;
    this.moveTimer = 0;

    const state = this.getState(px, py);
    const action = this.chooseAction(state);
    const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
    const [dc, dr] = dirs[action];
    const nx = this.x + dc * TILE_SIZE;
    const ny = this.y + dr * TILE_SIZE;
    const nc = Math.floor(nx / TILE_SIZE);
    const nr = Math.floor(ny / TILE_SIZE);

    let reward = -0.1;
    let moved = false;
    if (nr >= 0 && nr < MAP_ROWS && nc >= 0 && nc < MAP_COLS && !isBlocking(map[nr][nc])) {
      this.px = this.x;
      this.py = this.y;
      this.x = nx;
      this.y = ny;
      moved = true;
      const newDist = Math.sqrt((px - nx) ** 2 + (py - ny) ** 2);
      const oldDist = Math.sqrt((px - this.px) ** 2 + (py - this.py) ** 2);
      reward = oldDist - newDist > 0 ? 1 : -0.5;
    } else {
      reward = -1;
    }

    if (this.lastState !== null) {
      this.learn(this.lastState, this.lastAction, reward, state);
    }
    this.lastState = state;
    this.lastAction = action;
  }
}

// Pixel drawing helpers
function drawPixelChar(ctx, x, y, size, color, type = "player") {
  const p = size / 8;
  ctx.fillStyle = color;
  if (type === "player") {
    // Head
    ctx.fillRect(x + p*3, y, p*2, p*2);
    // Body
    ctx.fillRect(x + p*2, y + p*2, p*4, p*3);
    // Arms
    ctx.fillRect(x + p, y + p*2, p, p*2);
    ctx.fillRect(x + p*6, y + p*2, p, p*2);
    // Legs
    ctx.fillRect(x + p*2, y + p*5, p*1.5, p*3);
    ctx.fillRect(x + p*4.5, y + p*5, p*1.5, p*3);
  } else {
    // Enemy ghost-like shape
    ctx.fillRect(x + p*2, y, p*4, p*4);
    ctx.fillRect(x + p, y + p*2, p*6, p*4);
    ctx.fillRect(x + p, y + p*6, p, p*2);
    ctx.fillRect(x + p*3, y + p*6, p, p*2);
    ctx.fillRect(x + p*5, y + p*6, p, p*2);
    // Eyes
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + p*2, y + p*2, p*1.5, p*1.5);
    ctx.fillRect(x + p*4.5, y + p*2, p*1.5, p*1.5);
    ctx.fillStyle = "#000";
    ctx.fillRect(x + p*2.5, y + p*2.5, p, p);
    ctx.fillRect(x + p*5, y + p*2.5, p, p);
  }
}

function drawCoin(ctx, x, y, size, t) {
  const cx = x + size/2, cy = y + size/2;
  const r = size * 0.3;
  const pulse = 0.85 + 0.15 * Math.sin(t * 0.1);
  ctx.shadowColor = COLORS.coinGlow;
  ctx.shadowBlur = 8;
  ctx.fillStyle = COLORS.coin;
  ctx.beginPath();
  ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff9";
  ctx.beginPath();
  ctx.arc(cx - r*0.2, cy - r*0.2, r*0.35*pulse, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

export default function CoinCollector() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const joystickRef = useRef({ active: false, dx: 0, dy: 0, startX: 0, startY: 0 });
  const animRef = useRef(null);
  const tickRef = useRef(0);
  const [gameState, setGameState] = useState("menu"); // menu, playing, dead, levelup
  const [hud, setHud] = useState({ level: 1, score: 0, lives: 3, coins: 0, totalCoins: 0, iq: 0 });

  const initGame = useCallback((level = 1) => {
    const map = generateMap(level);
    const totalCoins = map.flat().filter(t => t === COIN).length;
    const enemyCount = Math.min(1 + Math.floor(level * 0.7), 6);
    const enemies = [];
    const usedSpots = new Set(["1,1"]);

    const rand2 = () => Math.random();
    for (let i = 0; i < enemyCount; i++) {
      let er, ec;
      let tries = 0;
      do {
        er = 2 + Math.floor(rand2() * (MAP_ROWS - 4));
        ec = 2 + Math.floor(rand2() * (MAP_COLS - 4));
        tries++;
      } while ((map[er]?.[ec] !== EMPTY || usedSpots.has(`${er},${ec}`) || (er < 5 && ec < 5)) && tries < 500);
      usedSpots.add(`${er},${ec}`);
      enemies.push(new QLearningEnemy(ec * TILE_SIZE, er * TILE_SIZE, level));
    }

    gameRef.current = {
      map,
      player: { x: TILE_SIZE, y: TILE_SIZE, px: TILE_SIZE, py: TILE_SIZE },
      enemies,
      level,
      score: 0,
      lives: 3,
      coinsLeft: totalCoins,
      totalCoins,
      invincible: 0,
      camX: 0,
      camY: 0,
    };

    setHud({ level, score: 0, lives: 3, coins: 0, totalCoins, iq: Math.min(100, level * 8) });
    setGameState("playing");
  }, []);

  useEffect(() => {
    if (gameState !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const loop = () => {
      const g = gameRef.current;
      if (!g) return;
      tickRef.current++;
      const t = tickRef.current;

      // Player movement from joystick
      const joy = joystickRef.current;
      const spd = 2.5;
      if (joy.active && (Math.abs(joy.dx) > 0.1 || Math.abs(joy.dy) > 0.1)) {
        const mag = Math.sqrt(joy.dx*joy.dx + joy.dy*joy.dy);
        const ndx = joy.dx/mag * spd;
        const ndy = joy.dy/mag * spd;
        const nx = g.player.x + ndx;
        const ny = g.player.y + ndy;
        const nc = Math.floor((nx + TILE_SIZE*0.2) / TILE_SIZE);
        const nc2 = Math.floor((nx + TILE_SIZE*0.8) / TILE_SIZE);
        const nr = Math.floor((ny + TILE_SIZE*0.2) / TILE_SIZE);
        const nr2 = Math.floor((ny + TILE_SIZE*0.8) / TILE_SIZE);

        if (!isBlocking(g.map[nr]?.[nc]) && !isBlocking(g.map[nr]?.[nc2]) &&
            !isBlocking(g.map[nr2]?.[nc]) && !isBlocking(g.map[nr2]?.[nc2])) {
          g.player.x = Math.max(0, Math.min(MAP_WIDTH - TILE_SIZE, nx));
          g.player.y = Math.max(0, Math.min(MAP_HEIGHT - TILE_SIZE, ny));
        }
      }

      // Coin collection
      const pc = Math.floor((g.player.x + TILE_SIZE/2) / TILE_SIZE);
      const pr = Math.floor((g.player.y + TILE_SIZE/2) / TILE_SIZE);
      if (g.map[pr]?.[pc] === COIN) {
        g.map[pr][pc] = EMPTY;
        g.coinsLeft--;
        g.score += 10 * g.level;
      }
      if (g.map[pr]?.[pc] === BUSH) {
        // safe zone - no extra logic
      }

      // Update enemies
      g.enemies.forEach(e => e.update(g.map, g.player.x + TILE_SIZE/2, g.player.y + TILE_SIZE/2));

      // Enemy collision
      if (g.invincible <= 0) {
        for (const e of g.enemies) {
          const dist = Math.sqrt((e.x - g.player.x)**2 + (e.y - g.player.y)**2);
          if (dist < TILE_SIZE * 0.7) {
            g.lives--;
            g.invincible = 120;
            if (g.lives <= 0) {
              setGameState("dead");
              return;
            }
            break;
          }
        }
      } else {
        g.invincible--;
      }

      // Level up
      if (g.coinsLeft <= 0) {
        gameRef.current.level++;
        setGameState("levelup");
        return;
      }

      // Camera
      const vw = canvas.width, vh = canvas.height - 100;
      g.camX = Math.max(0, Math.min(MAP_WIDTH - vw, g.player.x + TILE_SIZE/2 - vw/2));
      g.camY = Math.max(0, Math.min(MAP_HEIGHT - vh, g.player.y + TILE_SIZE/2 - vh/2));

      // Draw
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(-g.camX, -g.camY + 60);

      // Draw map
      for (let r = 0; r < MAP_ROWS; r++) {
        for (let c = 0; c < MAP_COLS; c++) {
          const tile = g.map[r][c];
          const tx = c * TILE_SIZE, ty = r * TILE_SIZE;
          if ((r+c) % 2 === 0) {
            ctx.fillStyle = COLORS.grassLight;
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
          }
          if (tile === WALL) {
            ctx.fillStyle = COLORS.wall;
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = COLORS.wallDark;
            ctx.fillRect(tx, ty, TILE_SIZE, 4);
            ctx.fillRect(tx, ty, 4, TILE_SIZE);
          } else if (tile === TREE) {
            ctx.fillStyle = COLORS.treeTrunk;
            ctx.fillRect(tx + TILE_SIZE*0.4, ty + TILE_SIZE*0.5, TILE_SIZE*0.2, TILE_SIZE*0.5);
            ctx.fillStyle = COLORS.tree;
            ctx.beginPath();
            ctx.arc(tx + TILE_SIZE/2, ty + TILE_SIZE*0.35, TILE_SIZE*0.38, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = "#2a6a15";
            ctx.beginPath();
            ctx.arc(tx + TILE_SIZE*0.35, ty + TILE_SIZE*0.4, TILE_SIZE*0.22, 0, Math.PI*2);
            ctx.fill();
          } else if (tile === BUSH) {
            ctx.fillStyle = COLORS.bush;
            ctx.beginPath();
            ctx.arc(tx + TILE_SIZE/2, ty + TILE_SIZE*0.6, TILE_SIZE*0.35, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(tx + TILE_SIZE*0.35, ty + TILE_SIZE*0.65, TILE_SIZE*0.25, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(tx + TILE_SIZE*0.65, ty + TILE_SIZE*0.65, TILE_SIZE*0.25, 0, Math.PI*2);
            ctx.fill();
          } else if (tile === COIN) {
            drawCoin(ctx, tx, ty, TILE_SIZE, t + r*7 + c*13);
          }
        }
      }

      // Draw enemies
      g.enemies.forEach((e, i) => {
        if (t % 30 < 15 || g.invincible <= 0) {
          ctx.shadowColor = "#ff0000";
          ctx.shadowBlur = 10;
          drawPixelChar(ctx, e.x, e.y, TILE_SIZE, `hsl(${(i*60+10)%360},85%,55%)`, "enemy");
          ctx.shadowBlur = 0;
        }
      });

      // Draw player (flicker when invincible)
      if (g.invincible <= 0 || t % 10 < 5) {
        ctx.shadowColor = "#ffe08a";
        ctx.shadowBlur = 8;
        drawPixelChar(ctx, g.player.x, g.player.y, TILE_SIZE, COLORS.player, "player");
        ctx.shadowBlur = 0;
      }

      ctx.restore();

      // HUD
      ctx.fillStyle = COLORS.hud;
      ctx.fillRect(0, 0, canvas.width, 58);
      ctx.strokeStyle = COLORS.hudBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, 58);

      ctx.font = "bold 13px monospace";
      ctx.fillStyle = COLORS.accent;
      ctx.fillText(`🌲 LEVEL ${g.level}`, 10, 22);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(`⭐ ${g.score}`, 10, 44);

      ctx.fillStyle = COLORS.accent;
      ctx.fillText(`🪙 ${g.totalCoins - g.coinsLeft}/${g.totalCoins}`, canvas.width/2 - 50, 22);

      ctx.fillStyle = g.lives >= 2 ? "#4ade80" : "#f87171";
      ctx.fillText(`❤️ ${g.lives}`, canvas.width/2 - 50, 44);

      const iq = Math.min(100, g.level * 8);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(`🧠 KI-IQ: ${iq}`, canvas.width - 120, 22);
      ctx.fillStyle = `hsl(${120 - iq*1.2},80%,55%)`;
      ctx.fillRect(canvas.width - 120, 30, (iq/100)*110, 10);
      ctx.strokeStyle = COLORS.hudBorder;
      ctx.strokeRect(canvas.width - 120, 30, 110, 10);

      setHud({ level: g.level, score: g.score, lives: g.lives, coins: g.totalCoins - g.coinsLeft, totalCoins: g.totalCoins, iq });

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState]);

  // Joystick handlers
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    joystickRef.current = { active: true, dx: 0, dy: 0, startX: t.clientX, startY: t.clientY };
  };
  const handleTouchMove = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const j = joystickRef.current;
    const dx = t.clientX - j.startX;
    const dy = t.clientY - j.startY;
    const mag = Math.sqrt(dx*dx + dy*dy);
    const max = 40;
    j.dx = mag > max ? dx/mag : dx/max;
    j.dy = mag > max ? dy/mag : dy/max;
  };
  const handleTouchEnd = () => {
    joystickRef.current.active = false;
    joystickRef.current.dx = 0;
    joystickRef.current.dy = 0;
  };

  // Keyboard support
  useEffect(() => {
    const keys = {};
    const down = (e) => { keys[e.key] = true; updateJoy(); };
    const up = (e) => { keys[e.key] = false; updateJoy(); };
    const updateJoy = () => {
      const dx = (keys["ArrowRight"]||keys["d"] ? 1 : 0) - (keys["ArrowLeft"]||keys["a"] ? 1 : 0);
      const dy = (keys["ArrowDown"]||keys["s"] ? 1 : 0) - (keys["ArrowUp"]||keys["w"] ? 1 : 0);
      joystickRef.current.active = dx !== 0 || dy !== 0;
      joystickRef.current.dx = dx;
      joystickRef.current.dy = dy;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const canvasH = 520;
  const canvasW = 380;

  if (gameState === "menu") return (
    <div style={{ background: "#0d1f07", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: "#c8e6a0" }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🌲</div>
      <div style={{ fontSize: 28, fontWeight: "bold", color: "#ffd700", letterSpacing: 2, marginBottom: 4 }}>COIN FOREST</div>
      <div style={{ fontSize: 13, color: "#7ab55a", marginBottom: 32 }}>Sammle alle Münzen — überlebe die KI!</div>
      <div style={{ background: "#1a3d0a", border: "2px solid #4a7c2a", borderRadius: 12, padding: "16px 24px", marginBottom: 24, maxWidth: 300, fontSize: 12, lineHeight: 1.8 }}>
        <div>🪙 Coins einsammeln</div>
        <div>👾 Gegnern ausweichen</div>
        <div>🧠 KI lernt mit jedem Level</div>
        <div>📱 Touch-Joystick / WASD / Pfeiltasten</div>
        <div>❤️ 3 Leben pro Runde</div>
      </div>
      <button onClick={() => initGame(1)} style={{ background: "#ffd700", color: "#0d1f07", border: "none", borderRadius: 8, padding: "14px 36px", fontSize: 18, fontWeight: "bold", fontFamily: "monospace", cursor: "pointer", letterSpacing: 1 }}>
        ▶ SPIELEN
      </button>
    </div>
  );

  if (gameState === "dead") return (
    <div style={{ background: "#1a0505", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: "#f87171" }}>
      <div style={{ fontSize: 48 }}>💀</div>
      <div style={{ fontSize: 28, fontWeight: "bold", marginBottom: 8 }}>GAME OVER</div>
      <div style={{ color: "#ffd700", fontSize: 18, marginBottom: 4 }}>Level: {hud.level}</div>
      <div style={{ color: "#c8e6a0", fontSize: 16, marginBottom: 32 }}>Score: {hud.score}</div>
      <button onClick={() => initGame(1)} style={{ background: "#f87171", color: "#fff", border: "none", borderRadius: 8, padding: "12px 32px", fontSize: 16, fontWeight: "bold", fontFamily: "monospace", cursor: "pointer", marginBottom: 12 }}>
        ↩ Neu starten
      </button>
    </div>
  );

  if (gameState === "levelup") {
    const nextLevel = (gameRef.current?.level) || 2;
    return (
      <div style={{ background: "#071a03", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: "#c8e6a0" }}>
        <div style={{ fontSize: 48 }}>🎉</div>
        <div style={{ fontSize: 26, fontWeight: "bold", color: "#ffd700", marginBottom: 8 }}>LEVEL GESCHAFFT!</div>
        <div style={{ fontSize: 15, marginBottom: 4 }}>Weiter zu Level {nextLevel}</div>
        <div style={{ color: "#f87171", fontSize: 13, marginBottom: 8 }}>🧠 KI-IQ steigt auf {Math.min(100, nextLevel * 8)}</div>
        <div style={{ color: "#7ab55a", fontSize: 13, marginBottom: 28 }}>Mehr Gegner • Neue Map • Mehr Coins</div>
        <button onClick={() => initGame(nextLevel)} style={{ background: "#4ade80", color: "#071a03", border: "none", borderRadius: 8, padding: "14px 36px", fontSize: 18, fontWeight: "bold", fontFamily: "monospace", cursor: "pointer" }}>
          ▶ WEITER
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "#0d1f07", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", userSelect: "none" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        style={{ display: "block", imageRendering: "pixelated", border: "3px solid #4a7c2a", borderRadius: 8 }}
      />
      {/* Virtual joystick hint */}
      <div style={{ marginTop: 12, color: "#3a7224", fontSize: 11, fontFamily: "monospace", textAlign: "center" }}>
        📱 Tippen & Ziehen zum Bewegen &nbsp;|&nbsp; ⌨️ WASD / Pfeiltasten
      </div>
    </div>
  );
}
