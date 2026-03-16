// ═══════════════════════════════════════════════════════════════
//  COIN FOREST v5.1 – enemies.js
//  Bandit-Klassen, A* Pathfinding, 5 Zustände, Schwert-Animation
// ═══════════════════════════════════════════════════════════════

'use strict';

const Enemies = (() => {

  const TILE = 40;

  // ── Zustände ───────────────────────────────────────────────
  const STATE = {
    SLEEP:    0,  // schläft, minimaler Radius
    EXPLORE:  1,  // erkundet die Welt
    ALERT:    2,  // aufmerksam, geht zu letzter bekannter Position
    CHASE:    3,  // verfolgt aktiv
    SEARCH:   4,  // sucht nach Spieler (nach Flucht)
  };

  // ── Bandit-Typen ───────────────────────────────────────────
  const BANDIT_TYPES = {
    warrior: {
      name:        'Krieger',
      speedMult:   1.0,
      detectMult:  1.0,
      color:       0,
      intervalBase: 14,
    },
    archer: {
      name:        'Bogenschütze',
      speedMult:   0.8,
      detectMult:  1.4,  // größerer Radius
      color:       1,
      intervalBase: 16,
    },
    runner: {
      name:        'Läufer',
      speedMult:   1.8,
      detectMult:  0.7,  // kleinerer Radius
      color:       2,
      intervalBase: 8,
    },
    guard: {
      name:        'Wächter',
      speedMult:   0.5,
      detectMult:  0.15, // fast blind im Schlaf
      color:       3,
      intervalBase: 20,
    },
  };

  const TYPES_ARRAY = ['warrior', 'archer', 'runner', 'guard'];

  // ── A* Pathfinding ─────────────────────────────────────────
  const DIRS_4 = [[0,-1],[0,1],[-1,0],[1,0]];
  const DIRS_8 = [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];

  function heuristic(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  function aStar(startX, startY, goalX, goalY, maxDist = 40) {
    const open    = [];
    const closed  = new Set();
    const gScore  = {};
    const fScore  = {};
    const parent  = {};
    const key     = (x, y) => `${x},${y}`;

    const sk = key(startX, startY);
    gScore[sk] = 0;
    fScore[sk] = heuristic(startX, startY, goalX, goalY);
    open.push({ x: startX, y: startY, f: fScore[sk] });

    let iterations = 0;
    const MAX_ITER = 200;

    while (open.length > 0 && iterations++ < MAX_ITER) {
      // Günstigstes Element
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      const ck  = key(cur.x, cur.y);

      if (cur.x === goalX && cur.y === goalY) {
        // Pfad rekonstruieren
        const path = [];
        let node = ck;
        while (parent[node]) {
          const [nx, ny] = node.split(',').map(Number);
          path.unshift({ x: nx, y: ny });
          node = parent[node];
        }
        return path;
      }

      if (closed.has(ck)) continue;
      closed.add(ck);

      for (const [dx, dy] of DIRS_4) {
        const nx = cur.x + dx, ny = cur.y + dy;
        const nk = key(nx, ny);

        if (closed.has(nk)) continue;
        if (Math.hypot(nx - startX, ny - startY) > maxDist) continue;
        if (MapSystem && MapSystem.isBlockingWorld(nx, ny)) continue;

        const tentG = (gScore[ck] || 0) + 1;
        if (tentG < (gScore[nk] ?? Infinity)) {
          parent[nk] = ck;
          gScore[nk] = tentG;
          fScore[nk] = tentG + heuristic(nx, ny, goalX, goalY);
          open.push({ x: nx, y: ny, f: fScore[nk] });
        }
      }
    }

    return null; // Kein Pfad gefunden
  }

  // ── Erkundungs-Karte ───────────────────────────────────────
  class ExploreMap {
    constructor() {
      this.visited = new Map(); // "cx,cy" → Besuchs-Zähler
      this.chunkSize = 4; // 4×4 Tiles = 1 Erkundungs-Zelle
    }

    visit(tx, ty) {
      const cx = Math.floor(tx / this.chunkSize);
      const cy = Math.floor(ty / this.chunkSize);
      const key = `${cx},${cy}`;
      this.visited.set(key, (this.visited.get(key) || 0) + 1);
    }

    getVisitCount(tx, ty) {
      const cx = Math.floor(tx / this.chunkSize);
      const cy = Math.floor(ty / this.chunkSize);
      return this.visited.get(`${cx},${cy}`) || 0;
    }

    getLeastVisitedNear(tx, ty, radius = 8) {
      const centerCX = Math.floor(tx / this.chunkSize);
      const centerCY = Math.floor(ty / this.chunkSize);
      let best = null, bestCount = Infinity;
      const r = Math.ceil(radius / this.chunkSize);

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const cx = centerCX + dx, cy = centerCY + dy;
          const worldTX = cx * this.chunkSize + this.chunkSize / 2;
          const worldTY = cy * this.chunkSize + this.chunkSize / 2;
          if (MapSystem && MapSystem.isBlockingWorld(Math.floor(worldTX), Math.floor(worldTY))) continue;
          const count = this.visited.get(`${cx},${cy}`) || 0;
          if (count < bestCount) {
            bestCount = count;
            best = { tx: worldTX, ty: worldTY };
          }
        }
      }
      return best;
    }
  }

  // ── Bandit-Klasse ──────────────────────────────────────────
  class Bandit {
    constructor(px, py, level, idx) {
      this.x   = px;
      this.y   = py;
      this.idx = idx;

      // Typ
      const typeKey    = TYPES_ARRAY[idx % TYPES_ARRAY.length];
      this.typeDef     = BANDIT_TYPES[typeKey];
      this.typeKey     = typeKey;

      // Erkennungsradien
      const base           = 20 * TILE;
      this.detectRadiusBase = base * this.typeDef.detectMult;
      this.sleepRadius      = 2 * TILE;
      this.alertRadius      = 15 * TILE;

      // Bewegung
      const speedBase      = Math.max(3, Math.floor((20 - level * 1.0) / (this.typeDef.speedMult || 1)));
      this.intervalBase    = speedBase;
      this.interval        = speedBase;
      this.timer           = Math.floor(Math.random() * speedBase);

      // Zustand
      this.state        = typeKey === 'guard' ? STATE.SLEEP : STATE.EXPLORE;
      this.alertDelay   = 0;
      this.lingerTimer  = 0;
      this.searchTimer  = 0;
      this.lastKnownX   = px;
      this.lastKnownY   = py;

      // Pathfinding
      this.path         = [];
      this.pathTimer    = 0;
      this.exploreMap   = new ExploreMap();
      this.exploreGoal  = null;

      // Spawn-Position
      this.spawnX = px;
      this.spawnY = py;
      this.patrolRadius = (8 + Math.floor(Math.random() * 8)) * TILE;

      // Animation
      this.animFrame  = 0;
      this.animTimer  = 0;
      this.swordSwing = 0;
      this.swordDir   = 1;

      // Sackgassen-Erkennung
      this.stuckTimer  = 0;
      this.stuckCount  = 0;
      this.lastTX      = Math.floor(px / TILE);
      this.lastTY      = Math.floor(py / TILE);

      // Statistik
      this.totalMoved  = 0;
    }

    // ── Pixel-Distanz zum Spieler ───────────────────────────
    distToPlayer(plx, ply) {
      return Math.hypot(this.x - plx, this.y - ply);
    }

    // ── Erkennungsradius (je nach Zustand + Nacht) ──────────
    getDetectRadius(isNight, worldSpeedMult) {
      const nightBonus = isNight ? 1.6 : 1.0;
      if (this.state === STATE.SLEEP) return this.sleepRadius;
      return this.detectRadiusBase * nightBonus;
    }

    // ── Bewegungsversuch ───────────────────────────────────
    tryMovePixel(dx, dy) {
      const spd = this.typeDef.speedMult * TILE;
      const nx  = this.x + dx * spd;
      const ny  = this.y + dy * spd;
      const margin = TILE * 0.15;

      const corners = [
        [nx + margin, ny + margin],
        [nx + TILE - margin, ny + margin],
        [nx + margin, ny + TILE - margin],
        [nx + TILE - margin, ny + TILE - margin],
      ];

      const clear = corners.every(([cx2, cy2]) => {
        const tx2 = Math.floor(cx2 / TILE), ty2 = Math.floor(cy2 / TILE);
        return MapSystem ? !MapSystem.isBlockingWorld(tx2, ty2) : true;
      });

      if (clear) {
        this.x = nx; this.y = ny;
        this.totalMoved++;
        return true;
      }
      return false;
    }

    // ── Tile-Bewegung (für Pathfinding) ────────────────────
    moveTile(tx, ty) {
      const px = tx * TILE, py = ty * TILE;
      const dx = Math.sign(px - this.x), dy = Math.sign(py - this.y);
      const spd = TILE;
      const nx = this.x + dx * spd, ny = this.y + dy * spd;
      const margin = TILE * 0.12;

      const ok = [
        [nx + margin, ny + margin],
        [nx + TILE - margin, ny + margin],
        [nx + margin, ny + TILE - margin],
        [nx + TILE - margin, ny + TILE - margin],
      ].every(([cx2, cy2]) => {
        if (!MapSystem) return true;
        return !MapSystem.isBlockingWorld(Math.floor(cx2/TILE), Math.floor(cy2/TILE));
      });

      if (ok) { this.x = nx; this.y = ny; this.totalMoved++; return true; }
      return false;
    }

    // ── Direktbewegung zum Ziel ────────────────────────────
    moveToward(goalPX, goalPY) {
      const dx = goalPX - this.x, dy = goalPY - this.y;
      const mag = Math.hypot(dx, dy);
      if (mag < TILE * 0.5) return true; // Angekommen

      const ndx = dx / mag, ndy = dy / mag;
      if (!this.tryMovePixel(ndx, ndy)) {
        // Versuche Ausweichen
        const perp = [-ndy, ndx];
        if (!this.tryMovePixel(perp[0], perp[1])) {
          this.tryMovePixel(-perp[0], -perp[1]);
        }
      }
      return false;
    }

    // ── Sackgassen-Erkennung ───────────────────────────────
    checkStuck() {
      const tx = Math.floor(this.x / TILE), ty = Math.floor(this.y / TILE);
      if (++this.stuckTimer < 4) return;
      this.stuckTimer = 0;

      if (tx === this.lastTX && ty === this.lastTY) {
        this.stuckCount++;
        if (this.stuckCount >= 3) {
          this.stuckCount = 0;
          this.path = []; // Pfad verwerfen
          // Zufällige Ausweichbewegung
          const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
          const d = dirs[Math.floor(Math.random() * 4)];
          this.tryMovePixel(d[0], d[1]);
        }
      } else {
        this.stuckCount = 0;
      }
      this.lastTX = tx; this.lastTY = ty;
    }

    // ── Alarm empfangen ────────────────────────────────────
    receiveAlarm(fromX, fromY, delay) {
      if (this.state === STATE.SLEEP || this.state === STATE.EXPLORE) {
        this.state       = STATE.ALERT;
        this.alertDelay  = delay;
        this.lastKnownX  = fromX;
        this.lastKnownY  = fromY;
        this.path        = [];
      }
    }

    // ── Hauptupdate ────────────────────────────────────────
    update(plx, ply, frozen, isNight, worldSpeedMult, allBandits) {
      if (frozen) return;

      // Timer mit Welt-Speed-Multiplikator
      const interval = Math.max(3, Math.round(this.intervalBase / (worldSpeedMult || 1)));
      if (++this.timer < interval) return;
      this.timer = 0;

      // Animations-Update
      if (++this.animTimer > 7) { this.animFrame = (this.animFrame + 1) % 4; this.animTimer = 0; }

      // Schwert-Animation
      if (this.state === STATE.CHASE) {
        this.swordSwing += 0.18 * this.swordDir;
        if (this.swordSwing > 1.2 || this.swordSwing < -0.4) this.swordDir *= -1;
      } else {
        this.swordSwing = lerp(this.swordSwing, 0, 0.1);
      }

      const d = this.distToPlayer(plx, ply);
      const detectR = this.getDetectRadius(isNight, worldSpeedMult);

      // ── Zustand-Übergänge ────────────────────────────────
      switch (this.state) {

        case STATE.SLEEP:
          if (d < this.sleepRadius * 1.5) {
            this.state      = STATE.CHASE;
            this.lingerTimer = 180;
            this.triggerAlarm(plx, ply, allBandits);
          }
          break;

        case STATE.EXPLORE:
          if (d < detectR) {
            this.state       = STATE.CHASE;
            this.lingerTimer = 120;
            this.lastKnownX  = plx;
            this.lastKnownY  = ply;
            this.path        = [];
            this.triggerAlarm(plx, ply, allBandits);
          } else if (this.state === STATE.EXPLORE) {
            this.exploreStep();
          }
          break;

        case STATE.ALERT:
          if (d < detectR) {
            this.state      = STATE.CHASE;
            this.lingerTimer = 120;
            this.path        = [];
          } else if (--this.alertDelay <= 0) {
            // Zum letzten bekannten Ort gehen
            const arrived = this.moveToward(this.lastKnownX, this.lastKnownY);
            if (arrived) {
              this.state = STATE.SEARCH;
              this.searchTimer = 12 * 60; // 12 Sekunden suchen
            }
          }
          break;

        case STATE.CHASE:
          if (d > detectR + 8 * TILE) {
            this.state       = STATE.SEARCH;
            this.searchTimer = 15 * 60;
            this.lastKnownX  = plx;
            this.lastKnownY  = ply;
            this.path        = [];
          } else {
            this.lastKnownX = plx;
            this.lastKnownY = ply;
            this.chaseStep(plx, ply, detectR);
          }
          break;

        case STATE.SEARCH:
          if (d < detectR) {
            this.state = STATE.CHASE;
            this.path  = [];
          } else if (--this.searchTimer <= 0) {
            this.state = STATE.EXPLORE;
            this.path  = [];
          } else {
            this.searchStep();
          }
          break;
      }

      this.checkStuck();
      this.exploreMap.visit(Math.floor(this.x / TILE), Math.floor(this.y / TILE));
    }

    // ── Erkundungs-Schritt ────────────────────────────────
    exploreStep() {
      if (!this.exploreGoal || this.reachedGoal(this.exploreGoal)) {
        const target = this.exploreMap.getLeastVisitedNear(
          Math.floor(this.x / TILE), Math.floor(this.y / TILE), 16
        );
        if (target) {
          this.exploreGoal = { px: target.tx * TILE, py: target.ty * TILE };
          this.path = [];
        }
      }

      if (this.exploreGoal) {
        this.moveWithPath(this.exploreGoal.px, this.exploreGoal.py, 20);
      }

      // Zurück zum Spawn wenn zu weit weg
      const distSpawn = Math.hypot(this.x - this.spawnX, this.y - this.spawnY);
      if (distSpawn > this.patrolRadius) {
        this.exploreGoal = { px: this.spawnX, py: this.spawnY };
        this.path = [];
      }
    }

    // ── Jagd-Schritt (direkter + Pathfinding-Fallback) ────
    chaseStep(plx, ply, detectR) {
      // Direkte Sichtlinie prüfen
      const hasSight = this.hasLineOfSight(plx, ply);

      if (hasSight) {
        // Direkt verfolgen
        this.moveToward(plx, ply);
        this.path = [];
      } else {
        // A* Pathfinding
        this.moveWithPath(plx, ply, 30);
      }
    }

    // ── Such-Schritt ──────────────────────────────────────
    searchStep() {
      if (!this.searchPath || this.searchPath.length === 0) {
        const angle = Math.random() * Math.PI * 2;
        const dist  = 3 + Math.floor(Math.random() * 5);
        const tx    = Math.floor(this.x / TILE) + Math.round(Math.cos(angle) * dist);
        const ty    = Math.floor(this.y / TILE) + Math.round(Math.sin(angle) * dist);
        this.searchPath = [{ x: tx, y: ty }];
      }

      const goal = this.searchPath[0];
      const arrived = this.moveToward(goal.x * TILE, goal.y * TILE);
      if (arrived) this.searchPath.shift();
    }

    // ── Mit Pathfinding bewegen ───────────────────────────
    moveWithPath(goalPX, goalPY, maxDist) {
      if (++this.pathTimer < 6) {
        // Folge aktuellem Pfad
        if (this.path && this.path.length > 0) {
          const next = this.path[0];
          const arrived = this.moveToward(next.x * TILE, next.y * TILE);
          if (arrived) this.path.shift();
          return;
        }
      }

      this.pathTimer = 0;
      const startTX = Math.floor(this.x / TILE);
      const startTY = Math.floor(this.y / TILE);
      const goalTX  = Math.floor(goalPX / TILE);
      const goalTY  = Math.floor(goalPY / TILE);

      const newPath = aStar(startTX, startTY, goalTX, goalTY, maxDist);
      if (newPath && newPath.length > 0) {
        this.path = newPath;
        const next = this.path[0];
        const arrived = this.moveToward(next.x * TILE, next.y * TILE);
        if (arrived) this.path.shift();
      } else {
        // Kein Pfad gefunden → Direktbewegung
        this.moveToward(goalPX, goalPY);
      }
    }

    // ── Sichtlinie prüfen ────────────────────────────────
    hasLineOfSight(plx, ply) {
      if (!MapSystem) return true;
      const steps = 10;
      const tx1 = Math.floor(this.x / TILE), ty1 = Math.floor(this.y / TILE);
      const tx2 = Math.floor(plx / TILE),    ty2 = Math.floor(ply / TILE);
      for (let i = 0; i <= steps; i++) {
        const t  = i / steps;
        const cx = Math.round(lerp(tx1, tx2, t));
        const cy = Math.round(lerp(ty1, ty2, t));
        if (MapSystem.isSolid && MapSystem.isSolid(MapSystem.getTileWorld(cx, cy))) return false;
      }
      return true;
    }

    // ── Ziel erreicht? ────────────────────────────────────
    reachedGoal(goal) {
      return Math.hypot(this.x - goal.px, this.y - goal.py) < TILE * 1.5;
    }

    // ── Alarm auslösen ────────────────────────────────────
    triggerAlarm(plx, ply, allBandits) {
      const alarmRadius = 15 * TILE;
      allBandits.forEach(other => {
        if (other === this) return;
        const d = Math.hypot(other.x - this.x, other.y - this.y);
        if (d < alarmRadius) {
          const delay = Math.floor(d / TILE * 3);
          other.receiveAlarm(plx, ply, delay);
        }
      });
    }

    // ── Kollision mit Spieler ────────────────────────────
    collides(plx, ply) {
      return Math.hypot(this.x - plx, this.y - ply) < TILE * 0.65;
    }
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ── Bandit-Manager ─────────────────────────────────────────
  let bandits = [];

  function spawnBandits(level, count, mapSpawnFn) {
    bandits = [];
    for (let i = 0; i < count; i++) {
      const pos = mapSpawnFn ? mapSpawnFn(i) : { x: 100 + i * 80, y: 100 };
      bandits.push(new Bandit(pos.x, pos.y, level, i));
    }
  }

  function updateAll(plx, ply, frozen, isNight, worldSpeedMult) {
    bandits.forEach(b => b.update(plx, ply, frozen, isNight, worldSpeedMult, bandits));
  }

  function checkCollisions(plx, ply) {
    return bandits.filter(b => b.collides(plx, ply));
  }

  function getBanditsInView(camX, camY, vw, vh) {
    return bandits.filter(b =>
      b.x > camX - TILE * 2 && b.x < camX + vw + TILE * 2 &&
      b.y > camY - TILE * 2 && b.y < camY + vh + TILE * 2
    );
  }

  function clear() { bandits = []; }

  // ── Public API ─────────────────────────────────────────────
  return {
    STATE,
    BANDIT_TYPES,
    Bandit,
    spawnBandits,
    updateAll,
    checkCollisions,
    getBanditsInView,
    clear,
    aStar,
    get bandits() { return bandits; },
  };

})();
