// ═══════════════════════════════════════════════════════════════
//  COIN FOREST v5.1 – graphics.js
//  2.5D Pixel-Art Renderer: Tiles, Charaktere, Beleuchtung
// ═══════════════════════════════════════════════════════════════

'use strict';

const Graphics = (() => {

  const TILE = 40;
  const HALF = TILE / 2;

  // ── Farb-Paletten ──────────────────────────────────────────
  const PAL = {
    // Gras – Sommer-Basis (wird per Jahreszeit getönt)
    grass: ['#2d5a1b','#3a7224','#243d10','#1e3508','#4a8a2a'],
    grassDetail: ['#3a7224','#4a9030','#2a6018'],
    grassTall: ['#3a8020','#4a9030','#2a6820'],
    flower: ['#ff6688','#ffaa00','#ffffff','#aa44ff','#44aaff'],

    // Gras-Halme (für Wind-Animation)
    bladeBase: '#2a6015',
    bladeTip:  '#4aaa25',

    // Wand / Stein
    wall: ['#5c4a2a','#3d3020','#7a6040','#2a1e10','#4a3820'],
    wallMoss: '#2a4a1a',

    // Baum
    tree: {
      trunkLight: '#8b5a2b', trunkDark: '#5c3a1a', trunkMid: '#6b4a20',
      leafDark:   '#1a3d0a', leafMid:  '#2a6a15', leafLight: '#3a8820',
      leafHighlight: '#4aaa28',
      shadow:    'rgba(0,0,0,0.25)',
    },

    // Wasser
    water: {
      deep:    '#0d2a4a', mid: '#1a4a7a', light: '#2266aa',
      foam:    '#88ccff', highlight: '#aaddff', shimmer: '#cceeff',
    },

    // Fels / Berg
    rock:  ['#6a6a6a','#888888','#4a4a4a','#9a9a9a','#3a3a3a'],
    mountain: ['#7a7060','#5a5040','#9a9080','#3a3028'],
    snow:  ['#eef4ff','#d8e8f8','#ffffff','#c8daf0'],

    // Berg-2.5D
    mtnFront: '#5a5040', mtnTop: '#8a8070', mtnSide: '#4a4030',
    mtnSnow: '#ddeeff',

    // Gebäude
    house: {
      wall:  '#c8a060', wallDark: '#a07840', wallLight: '#e0b870',
      roof:  '#8a3020', roofDark: '#6a2010', roofLight: '#aa4030',
      roofTop: '#cc5040',
      door:  '#5a3010', doorDark: '#3a1a08',
      win:   '#88ccff', winFrame: '#8a6040', winLight: '#cceeff',
      chimney: '#8a7060',
    },

    // Weg
    path: ['#a0855a','#b89060','#8a7048','#c0a070'],

    // Power-Ups
    pu: {
      speed:  '#facc15', shield: '#60a5fa',
      freeze: '#22d3ee', magnet: '#c084fc',
      invis:  '#ffffff', bomb:   '#ff8844',
    },

    // Spieler
    player: {
      skin:       '#e8d5b7', skinDark: '#c8a888',
      hair:       '#3a2010', hairLight: '#5a3820',
      shirt:      '#2a5a8a', shirtDark: '#1a3a5a', shirtLight: '#3a6a9a',
      pants:      '#3a3a5a', pantsDark: '#2a2a3a',
      shoes:      '#1a1008', shoesSole: '#2a2010',
      belt:       '#4a3010',
    },

    // Banditen
    bandit: {
      capeBase:  ['#4a1a1a','#1a3a1a','#1a1a4a','#3a1a4a','#4a2a10','#3a3a10'],
      capeDark:  ['#2a0808','#0a2008','#0a0a2a','#220a2a','#2a1508','#242408'],
      armorBase: '#6a6a7a', armorLight: '#8a8a9a', armorDark: '#4a4a5a',
      helmetBase: '#5a5a6a', helmetLight: '#7a7a8a',
      sword:  '#c8c8d8', swordEdge: '#e8e8f8', swordDark: '#8a8a9a',
      handle: '#8a5a30', guard: '#8a8a70',
      skin:   '#e0c8a0', hair: '#2a1808',
      belt:   '#4a3018', boots: '#2a1808',
      eye:    '#1a0808',
    },
  };

  // ── Offscreen-Canvas (für Tile-Caching) ───────────────────
  const tileCache = {};

  function getCachedTile(key, drawFn) {
    if (!tileCache[key]) {
      const c = document.createElement('canvas');
      c.width = TILE; c.height = TILE;
      drawFn(c.getContext('2d'));
      tileCache[key] = c;
    }
    return tileCache[key];
  }

  function clearCache() { Object.keys(tileCache).forEach(k => delete tileCache[k]); }

  // ── Gras-Tile ─────────────────────────────────────────────
  function drawGrass(ctx, tx, ty, wx, wy, season, windPhase, windSpeed) {
    const v = (wx * 7 + wy * 13) % 5;
    ctx.fillStyle = PAL.grass[v];
    ctx.fillRect(tx, ty, TILE, TILE);

    // Schachbrett-Variation
    if ((wx + wy) % 2 === 0) {
      ctx.fillStyle = PAL.grass[(v + 1) % 5];
      ctx.fillRect(tx + 2, ty + 2, TILE - 4, TILE - 4);
    }

    // Saisonale Tönung
    if (season === 'autumn') {
      ctx.fillStyle = 'rgba(80,40,0,0.12)';
      ctx.fillRect(tx, ty, TILE, TILE);
    } else if (season === 'winter') {
      ctx.fillStyle = 'rgba(200,220,255,0.55)';
      ctx.fillRect(tx, ty, TILE, TILE);
      return; // Kein Gras-Detail im Winter (Schnee)
    } else if (season === 'spring') {
      ctx.fillStyle = 'rgba(50,200,50,0.06)';
      ctx.fillRect(tx, ty, TILE, TILE);
    }

    // Gras-Detail-Pixel
    const seed = wx * 31337 + wy * 7919;
    const r1 = (seed * 1664525 + 1013904223) & 0xffff;
    const r2 = (r1 * 1664525 + 1013904223) & 0xffff;
    const r3 = (r2 * 1664525 + 1013904223) & 0xffff;

    // Statische Gras-Halme (Pixel-Detail)
    ctx.fillStyle = PAL.grassDetail[0];
    const px1 = tx + (r1 % 32) + 2, py1 = ty + (r2 % 28) + 6;
    ctx.fillRect(px1, py1, 2, 4);
    ctx.fillRect(px1 + 6, py1 - 2, 2, 5);

    ctx.fillStyle = PAL.grassDetail[1];
    const px2 = tx + (r3 % 28) + 5, py2 = ty + (r1 % 24) + 10;
    ctx.fillRect(px2, py2, 2, 3);

    // Blumen (Frühling/Sommer)
    if (season === 'spring' || season === 'summer') {
      if ((r1 % 8) === 0) {
        const fc = PAL.flower[r2 % PAL.flower.length];
        const fx = tx + (r1 % 30) + 5, fy = ty + (r2 % 26) + 7;
        ctx.fillStyle = '#ffff44';
        ctx.fillRect(fx, fy, 2, 2);
        ctx.fillStyle = fc;
        ctx.fillRect(fx - 2, fy, 2, 2);
        ctx.fillRect(fx + 2, fy, 2, 2);
        ctx.fillRect(fx, fy - 2, 2, 2);
        ctx.fillRect(fx, fy + 2, 2, 2);
      }
    }

    // Wind-Animation: obere Gras-Halme
    drawGrassBlades(ctx, tx, ty, wx, wy, windPhase, windSpeed, season);
  }

  function drawGrassBlades(ctx, tx, ty, wx, wy, windPhase, windSpeed, season) {
    if (season === 'winter') return;

    const windOff = Particles ? Particles.getGrassWind(wx, wy, windPhase, windSpeed) : 0;
    const bladeSeed = (wx * 4931 + wy * 6037) & 0xffff;

    // 3-5 Halme pro Tile
    const bladeCount = 3 + (bladeSeed % 3);
    for (let i = 0; i < bladeCount; i++) {
      const bx = tx + 4 + ((bladeSeed * (i + 1) * 2531) & 0xffff) % (TILE - 8);
      const by = ty + 20 + ((bladeSeed * (i + 1) * 3571) & 0xffff) % 16;
      const h  = 5 + (bladeSeed * (i + 3) & 0xf) % 6;
      const wo = windOff * (0.6 + i * 0.15);

      // Halm-Schatten
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(bx + 1, by - h + 1, 1, h);

      // Halm
      ctx.fillStyle = PAL.bladeBase;
      ctx.fillRect(bx, by - h, 1, h);
      // Halm-Spitze mit Wind-Offset
      ctx.fillStyle = PAL.bladeTip;
      ctx.fillRect(
        Math.round(bx + wo * 0.5),
        by - h - 2,
        2, 3
      );
    }
  }

  // ── Hohe Gras-Tile ────────────────────────────────────────
  function drawTallGrass(ctx, tx, ty, wx, wy, windPhase, windSpeed, season) {
    drawGrass(ctx, tx, ty, wx, wy, season, windPhase, windSpeed);
    if (season === 'winter') return;

    const windOff = Particles ? Particles.getGrassWind(wx, wy, windPhase, windSpeed) : 0;
    const seed = (wx * 5381 + wy * 9973) & 0xffff;

    for (let i = 0; i < 6; i++) {
      const bx = tx + 2 + (seed * (i + 1) * 1321 & 0xffff) % (TILE - 4);
      const by = ty + TILE - 6;
      const h  = 12 + (seed * (i * 2 + 1) & 0xf) % 10;
      const wo = windOff * (0.7 + i * 0.1);

      ctx.fillStyle = PAL.grassTall[i % 3];
      ctx.fillRect(bx, by - h, 2, h);
      ctx.fillStyle = PAL.bladeTip;
      ctx.fillRect(Math.round(bx + wo), by - h - 3, 3, 4);
    }
  }

  // ── Wand-Tile (2.5D Stein) ────────────────────────────────
  function drawWall(ctx, tx, ty) {
    // Basis
    ctx.fillStyle = PAL.wall[0];
    ctx.fillRect(tx, ty, TILE, TILE);

    // 2.5D Effekt: Oberkante heller (Licht von oben)
    ctx.fillStyle = PAL.wall[2];
    ctx.fillRect(tx, ty, TILE, 6);

    // Steinblock-Muster
    const blocks = [
      [0, 6, 19, 16], [20, 6, 20, 16],
      [0, 23, 24, 16], [25, 23, 15, 16],
    ];
    for (const [bx, by, bw, bh] of blocks) {
      ctx.fillStyle = PAL.wall[1];
      ctx.fillRect(tx + bx, ty + by, bw, bh);
      // Block-Highlight (oben links)
      ctx.fillStyle = PAL.wall[2];
      ctx.fillRect(tx + bx + 1, ty + by + 1, bw - 2, 2);
      ctx.fillRect(tx + bx + 1, ty + by + 1, 2, bh - 2);
      // Block-Schatten (unten rechts)
      ctx.fillStyle = PAL.wall[3];
      ctx.fillRect(tx + bx + bw - 2, ty + by + 2, 2, bh - 2);
      ctx.fillRect(tx + bx + 2, ty + by + bh - 2, bw - 2, 2);
    }

    // Moos-Details
    ctx.fillStyle = PAL.wallMoss;
    ctx.fillRect(tx + 2, ty + 36, 4, 2);
    ctx.fillRect(tx + 18, ty + 18, 3, 2);
    ctx.fillRect(tx + 30, ty + 28, 4, 2);

    // Schatten unten (2.5D)
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(tx, ty + TILE - 5, TILE, 5);
  }

  // ── Baum-Tile (2.5D, animiert) ────────────────────────────
  function drawTree(ctx, tx, ty, wx, wy, windPhase, windSpeed, season) {
    const sway = Math.sin(windPhase * 1.1 + wx * 0.55 + wy * 0.38) * 2.8 * windSpeed;

    // Stamm-Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(tx + HALF + 3, ty + TILE - 2, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stamm (2.5D: Vorderseite + Seite)
    // Seite (dunkler)
    ctx.fillStyle = PAL.tree.trunkDark;
    ctx.fillRect(tx + HALF + 4, ty + HALF + 2, 5, HALF - 2);
    // Vorderseite
    ctx.fillStyle = PAL.tree.trunkMid;
    ctx.fillRect(tx + HALF - 5, ty + HALF + 2, 10, HALF - 2);
    // Highlight
    ctx.fillStyle = PAL.tree.trunkLight;
    ctx.fillRect(tx + HALF - 4, ty + HALF + 3, 3, HALF - 4);

    // Baumkrone (3 Schichten für 2.5D-Tiefe)
    ctx.save();
    ctx.translate(tx + HALF + sway, ty + HALF - 4);

    // Tiefste Schicht (Schatten)
    ctx.fillStyle = PAL.tree.shadow;
    ctx.beginPath(); ctx.arc(2, 4, 16, 0, Math.PI * 2); ctx.fill();

    // Saisonale Kronfarbe
    let leafColors;
    switch (season) {
      case 'spring':  leafColors = ['#1f4d08','#2d7a10','#3d9918','#88cc44']; break;
      case 'summer':  leafColors = ['#1a3d0a','#2a6a15','#3a8820','#4a9a28']; break;
      case 'autumn':  leafColors = ['#8a3010','#b85020','#cc7030','#dd9040']; break;
      case 'winter':  leafColors = ['#2a3a2a','#384838','#445444','#d8e8f8']; break;
      default:        leafColors = ['#1a3d0a','#2a6a15','#3a8820','#4a9a28'];
    }

    // Hintergrund-Krone (groß, dunkel)
    ctx.fillStyle = leafColors[0];
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();

    // Mittel-Krone
    ctx.fillStyle = leafColors[1];
    ctx.beginPath(); ctx.arc(-2, -2, 13, 0, Math.PI * 2); ctx.fill();

    // Vorder-Krone (hell)
    ctx.fillStyle = leafColors[2];
    ctx.beginPath(); ctx.arc(-3, -4, 10, 0, Math.PI * 2); ctx.fill();

    // Highlight
    ctx.fillStyle = leafColors[3];
    ctx.beginPath(); ctx.arc(-6, -7, 5, 0, Math.PI * 2); ctx.fill();

    // Winter-Schnee auf Krone
    if (season === 'winter') {
      ctx.fillStyle = 'rgba(220,235,255,0.7)';
      ctx.beginPath(); ctx.arc(-2, -6, 9, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-4, -8, 5, Math.PI, 0); ctx.fill();
    }

    // Herbst-Blätter-Detail (fallende Blatt-Textur)
    if (season === 'autumn' && Math.random() < 0.005) {
      Particles && Particles.leafFall(tx + HALF + sway, ty + HALF - 8, 'autumn');
    }

    ctx.restore();
  }

  // ── Busch-Tile ────────────────────────────────────────────
  function drawBush(ctx, tx, ty, season) {
    // Boden
    ctx.fillStyle = PAL.grass[0];
    ctx.fillRect(tx, ty, TILE, TILE);

    let col1 = '#1e4d10', col2 = '#2a6a18', col3 = '#3a8020';
    if (season === 'autumn') { col1 = '#6a3008'; col2 = '#8a5010'; col3 = '#aa6818'; }
    if (season === 'winter') { col1 = '#283828'; col2 = '#344434'; col3 = '#ddeeff'; }

    // 2.5D: Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(tx + 22, ty + 32, 15, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Busch-Kugeln
    ctx.fillStyle = col1;
    ctx.beginPath(); ctx.arc(tx + 20, ty + 24, 14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(tx + 30, ty + 26, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(tx + 12, ty + 26, 10, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = col2;
    ctx.beginPath(); ctx.arc(tx + 20, ty + 22, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(tx + 28, ty + 20, 8, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = col3;
    ctx.beginPath(); ctx.arc(tx + 16, ty + 18, 6, 0, Math.PI * 2); ctx.fill();

    if (season === 'winter') {
      ctx.fillStyle = 'rgba(220,235,255,0.6)';
      ctx.beginPath(); ctx.arc(tx + 20, ty + 18, 10, Math.PI, 0); ctx.fill();
    }
  }

  // ── Wasser-Tile (3-Ebenen-Animation) ─────────────────────
  function drawWater(ctx, tx, ty, tick, wx, wy, season) {
    // Tiefster Grund
    ctx.fillStyle = season === 'winter' ? '#8aaabb' : PAL.water.deep;
    ctx.fillRect(tx, ty, TILE, TILE);

    if (season === 'winter') {
      // Eis-Textur
      ctx.fillStyle = 'rgba(180,210,240,0.8)';
      ctx.fillRect(tx + 2, ty + 2, TILE - 4, TILE - 4);
      // Risse
      ctx.strokeStyle = 'rgba(150,190,220,0.6)';
      ctx.lineWidth = 1;
      const seed = wx * 1337 + wy * 7919;
      const rx1 = tx + (seed & 0x1f) + 4, ry1 = ty + ((seed >> 5) & 0x1f) + 4;
      ctx.beginPath();
      ctx.moveTo(rx1, ry1);
      ctx.lineTo(rx1 + 12, ry1 + 8);
      ctx.lineTo(rx1 + 8, ry1 + 18);
      ctx.stroke();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(tx + 4, ty + 4, 8, 3);
      return;
    }

    // Wellen-Ebene 1
    const w1 = Math.sin(tick * 0.04 + wx * 0.3 + wy * 0.2) * 3;
    ctx.fillStyle = PAL.water.mid;
    for (let i = 0; i < 3; i++) {
      const wy2 = ty + 8 + i * 11 + w1;
      ctx.fillRect(tx + 3, wy2, TILE - 6, 3);
    }

    // Wellen-Ebene 2
    const w2 = Math.sin(tick * 0.06 + wx * 0.4 - wy * 0.3 + 1.5) * 2;
    ctx.fillStyle = PAL.water.light;
    for (let i = 0; i < 2; i++) {
      const wy2 = ty + 14 + i * 14 + w2;
      ctx.fillRect(tx + 6, wy2, TILE - 12, 2);
    }

    // Schaum-Rand oben
    ctx.fillStyle = PAL.water.foam;
    ctx.fillRect(tx + 4, ty + 3, TILE - 8, 2);
    ctx.fillRect(tx + 3, ty + 5, 3, 2);
    ctx.fillRect(tx + TILE - 6, ty + 5, 3, 2);

    // Licht-Reflexionen
    const shimmer = Math.sin(tick * 0.1 + wx * 0.8 + wy * 0.6);
    if (shimmer > 0.6) {
      ctx.fillStyle = PAL.water.shimmer;
      const sx = tx + 8 + Math.floor(shimmer * 10) % 20;
      const sy = ty + 10 + Math.floor(shimmer * 8) % 18;
      ctx.fillRect(sx, sy, 4, 2);
      ctx.fillRect(sx + 8, sy + 6, 3, 2);
    }

    // Seerose (selten)
    const rseed = wx * 2654435761 + wy * 2246822519;
    if ((rseed & 0x1f) === 0) {
      const lx = tx + (rseed >> 5 & 0x1f) % 24 + 8;
      const ly = ty + (rseed >> 10 & 0x1f) % 24 + 8;
      ctx.fillStyle = '#2d8a20';
      ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8a8b0';
      ctx.beginPath(); ctx.arc(lx, ly - 1, 3, 0, Math.PI * 2); ctx.fill();
    }

    Particles && Particles.spawnWaterEffects(tx + HALF, ty + HALF);
  }

  // ── Fels-Tile (2.5D) ─────────────────────────────────────
  function drawRock(ctx, tx, ty) {
    ctx.fillStyle = PAL.grass[0]; ctx.fillRect(tx, ty, TILE, TILE);

    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(tx + 22, ty + 30, 14, 5, 0, 0, Math.PI * 2); ctx.fill();

    // 2.5D Fels: Seite
    ctx.fillStyle = PAL.rock[4];
    ctx.beginPath();
    ctx.moveTo(tx + 8,  ty + 28);
    ctx.lineTo(tx + 32, ty + 28);
    ctx.lineTo(tx + 36, ty + 34);
    ctx.lineTo(tx + 4,  ty + 34);
    ctx.closePath(); ctx.fill();

    // Oberseite
    ctx.fillStyle = PAL.rock[0];
    ctx.beginPath();
    ctx.moveTo(tx + 10, ty + 16);
    ctx.lineTo(tx + 30, ty + 14);
    ctx.lineTo(tx + 32, ty + 28);
    ctx.lineTo(tx + 8,  ty + 28);
    ctx.closePath(); ctx.fill();

    // Highlight
    ctx.fillStyle = PAL.rock[3];
    ctx.beginPath();
    ctx.moveTo(tx + 11, ty + 17);
    ctx.lineTo(tx + 22, ty + 16);
    ctx.lineTo(tx + 22, ty + 20);
    ctx.lineTo(tx + 11, ty + 21);
    ctx.closePath(); ctx.fill();
  }

  // ── Berg-Tiles (2.5D Schichten) ───────────────────────────
  function drawMountain(ctx, tx, ty, level = 1, season) {
    // Basis-Boden
    ctx.fillStyle = level === 2 ? PAL.mountain[1] : PAL.mountain[0];
    ctx.fillRect(tx, ty, TILE, TILE);

    // 2.5D Bergseite
    ctx.fillStyle = PAL.mtnSide;
    ctx.beginPath();
    ctx.moveTo(tx,      ty + TILE);
    ctx.lineTo(tx,      ty + TILE * 0.3);
    ctx.lineTo(tx + 10, ty + TILE * 0.15);
    ctx.lineTo(tx + TILE, ty + TILE * 0.2);
    ctx.lineTo(tx + TILE, ty + TILE);
    ctx.closePath(); ctx.fill();

    // Bergfront
    ctx.fillStyle = level === 2 ? PAL.mountain[1] : PAL.mtnTop;
    ctx.beginPath();
    ctx.moveTo(tx + 5,      ty + TILE * 0.8);
    ctx.lineTo(tx + HALF,   ty + TILE * 0.1);
    ctx.lineTo(tx + TILE - 5, ty + TILE * 0.8);
    ctx.closePath(); ctx.fill();

    // Fels-Details
    ctx.fillStyle = PAL.mountain[3];
    ctx.fillRect(tx + HALF - 3, ty + TILE * 0.35, 3, 6);
    ctx.fillRect(tx + HALF + 5, ty + TILE * 0.5,  3, 5);

    // Schneekappe
    if (level >= 2 || season === 'winter') {
      ctx.fillStyle = season === 'winter' ? '#eef4ff' : PAL.mtnSnow;
      ctx.beginPath();
      ctx.moveTo(tx + HALF - 8, ty + TILE * 0.25);
      ctx.lineTo(tx + HALF,     ty + TILE * 0.1);
      ctx.lineTo(tx + HALF + 8, ty + TILE * 0.25);
      ctx.closePath(); ctx.fill();
    }

    // Schatten rechts
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.moveTo(tx + HALF,      ty + TILE * 0.1);
    ctx.lineTo(tx + TILE - 5,  ty + TILE * 0.8);
    ctx.lineTo(tx + TILE,      ty + TILE * 0.8);
    ctx.lineTo(tx + TILE,      ty + TILE * 0.2);
    ctx.closePath(); ctx.fill();
  }

  // ── Weg-Tile (Pflaster) ───────────────────────────────────
  function drawPath(ctx, tx, ty) {
    ctx.fillStyle = PAL.path[0]; ctx.fillRect(tx, ty, TILE, TILE);

    const stones = [
      [2, 2, 16, 14], [20, 2, 18, 14], [2, 18, 20, 18], [24, 18, 14, 18],
    ];
    for (const [sx, sy, sw, sh] of stones) {
      ctx.fillStyle = PAL.path[1];
      ctx.fillRect(tx + sx, ty + sy, sw, sh);
      ctx.fillStyle = PAL.path[2];
      ctx.fillRect(tx + sx + 1, ty + sy + 1, sw - 2, 2);
      ctx.fillStyle = PAL.path[3];
      ctx.fillRect(tx + sx + sw - 2, ty + sy + sh - 2, 2, 2);
    }
  }

  // ── Haus-Tiles (2.5D) ─────────────────────────────────────
  function drawHouseWall(ctx, tx, ty) {
    const h = PAL.house;
    ctx.fillStyle = h.wallDark; ctx.fillRect(tx, ty, TILE, TILE);

    // 2.5D Seite
    ctx.fillStyle = h.wallDark;
    ctx.fillRect(tx, ty, 6, TILE);

    // Front
    ctx.fillStyle = h.wall;
    ctx.fillRect(tx + 6, ty, TILE - 6, TILE);
    ctx.fillStyle = h.wallLight;
    ctx.fillRect(tx + 6, ty, TILE - 6, 4);
    ctx.fillRect(tx + 6, ty, 4, TILE);

    // Mauerwerk
    for (let row = 0; row < 3; row++) {
      const offset = (row % 2) * 10;
      for (let col = 0; col < 3; col++) {
        ctx.strokeStyle = h.wallDark;
        ctx.lineWidth = 1;
        ctx.strokeRect(tx + 8 + offset + col * 12, ty + 8 + row * 12, 10, 10);
      }
    }
  }

  function drawHouseRoof(ctx, tx, ty) {
    const h = PAL.house;
    ctx.fillStyle = h.roofDark; ctx.fillRect(tx, ty, TILE, TILE);

    // Dach-Schindeln
    for (let row = 0; row < 4; row++) {
      const y2 = ty + row * 10;
      for (let col = 0; col < 4; col++) {
        const offset = (row % 2) * 5;
        ctx.fillStyle = row % 2 === 0 ? h.roof : h.roofLight;
        ctx.fillRect(tx + col * 10 + offset, y2, 9, 9);
      }
    }

    // Dachkante (2.5D)
    ctx.fillStyle = h.roofTop;
    ctx.fillRect(tx, ty, TILE, 5);
  }

  function drawHouseDoor(ctx, tx, ty) {
    drawHouseWall(ctx, tx, ty);
    const h = PAL.house;
    const dx = tx + 12, dy = ty + 16, dw = 16, dh = 24;
    ctx.fillStyle = h.door;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.fillStyle = h.doorDark;
    ctx.fillRect(dx, dy, dw, 4);
    ctx.fillRect(dx, dy, 3, dh);
    ctx.fillStyle = '#cc9944';
    ctx.fillRect(dx + dw - 6, dy + dh / 2 - 2, 4, 4);
    ctx.beginPath();
    ctx.arc(dx + dw / 2, dy, dw / 2, Math.PI, 0);
    ctx.fillStyle = h.door;
    ctx.fill();
  }

  function drawHouseWindow(ctx, tx, ty) {
    drawHouseWall(ctx, tx, ty);
    const h = PAL.house;
    const wx = tx + 8, wy = ty + 8, ww = 24, wh = 20;
    ctx.fillStyle = h.winFrame;
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = h.win;
    ctx.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
    ctx.fillStyle = h.winLight;
    ctx.fillRect(wx + 4, wy + 4, 8, 6);
    ctx.fillStyle = h.winFrame;
    ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
    ctx.fillRect(wx, wy + wh / 2 - 1, ww, 2);
  }

  function drawWell(ctx, tx, ty) {
    ctx.fillStyle = PAL.grass[0]; ctx.fillRect(tx, ty, TILE, TILE);
    // Basis
    ctx.fillStyle = PAL.wall[0];
    ctx.fillRect(tx + 8, ty + 18, 24, 20);
    // Wasser
    ctx.fillStyle = PAL.water.mid;
    ctx.fillRect(tx + 10, ty + 20, 20, 16);
    ctx.fillStyle = PAL.water.shimmer;
    ctx.fillRect(tx + 12, ty + 22, 8, 3);
    // Holzrahmen
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(tx + 6, ty + 16, 28, 4);
    ctx.fillRect(tx + 8, ty + 10, 4, 8);
    ctx.fillRect(tx + 28, ty + 10, 4, 8);
    ctx.fillRect(tx + 10, ty + 8, 20, 4);
    ctx.fillStyle = '#6b4020';
    ctx.fillRect(tx + 17, ty + 8, 6, 12);
  }

  function drawFence(ctx, tx, ty) {
    ctx.fillStyle = PAL.grass[0]; ctx.fillRect(tx, ty, TILE, TILE);
    ctx.fillStyle = '#a07840';
    ctx.fillRect(tx + 2,       ty + 16, 4, 22);
    ctx.fillRect(tx + TILE - 6, ty + 16, 4, 22);
    ctx.fillRect(tx + 2,       ty + 18, TILE - 4, 4);
    ctx.fillRect(tx + 2,       ty + 28, TILE - 4, 4);
    ctx.fillStyle = '#c09050';
    ctx.fillRect(tx + 3, ty + 17, 2, 22);
  }

  function drawLantern(ctx, tx, ty, tick, isNight) {
    ctx.fillStyle = PAL.grass[0]; ctx.fillRect(tx, ty, TILE, TILE);
    // Pfahl
    ctx.fillStyle = '#4a4a5a';
    ctx.fillRect(tx + HALF - 2, ty + 12, 4, 28);
    // Laternenkopf
    ctx.fillStyle = '#5a5a6a';
    ctx.fillRect(tx + HALF - 7, ty + 8,  14, 10);
    ctx.fillRect(tx + HALF - 5, ty + 6,  10, 4);
    // Licht
    const glow = isNight ? (0.7 + 0.3 * Math.sin(tick * 0.12)) : 0.15;
    ctx.fillStyle = `rgba(255,200,80,${glow})`;
    ctx.fillRect(tx + HALF - 5, ty + 9, 10, 8);
    if (isNight) {
      const lg = ctx.createRadialGradient(tx + HALF, ty + 13, 0, tx + HALF, ty + 13, 20);
      lg.addColorStop(0, `rgba(255,200,50,${glow * 0.4})`);
      lg.addColorStop(1, 'rgba(255,200,50,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.arc(tx + HALF, ty + 13, 20, 0, Math.PI * 2); ctx.fill();
    }
    if (isNight && Math.random() < 0.02) {
      Particles && Particles.smokeChimney(tx + HALF, ty + 8);
    }
  }

  // ── Coin (animiert) ───────────────────────────────────────
  function drawCoin(ctx, tx, ty, tick, wx, wy) {
    ctx.fillStyle = PAL.grass[0]; ctx.fillRect(tx, ty, TILE, TILE);

    const phase = tick * 0.08 + wx * 0.7 + wy * 1.1;
    const sc    = 0.82 + 0.18 * Math.sin(phase);
    const cx    = tx + HALF, cy = ty + HALF;
    const rad   = TILE * 0.28 * sc;

    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(cx + 2, cy + 4, rad * 0.8, rad * 0.3, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10;

    // Äußerer Ring
    ctx.fillStyle = '#c8a000';
    ctx.beginPath(); ctx.arc(cx, cy, rad + 2.5, 0, Math.PI * 2); ctx.fill();

    // Hauptkörper
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();

    // Inneres
    ctx.fillStyle = '#ffec6e';
    ctx.beginPath(); ctx.arc(cx - rad * 0.08, cy - rad * 0.08, rad * 0.65, 0, Math.PI * 2); ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,240,0.85)';
    ctx.beginPath(); ctx.arc(cx - rad * 0.3, cy - rad * 0.35, rad * 0.28, 0, Math.PI * 2); ctx.fill();

    // Münz-Symbol (C)
    ctx.fillStyle = '#b89000';
    ctx.font = `bold ${Math.floor(rad * 1.2)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', cx, cy + 1);

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── Power-Up ──────────────────────────────────────────────
  function drawPowerUp(ctx, tx, ty, tick, tileType) {
    const T = MapSystem ? MapSystem.T : { PU_SPEED:30,PU_SHIELD:31,PU_FREEZE:32,PU_MAGNET:33,PU_INVIS:34,PU_BOMB:35 };
    const defs = {
      [T.PU_SPEED]:  { icon:'⚡', color: PAL.pu.speed  },
      [T.PU_SHIELD]: { icon:'🛡', color: PAL.pu.shield },
      [T.PU_FREEZE]: { icon:'❄', color: PAL.pu.freeze },
      [T.PU_MAGNET]: { icon:'🧲', color: PAL.pu.magnet },
      [T.PU_INVIS]:  { icon:'👻', color: PAL.pu.invis  },
      [T.PU_BOMB]:   { icon:'💣', color: PAL.pu.bomb   },
    };
    const def = defs[tileType];
    if (!def) return;

    ctx.fillStyle = PAL.grass[0]; ctx.fillRect(tx, ty, TILE, TILE);

    const phase = tick * 0.1;
    const sc    = 0.82 + 0.18 * Math.sin(phase);
    const cx    = tx + HALF, cy = ty + HALF;

    ctx.save();
    ctx.shadowColor = def.color; ctx.shadowBlur = 14;

    // Hintergrund-Glow
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(phase);
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.44 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Rotierende Punkte
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i + tick * 0.04;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * TILE * 0.3 * sc, cy + Math.sin(a) * TILE * 0.3 * sc, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.font = `${Math.floor(TILE * 0.38 * sc)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, cx, cy);
    ctx.restore();
  }

  // ── Spieler (Pixel-Art, animiert) ─────────────────────────
  function drawPlayer(ctx, x, y, inv, animFrame, shielded, speedy, invisible, tick) {
    if (inv > 0 && tick % 7 < 3) return;
    if (invisible && tick % 12 < 6) return;

    const p = PAL.player;
    const u = TILE / 10;
    const legSwing = Math.sin(animFrame * Math.PI / 2);
    const armSwing = Math.sin(animFrame * Math.PI / 2 + Math.PI);

    ctx.save();

    // Effekt-Glow
    if (shielded) {
      ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 16;
    } else if (speedy) {
      ctx.shadowColor = '#facc15'; ctx.shadowBlur = 10;
      // Speed-Linien
      for (let i = 1; i <= 4; i++) {
        ctx.globalAlpha = 0.1 * (5 - i);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(x - i * 7, y + u * 3, u * 3, u * 5);
      }
      ctx.globalAlpha = 1;
    } else if (invisible) {
      ctx.globalAlpha = 0.4;
    } else {
      ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = 6;
    }

    // Bodenschatten
    ctx.globalAlpha = (invisible ? 0.2 : 0.22);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x + HALF, y + TILE - 3, u * 4, u * 1.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = invisible ? 0.4 : 1;

    // Schuhe
    ctx.fillStyle = p.shoes;
    ctx.fillRect(x + u*2,   y + u*8.5 + legSwing * u * 1.2, u*2.5, u*1.8);
    ctx.fillRect(x + u*5.5, y + u*8.5 - legSwing * u * 1.2, u*2.5, u*1.8);
    ctx.fillStyle = p.shoesSole;
    ctx.fillRect(x + u*2,   y + u*10  + legSwing * u * 1.2, u*2.5, u*0.5);
    ctx.fillRect(x + u*5.5, y + u*10  - legSwing * u * 1.2, u*2.5, u*0.5);

    // Hosen
    ctx.fillStyle = p.pantsDark;
    ctx.fillRect(x + u*2,   y + u*6.5 + legSwing * u * 0.6, u*2.5, u*2.2);
    ctx.fillRect(x + u*5.5, y + u*6.5 - legSwing * u * 0.6, u*2.5, u*2.2);
    ctx.fillStyle = p.pants;
    ctx.fillRect(x + u*2.3, y + u*6.5 + legSwing * u * 0.6, u*1.5, u*2);
    ctx.fillRect(x + u*5.8, y + u*6.5 - legSwing * u * 0.6, u*1.5, u*2);

    // Körper / Hemd
    ctx.fillStyle = p.shirtDark;
    ctx.fillRect(x + u*2, y + u*3, u*6, u*4);
    ctx.fillStyle = p.shirt;
    ctx.fillRect(x + u*2.3, y + u*3.2, u*5.4, u*3.5);
    ctx.fillStyle = p.shirtLight;
    ctx.fillRect(x + u*2.3, y + u*3.2, u*2, u*1.5);
    // Gürtel
    ctx.fillStyle = p.belt;
    ctx.fillRect(x + u*2, y + u*6.5, u*6, u*0.8);

    // Arme
    ctx.fillStyle = p.skinDark;
    ctx.fillRect(x + u*0.8, y + u*3.5 + armSwing * u * 1.2, u*1.8, u*3.2);
    ctx.fillRect(x + u*7.4, y + u*3.5 - armSwing * u * 1.2, u*1.8, u*3.2);
    ctx.fillStyle = p.skin;
    ctx.fillRect(x + u*1,   y + u*3.5 + armSwing * u * 1.2, u*1.2, u*3);
    ctx.fillRect(x + u*7.6, y + u*3.5 - armSwing * u * 1.2, u*1.2, u*3);

    // Hals
    ctx.fillStyle = p.skin;
    ctx.fillRect(x + u*4, y + u*2, u*2, u*1.5);

    // Kopf
    ctx.fillStyle = p.skinDark;
    ctx.fillRect(x + u*2.5, y, u*5, u*3.5);
    ctx.fillStyle = p.skin;
    ctx.fillRect(x + u*2.8, y + u*0.3, u*4.4, u*3);

    // Haare
    ctx.fillStyle = p.hair;
    ctx.fillRect(x + u*2.5, y, u*5, u*1);
    ctx.fillRect(x + u*2.5, y, u*1, u*1.8);
    ctx.fillStyle = p.hairLight;
    ctx.fillRect(x + u*3,   y, u*1.5, u*0.8);

    // Augen
    ctx.fillStyle = '#334';
    ctx.fillRect(x + u*3.6, y + u*1.4, u*0.9, u*0.9);
    ctx.fillRect(x + u*5.2, y + u*1.4, u*0.9, u*0.9);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + u*3.6, y + u*1.2, u*0.4, u*0.4);
    ctx.fillRect(x + u*5.2, y + u*1.2, u*0.4, u*0.4);

    // Shield-Aura
    if (shielded) {
      ctx.strokeStyle = '#60a5fa88';
      ctx.lineWidth = 2.5;
      const pulse = 0.92 + 0.08 * Math.sin(tick * 0.2);
      ctx.beginPath(); ctx.arc(x + HALF, y + HALF, HALF * 1.15 * pulse, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── Bandit ────────────────────────────────────────────────
  function drawBandit(ctx, bandit, frozen, tick) {
    const { x, y, idx, mode, animFrame, swordSwing } = bandit;
    const u = TILE / 10;
    const b = PAL.bandit;

    const legSwing = mode === 3 ? Math.sin(animFrame * Math.PI / 2) * 1.3 : Math.sin(animFrame * Math.PI / 2) * 0.7;
    const bob = Math.sin(tick * 0.1 + idx * 1.7) * 1.5;

    const capeBase  = b.capeBase[idx % b.capeBase.length];
    const capeDark  = b.capeDark[idx % b.capeDark.length];

    ctx.save();

    // Frozen-Overlay
    if (frozen) { ctx.fillStyle = 'rgba(50,200,255,0.3)'; }

    // Glow je nach Zustand
    if (mode === 3) { // Chase
      ctx.shadowColor = frozen ? '#22d3ee' : '#cc0000';
      ctx.shadowBlur  = 14;
    } else if (mode === 1 || mode === 2) {
      ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 8;
    } else {
      ctx.shadowColor = capeBase; ctx.shadowBlur = 3;
    }

    const yOff = bob;

    // Bodenschatten
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x + HALF, y + TILE - 2, u * 4.5, u * 1.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = frozen ? 0.7 : 1;

    // Stiefel
    ctx.fillStyle = b.boots;
    ctx.fillRect(x + u*2,   y + u*8 + yOff + legSwing * u,    u*2.5, u*2.2);
    ctx.fillRect(x + u*5.5, y + u*8 + yOff - legSwing * u,    u*2.5, u*2.2);

    // Hosen
    ctx.fillStyle = capeDark;
    ctx.fillRect(x + u*2,   y + u*6 + yOff + legSwing * u * 0.6, u*2.5, u*2.5);
    ctx.fillRect(x + u*5.5, y + u*6 + yOff - legSwing * u * 0.6, u*2.5, u*2.5);

    // Umhang / Körper
    ctx.fillStyle = capeDark;
    ctx.fillRect(x + u*1.5, y + u*3 + yOff, u*7, u*5);
    ctx.fillStyle = capeBase;
    ctx.fillRect(x + u*2,   y + u*3.3 + yOff, u*6, u*4.5);

    // Rüstungs-Details (Krieger-Typ)
    if (idx % 4 === 0 || idx % 4 === 2) {
      ctx.fillStyle = b.armorBase;
      ctx.fillRect(x + u*2.5, y + u*3.5 + yOff, u*5, u*3.5);
      ctx.fillStyle = b.armorLight;
      ctx.fillRect(x + u*2.8, y + u*3.8 + yOff, u*2, u*1.5);
      ctx.fillRect(x + u*5,   y + u*3.8 + yOff, u*2, u*1.5);
    }

    // Gürtel
    ctx.fillStyle = b.belt;
    ctx.fillRect(x + u*2, y + u*7 + yOff, u*6, u*0.8);

    // Arme
    ctx.fillStyle = capeDark;
    ctx.fillRect(x + u*0.5, y + u*3.5 + yOff, u*2, u*3.5);
    ctx.fillRect(x + u*7.5, y + u*3.5 + yOff, u*2, u*3.5);

    // Schwert (rechte Hand)
    const swingAngle = swordSwing || 0;
    ctx.save();
    ctx.translate(x + u * 9.5, y + u * 5 + yOff);
    ctx.rotate(swingAngle - 0.4);
    // Griff
    ctx.fillStyle = b.handle;
    ctx.fillRect(-u*0.6, 0, u*1.2, u*2.5);
    // Garde
    ctx.fillStyle = b.guard;
    ctx.fillRect(-u*1.5, -u*0.3, u*3, u*0.8);
    // Klinge
    ctx.fillStyle = b.sword;
    ctx.fillRect(-u*0.4, -u*5, u*0.8, u*5);
    // Schneide
    ctx.fillStyle = b.swordEdge;
    ctx.fillRect(-u*0.4, -u*5, u*0.3, u*5);
    // Schatten
    ctx.fillStyle = b.swordDark;
    ctx.fillRect(u*0.1, -u*5, u*0.3, u*5);
    ctx.restore();

    // Kopf
    ctx.fillStyle = b.skin;
    ctx.fillRect(x + u*3, y + u*0.5 + yOff, u*4, u*3);

    // Helm (Krieger) oder Kapuze (andere)
    if (idx % 4 === 0) {
      ctx.fillStyle = b.helmetBase;
      ctx.fillRect(x + u*2.5, y + yOff - u*0.5, u*5, u*2);
      ctx.fillStyle = b.helmetLight;
      ctx.fillRect(x + u*2.5, y + yOff - u*0.5, u*5, u*0.6);
      ctx.fillStyle = b.helmetBase;
      ctx.fillRect(x + u*3, y + u*1 + yOff, u*4, u*1.5);
    } else {
      ctx.fillStyle = capeDark;
      ctx.fillRect(x + u*2.5, y + yOff, u*5, u*1.8);
      ctx.fillStyle = capeBase;
      ctx.fillRect(x + u*3,   y + yOff, u*4, u*1.5);
    }

    // Augen
    ctx.fillStyle = b.eye;
    ctx.fillRect(x + u*3.8, y + u*1.2 + yOff, u*0.9, u*0.9);
    ctx.fillRect(x + u*5.3, y + u*1.2 + yOff, u*0.9, u*0.9);
    ctx.fillStyle = '#ff2222';
    ctx.fillRect(x + u*3.9, y + u*1.3 + yOff, u*0.5, u*0.5);
    ctx.fillRect(x + u*5.4, y + u*1.3 + yOff, u*0.5, u*0.5);

    // Zustands-Indikatoren
    if (mode === 0) { // Schlafen - ZZZ
      if (Math.floor(tick / 40) % 2 === 0) {
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('z', x + TILE - 2, y + yOff + 2);
      }
    } else if (mode === 2 && bandit.alertDelay > 0) { // Alert
      if (Math.floor(tick / 7) % 2 === 0) {
        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8;
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', x + HALF, y + yOff - 4);
        ctx.shadowBlur = 0;
      }
    } else if (mode === 3) { // Chase - Auge
      if (tick % 60 < 8) {
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('👁', x + HALF, y + yOff - 4);
      }
    }

    if (frozen) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#88eeff';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── Vignette ──────────────────────────────────────────────
  function drawVignette(ctx, vw, vh) {
    const g = ctx.createRadialGradient(vw/2, vh/2, vh*0.2, vw/2, vh/2, vh*0.9);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  }

  // ── Spieler-Lichtkegel (Nacht) ────────────────────────────
  function drawPlayerLight(ctx, px, py, camX, camY, vw, vh, isNight) {
    if (!isNight) return;
    const sx = px - camX, sy = py - camY;
    const rad = TILE * 5.5;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
    g.addColorStop(0,   'rgba(0,0,0,0)');
    g.addColorStop(0.55,'rgba(0,0,0,0)');
    g.addColorStop(1,   'rgba(0,0,20,0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    TILE,
    PAL,
    clearCache,
    drawGrass,
    drawGrassBlades,
    drawTallGrass,
    drawWall,
    drawTree,
    drawBush,
    drawWater,
    drawRock,
    drawMountain,
    drawPath,
    drawHouseWall,
    drawHouseRoof,
    drawHouseDoor,
    drawHouseWindow,
    drawWell,
    drawFence,
    drawLantern,
    drawCoin,
    drawPowerUp,
    drawPlayer,
    drawBandit,
    drawVignette,
    drawPlayerLight,
  };

})();
