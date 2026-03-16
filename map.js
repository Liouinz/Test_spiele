// ═══════════════════════════════════════════════════════════════
//  COIN FOREST v5.1 – map.js
//  Chunk-System, prozedurale Map-Generierung, Biome, Dörfer, Berge
// ═══════════════════════════════════════════════════════════════

'use strict';

const MapSystem = (() => {

  // ── Tile-Konstanten ────────────────────────────────────────
  const T = {
    EMPTY:      0,
    WALL:       1,
    COIN:       2,
    TREE:       3,
    BUSH:       4,
    WATER:      5,
    ROCK:       6,
    MOUNTAIN:   7,
    MOUNTAIN2:  8,  // hoher Berg
    SNOWPEAK:   9,  // Schnee-Gipfel
    PATH:       10, // Pflasterweg
    HOUSE_WALL: 11,
    HOUSE_ROOF: 12,
    HOUSE_DOOR: 13,
    HOUSE_WIN:  14,
    FENCE:      15,
    WELL:       16,
    LANTERN:    17,
    DEEP_WATER: 18,
    SAND:       19, // Strand/Ufer
    TALL_GRASS: 20, // hohes Gras
    FLOWER:     21,
    STUMP:      22,
    RUIN_WALL:  23,
    ICE:        24, // gefrorenes Wasser (Winter)
    SNOW:       25, // Schnee-Boden
    MUD:        26, // Schlamm (nach Regen)
    // Power-Ups
    PU_SPEED:   30,
    PU_SHIELD:  31,
    PU_FREEZE:  32,
    PU_MAGNET:  33,
    PU_INVIS:   34,
    PU_BOMB:    35,
  };

  // Blocking-Tiles (nicht begehbar)
  const BLOCKING = new Set([
    T.WALL, T.TREE, T.MOUNTAIN, T.MOUNTAIN2, T.SNOWPEAK,
    T.HOUSE_WALL, T.FENCE, T.DEEP_WATER, T.WATER, T.ROCK, T.RUIN_WALL,
  ]);

  function isBlocking(tile) { return BLOCKING.has(tile); }
  function isSolid(tile)    { return tile === T.WALL || tile === T.MOUNTAIN || tile === T.MOUNTAIN2 || tile === T.SNOWPEAK || tile === T.HOUSE_WALL || tile === T.RUIN_WALL; }

  // ── Chunk-System ───────────────────────────────────────────
  const CHUNK_SIZE = 16;  // 16×16 Tiles pro Chunk
  const TILE_SIZE  = 40;  // Pixel pro Tile
  const LOAD_RADIUS = 5;  // Chunks um den Spieler herum laden

  let worldSeed   = 0;
  let worldWidth  = 0;  // in Tiles
  let worldHeight = 0;
  let chunks      = {};  // key: "cx,cy" → Chunk-Daten
  let chunkStates = {};  // key: "cx,cy" → gesammelte Items etc.

  // ── Seeded Random ──────────────────────────────────────────
  function makeRand(seed) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  // ── Perlin Noise (vereinfacht) ────────────────────────────
  function perlin(x, y, seed) {
    const s = seed || 0;
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = fade(xf), v = fade(yf);

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function grad(h, x, y) {
      h &= 3;
      const u2 = h < 2 ? x : y;
      const v2 = h < 2 ? y : x;
      return (h & 1 ? -u2 : u2) + (h & 2 ? -v2 : v2);
    }
    function hash(n) {
      let v = ((n + s) * 6364136223846793005 + 1442695040888963407) & 0xffffffff;
      return ((v >>> 0) >> 12) & 0xff;
    }

    const a  = hash(xi + hash(yi));
    const b  = hash(xi+1 + hash(yi));
    const c  = hash(xi + hash(yi+1));
    const d  = hash(xi+1 + hash(yi+1));

    const x1 = lerp(grad(a, xf,   yf),   grad(b, xf-1, yf),   u);
    const x2 = lerp(grad(c, xf,   yf-1), grad(d, xf-1, yf-1), u);
    return (lerp(x1, x2, v) + 1) / 2; // 0..1
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ── Biom-Bestimmung ────────────────────────────────────────
  function getBiome(cx, cy, rand) {
    const nx = cx / 12, ny = cy / 12;
    const n1 = perlin(nx * 1.3, ny * 1.3, worldSeed);
    const n2 = perlin(nx * 0.5, ny * 0.5, worldSeed + 1000);
    const val = (n1 * 0.6 + n2 * 0.4);

    // Rand der Welt = Berge
    const maxCX = Math.floor(worldWidth  / CHUNK_SIZE) - 1;
    const maxCY = Math.floor(worldHeight / CHUNK_SIZE) - 1;
    const edgeDist = Math.min(cx, cy, maxCX - cx, maxCY - cy);
    if (edgeDist <= 3) return 'mountain';

    if (val < 0.22)       return 'water';
    if (val < 0.30)       return 'sand';
    if (val < 0.42)       return 'plains';
    if (val < 0.58)       return 'forest';
    if (val < 0.68)       return 'dense_forest';
    if (val < 0.78)       return 'village';
    if (val < 0.88)       return 'mountain';
    if (val < 0.94)       return 'ruins';
    return 'plains';
  }

  // ── Chunk generieren ───────────────────────────────────────
  function generateChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (chunks[key]) return chunks[key];

    const tiles  = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const heights = new Float32Array(CHUNK_SIZE * CHUNK_SIZE); // 0..1 Höhe
    const rand   = makeRand(worldSeed ^ (cx * 73856093) ^ (cy * 19349663));
    const biome  = getBiome(cx, cy, rand);

    // Basis-Tiles setzen
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wy = cy * CHUNK_SIZE + ly;
        const idx = ly * CHUNK_SIZE + lx;

        // Höhenkarte
        const h = perlin(wx / 20, wy / 20, worldSeed + 500)
                + perlin(wx / 8,  wy / 8,  worldSeed + 600) * 0.3;
        heights[idx] = clamp(h, 0, 1);

        tiles[idx] = getBiomeTile(biome, wx, wy, h, rand);
      }
    }

    // Biom-spezifische Strukturen
    if (biome === 'village') generateVillage(tiles, cx, cy, rand);
    if (biome === 'ruins')   generateRuins(tiles, cx, cy, rand);

    // Coins platzieren
    placeCoins(tiles, biome, rand);
    // Power-Ups (selten)
    placePowerUps(tiles, rand);

    const chunk = { cx, cy, biome, tiles, heights };
    chunks[key]  = chunk;
    if (!chunkStates[key]) chunkStates[key] = { collected: new Set() };
    return chunk;
  }

  function getBiomeTile(biome, wx, wy, height, rand) {
    const n = perlin(wx / 6, wy / 6, worldSeed + 200);

    switch (biome) {
      case 'water':
        return height < 0.35 ? T.DEEP_WATER : T.WATER;

      case 'sand':
        if (height < 0.3) return T.WATER;
        return n > 0.7 ? T.ROCK : T.SAND;

      case 'plains':
        if (n > 0.92) return T.TALL_GRASS;
        if (n > 0.85) return T.FLOWER;
        if (n > 0.75 && rand() > 0.6) return T.BUSH;
        return T.EMPTY;

      case 'forest':
        if (n > 0.55) return T.TREE;
        if (n > 0.45) return T.BUSH;
        if (n > 0.3)  return T.TALL_GRASS;
        return T.EMPTY;

      case 'dense_forest':
        if (n > 0.35) return T.TREE;
        if (n > 0.25) return T.BUSH;
        return T.TALL_GRASS;

      case 'mountain':
        if (height > 0.82) return T.SNOWPEAK;
        if (height > 0.68) return T.MOUNTAIN2;
        if (height > 0.52) return T.MOUNTAIN;
        if (n > 0.6)       return T.ROCK;
        return T.EMPTY;

      case 'village':
        return T.EMPTY; // Dorf-Generator übernimmt

      case 'ruins':
        if (n > 0.7) return T.RUIN_WALL;
        if (n > 0.5) return T.ROCK;
        return T.EMPTY;

      default:
        return T.EMPTY;
    }
  }

  // ── Dorf-Generator ────────────────────────────────────────
  function generateVillage(tiles, cx, cy, rand) {
    const numHouses = 3 + Math.floor(rand() * 6);

    // Zentraler Platz (Brunnen)
    const wellX = 4 + Math.floor(rand() * 8);
    const wellY = 4 + Math.floor(rand() * 8);
    setTile(tiles, wellX, wellY, T.WELL);

    // Wege vom Brunnen aus
    drawPath(tiles, wellX, wellY, wellX, 0,              T.PATH, rand);
    drawPath(tiles, wellX, wellY, wellX, CHUNK_SIZE - 1, T.PATH, rand);
    drawPath(tiles, wellX, wellY, 0,    wellY,           T.PATH, rand);
    drawPath(tiles, wellX, wellY, CHUNK_SIZE-1, wellY,   T.PATH, rand);

    // Häuser platzieren
    const housePositions = [];
    for (let i = 0; i < numHouses; i++) {
      let hx, hy, tries = 0;
      do {
        hx = 1 + Math.floor(rand() * (CHUNK_SIZE - 5));
        hy = 1 + Math.floor(rand() * (CHUNK_SIZE - 5));
        tries++;
      } while (tooClose(housePositions, hx, hy, 4) && tries < 30);

      if (tries < 30) {
        const size = rand() > 0.6 ? 4 : 3;
        placeHouse(tiles, hx, hy, size, rand);
        housePositions.push({ x: hx, y: hy });

        // Laterne neben dem Haus
        if (hx + size + 1 < CHUNK_SIZE) setTile(tiles, hx + size + 1, hy, T.LANTERN);
      }
    }

    // Laternen an Wegen
    for (let i = 2; i < CHUNK_SIZE - 2; i += 4) {
      if (rand() > 0.5) setTile(tiles, wellX + 1, i, T.LANTERN);
      if (rand() > 0.5) setTile(tiles, i, wellY + 1, T.LANTERN);
    }
  }

  function placeHouse(tiles, hx, hy, size, rand) {
    // Wände
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        if (dx === 0 || dx === size-1 || dy === 0 || dy === size-1) {
          setTile(tiles, hx+dx, hy+dy, T.HOUSE_WALL);
        } else {
          setTile(tiles, hx+dx, hy+dy, T.HOUSE_ROOF);
        }
      }
    }
    // Tür vorne
    const doorX = hx + Math.floor(size / 2);
    setTile(tiles, doorX, hy + size - 1, T.HOUSE_DOOR);
    // Fenster
    if (size >= 4) {
      setTile(tiles, hx + 1, hy + 1, T.HOUSE_WIN);
      setTile(tiles, hx + size - 2, hy + 1, T.HOUSE_WIN);
    }
    // Zaun um Garten
    if (size === 4 && rand() > 0.4) {
      for (let i = -1; i <= size; i++) {
        if (hx+i >= 0 && hx+i < CHUNK_SIZE) setTile(tiles, hx+i, hy-1, T.FENCE);
      }
    }
  }

  function drawPath(tiles, x1, y1, x2, y2, tile, rand) {
    let x = x1, y = y1;
    while (x !== x2 || y !== y2) {
      if (inBounds(x, y)) {
        const cur = getTile(tiles, x, y);
        if (cur === T.EMPTY || cur === T.TALL_GRASS || cur === T.FLOWER) {
          setTile(tiles, x, y, tile);
        }
      }
      if (x < x2) x++;
      else if (x > x2) x--;
      if (y < y2) y++;
      else if (y > y2) y--;
    }
  }

  function tooClose(positions, x, y, minDist) {
    return positions.some(p => Math.abs(p.x - x) < minDist && Math.abs(p.y - y) < minDist);
  }

  // ── Ruinen-Generator ──────────────────────────────────────
  function generateRuins(tiles, cx, cy, rand) {
    const numWalls = 3 + Math.floor(rand() * 5);
    for (let i = 0; i < numWalls; i++) {
      const rx = 1 + Math.floor(rand() * (CHUNK_SIZE - 3));
      const ry = 1 + Math.floor(rand() * (CHUNK_SIZE - 3));
      const len = 2 + Math.floor(rand() * 5);
      const horiz = rand() > 0.5;
      for (let j = 0; j < len; j++) {
        const tx = horiz ? rx + j : rx;
        const ty = horiz ? ry : ry + j;
        if (inBounds(tx, ty) && rand() > 0.25) {
          setTile(tiles, tx, ty, T.RUIN_WALL);
        }
      }
    }
    // Mehr Coins in Ruinen
    for (let i = 0; i < 8; i++) {
      const rx = 1 + Math.floor(rand() * (CHUNK_SIZE - 2));
      const ry = 1 + Math.floor(rand() * (CHUNK_SIZE - 2));
      if (getTile(tiles, rx, ry) === T.EMPTY) setTile(tiles, rx, ry, T.COIN);
    }
  }

  // ── Coins & Power-Ups platzieren ──────────────────────────
  function placeCoins(tiles, biome, rand) {
    const density = biome === 'ruins' ? 0.12 : biome === 'plains' ? 0.06 : 0.04;
    for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE * density; i++) {
      const x = Math.floor(rand() * CHUNK_SIZE);
      const y = Math.floor(rand() * CHUNK_SIZE);
      if (getTile(tiles, x, y) === T.EMPTY) {
        setTile(tiles, x, y, T.COIN);
      }
    }
  }

  function placePowerUps(tiles, rand) {
    if (rand() > 0.15) return; // Nur 15% der Chunks haben ein Power-Up
    const puList = [T.PU_SPEED, T.PU_SHIELD, T.PU_FREEZE, T.PU_MAGNET, T.PU_INVIS, T.PU_BOMB];
    let tries = 0;
    while (tries++ < 30) {
      const x = 1 + Math.floor(rand() * (CHUNK_SIZE - 2));
      const y = 1 + Math.floor(rand() * (CHUNK_SIZE - 2));
      if (getTile(tiles, x, y) === T.EMPTY) {
        setTile(tiles, x, y, puList[Math.floor(rand() * puList.length)]);
        break;
      }
    }
  }

  // ── Tile-Zugriff ───────────────────────────────────────────
  function setTile(tiles, x, y, tile) {
    if (!inBounds(x, y)) return;
    tiles[y * CHUNK_SIZE + x] = tile;
  }

  function getTile(tiles, x, y) {
    if (!inBounds(x, y)) return T.WALL;
    return tiles[y * CHUNK_SIZE + x];
  }

  function inBounds(x, y) {
    return x >= 0 && x < CHUNK_SIZE && y >= 0 && y < CHUNK_SIZE;
  }

  // ── Weltkoordinaten → Chunk + Local ───────────────────────
  function worldToChunk(wx, wy) {
    return {
      cx: Math.floor(wx / CHUNK_SIZE),
      cy: Math.floor(wy / CHUNK_SIZE),
      lx: wx % CHUNK_SIZE,
      ly: wy % CHUNK_SIZE,
    };
  }

  function chunkToWorld(cx, cy, lx, ly) {
    return {
      wx: cx * CHUNK_SIZE + lx,
      wy: cy * CHUNK_SIZE + ly,
    };
  }

  // ── Tile aus Weltkoordinaten lesen ─────────────────────────
  function getTileWorld(wx, wy) {
    if (wx < 0 || wy < 0 || wx >= worldWidth || wy >= worldHeight) return T.MOUNTAIN;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cy = Math.floor(wy / CHUNK_SIZE);
    const lx = wx % CHUNK_SIZE;
    const ly = wy % CHUNK_SIZE;
    const key = `${cx},${cy}`;
    if (!chunks[key]) generateChunk(cx, cy);
    return chunks[key].tiles[ly * CHUNK_SIZE + lx];
  }

  function setTileWorld(wx, wy, tile) {
    if (wx < 0 || wy < 0 || wx >= worldWidth || wy >= worldHeight) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cy = Math.floor(wy / CHUNK_SIZE);
    const lx = wx % CHUNK_SIZE;
    const ly = wy % CHUNK_SIZE;
    const key = `${cx},${cy}`;
    if (!chunks[key]) generateChunk(cx, cy);
    chunks[key].tiles[ly * CHUNK_SIZE + lx] = tile;
  }

  function isBlockingWorld(wx, wy) {
    return isBlocking(getTileWorld(wx, wy));
  }

  // ── Pixel-Koordinaten → Tile ───────────────────────────────
  function pixelToTile(px, py) {
    return {
      tx: Math.floor(px / TILE_SIZE),
      ty: Math.floor(py / TILE_SIZE),
    };
  }

  function getTileAtPixel(px, py) {
    const { tx, ty } = pixelToTile(px, py);
    return getTileWorld(tx, ty);
  }

  function isBlockingAtPixel(px, py) {
    return isBlocking(getTileAtPixel(px, py));
  }

  // ── Chunk-Loading-Update ───────────────────────────────────
  function updateChunks(playerPX, playerPY) {
    const pcx = Math.floor(playerPX / (CHUNK_SIZE * TILE_SIZE));
    const pcy = Math.floor(playerPY / (CHUNK_SIZE * TILE_SIZE));

    // Chunks in Nähe laden
    for (let dy = -LOAD_RADIUS; dy <= LOAD_RADIUS; dy++) {
      for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
        const cx = pcx + dx, cy = pcy + dy;
        if (cx >= 0 && cy >= 0 &&
            cx < Math.ceil(worldWidth  / CHUNK_SIZE) &&
            cy < Math.ceil(worldHeight / CHUNK_SIZE)) {
          const key = `${cx},${cy}`;
          if (!chunks[key]) generateChunk(cx, cy);
        }
      }
    }

    // Weit entfernte Chunks entladen
    const unloadR = LOAD_RADIUS + 3;
    for (const key of Object.keys(chunks)) {
      const [cx, cy] = key.split(',').map(Number);
      if (Math.abs(cx - pcx) > unloadR || Math.abs(cy - pcy) > unloadR) {
        delete chunks[key];
      }
    }
  }

  // ── Chunk abrufen (für Rendering) ─────────────────────────
  function getChunksInView(camPX, camPY, viewW, viewH) {
    const startCX = Math.max(0, Math.floor(camPX / (CHUNK_SIZE * TILE_SIZE)) - 1);
    const startCY = Math.max(0, Math.floor(camPY / (CHUNK_SIZE * TILE_SIZE)) - 1);
    const endCX   = Math.min(
      Math.ceil(worldWidth  / CHUNK_SIZE),
      Math.ceil((camPX + viewW) / (CHUNK_SIZE * TILE_SIZE)) + 1
    );
    const endCY   = Math.min(
      Math.ceil(worldHeight / CHUNK_SIZE),
      Math.ceil((camPY + viewH) / (CHUNK_SIZE * TILE_SIZE)) + 1
    );

    const result = [];
    for (let cy = startCY; cy < endCY; cy++) {
      for (let cx = startCX; cx < endCX; cx++) {
        const key = `${cx},${cy}`;
        if (!chunks[key]) generateChunk(cx, cy);
        result.push(chunks[key]);
      }
    }
    return result;
  }

  // ── Item einsammeln (Coin, Power-Up) ───────────────────────
  function collectAt(wx, wy) {
    const tile = getTileWorld(wx, wy);
    if (tile === T.EMPTY || isBlocking(tile)) return null;
    setTileWorld(wx, wy, T.EMPTY);

    const cx = Math.floor(wx / CHUNK_SIZE);
    const cy = Math.floor(wy / CHUNK_SIZE);
    const key = `${cx},${cy}`;
    if (chunkStates[key]) chunkStates[key].collected.add(`${wx},${wy}`);

    return tile;
  }

  // ── Initialisierung ────────────────────────────────────────
  function init(seed, sizeInTiles) {
    worldSeed   = seed;
    worldWidth  = sizeInTiles;
    worldHeight = sizeInTiles;
    chunks      = {};
    chunkStates = {};
  }

  function getTotalCoinsInLoadedChunks() {
    let count = 0;
    for (const chunk of Object.values(chunks)) {
      for (const tile of chunk.tiles) {
        if (tile === T.COIN) count++;
      }
    }
    return count;
  }

  // ── Spawn-Punkt finden ────────────────────────────────────
  function findSpawnPoint() {
    // Nahe Mitte, leeres Tile
    const mx = Math.floor(worldWidth / 2);
    const my = Math.floor(worldHeight / 2);
    for (let r = 0; r < 20; r++) {
      for (let angle = 0; angle < 360; angle += 30) {
        const tx = mx + Math.round(Math.cos(angle * Math.PI / 180) * r);
        const ty = my + Math.round(Math.sin(angle * Math.PI / 180) * r);
        if (!isBlockingWorld(tx, ty)) {
          return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
        }
      }
    }
    return { x: (mx + 2) * TILE_SIZE, y: (my + 2) * TILE_SIZE };
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    T,
    CHUNK_SIZE,
    TILE_SIZE,
    BLOCKING,
    init,
    generateChunk,
    getTileWorld,
    setTileWorld,
    isBlockingWorld,
    isBlockingAtPixel,
    getTileAtPixel,
    pixelToTile,
    worldToChunk,
    chunkToWorld,
    updateChunks,
    getChunksInView,
    collectAt,
    findSpawnPoint,
    getTotalCoinsInLoadedChunks,
    isBlocking,
    isSolid,
    get worldWidth()  { return worldWidth; },
    get worldHeight() { return worldHeight; },
    get chunks()      { return chunks; },
  };

})();
