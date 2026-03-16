// ═══════════════════════════════════════════════════════════════
//  COIN FOREST v5.1 – particles.js
//  Partikel-System: Wetter, Jahreszeiten, Effekte, Gras-Animation
// ═══════════════════════════════════════════════════════════════

'use strict';

const Particles = (() => {

  // ── Partikel-Typen ─────────────────────────────────────────
  const PT = {
    SPARK:      0,
    LEAF:       1,
    RAIN:       2,
    SNOW:       3,
    FOG:        4,
    BLOSSOM:    5,
    FIREFLY:    6,
    DUST:       7,
    SMOKE:      8,
    HIT:        9,
    STAR:       10,
    BUBBLE:     11,
    LIGHTNING:  12,
    HEAT_WAVE:  13,
    COIN_POP:   14,
    PU_RING:    15,
    BIRD:       16,
    BUTTERFLY:  17,
  };

  // ── Pool ────────────────────────────────────────────────────
  let pool = [];
  const MAX_PARTICLES = 600;

  function spawn(type, x, y, opts = {}) {
    if (pool.length >= MAX_PARTICLES) return;
    pool.push({
      type,
      x, y,
      vx:      opts.vx      ?? 0,
      vy:      opts.vy      ?? 0,
      life:    opts.life    ?? 60,
      maxLife: opts.life    ?? 60,
      r:       opts.r       ?? 3,
      color:   opts.color   ?? '#ffffff',
      color2:  opts.color2  ?? null,
      rot:     opts.rot     ?? 0,
      rotV:    opts.rotV    ?? 0,
      scale:   opts.scale   ?? 1,
      scaleV:  opts.scaleV  ?? 0,
      data:    opts.data    ?? {},
    });
  }

  // ── Spawn-Helfer ───────────────────────────────────────────
  function coinBurst(x, y, combo = 1) {
    const count = Math.min(6 + combo * 2, 16);
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.4;
      const spd = 1.8 + Math.random() * 2.5;
      spawn(PT.COIN_POP, x, y, {
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 0.8,
        life: 28 + Math.floor(Math.random() * 18),
        r: 2 + Math.random() * 2.5,
        color: Math.random() > 0.4 ? '#ffd700' : '#ffec6e',
      });
    }
    // Stern-Ring bei Combo
    if (combo >= 3) {
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 / 8) * i;
        spawn(PT.STAR, x, y, {
          vx: Math.cos(a) * 3, vy: Math.sin(a) * 3,
          life: 25, r: 3, color: '#ffffff',
        });
      }
    }
  }

  function hitEffect(x, y) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 3;
      spawn(PT.HIT, x, y, {
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 1.5,
        life: 22, r: 2.5 + Math.random() * 2, color: '#ff2222',
      });
    }
  }

  function powerUpEffect(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 / 14) * i;
      spawn(PT.PU_RING, x, y, {
        vx: Math.cos(a) * 2.8, vy: Math.sin(a) * 2.8 - 0.5,
        life: 38, r: 3.5, color,
      });
    }
    spawn(PT.PU_RING, x, y, {
      vx: 0, vy: -0.5,
      life: 50, r: TILE_SIZE * 0.6, color,
      data: { ring: true, radius: 0 },
    });
  }

  function leafFall(x, y, season) {
    const colors = season === 'autumn'
      ? ['#cc6600', '#dd8800', '#aa4400', '#ff9900', '#883300']
      : ['#2a6a15', '#3a8820', '#4a9930', '#246010'];
    spawn(PT.LEAF, x, y, {
      vx: (Math.random() - 0.5) * 1.8,
      vy: -0.2 - Math.random() * 0.8,
      life: 90 + Math.floor(Math.random() * 60),
      r: 2.5 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.12,
    });
  }

  function rainDrop(x, y, windSpd = 0.5) {
    spawn(PT.RAIN, x, y, {
      vx: windSpd * 0.6 + (Math.random() - 0.5) * 0.3,
      vy: 7 + Math.random() * 4,
      life: 16 + Math.floor(Math.random() * 8),
      r: 1,
      color: '#88bbff',
    });
  }

  function snowFlake(x, y, windSpd = 0.3) {
    spawn(PT.SNOW, x, y, {
      vx: windSpd * 0.4 + (Math.random() - 0.5) * 0.6,
      vy: 0.8 + Math.random() * 1.5,
      life: 130 + Math.floor(Math.random() * 80),
      r: 1.5 + Math.random() * 2.5,
      color: Math.random() > 0.5 ? '#ddeeff' : '#ffffff',
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.06,
    });
  }

  function fogPuff(x, y) {
    spawn(PT.FOG, x, y, {
      vx: (Math.random() - 0.5) * 0.25,
      vy: -0.05 - Math.random() * 0.1,
      life: 240 + Math.floor(Math.random() * 120),
      r: 24 + Math.random() * 32,
      color: '#aaccaa',
    });
  }

  function blossomPetal(x, y) {
    spawn(PT.BLOSSOM, x, y, {
      vx: (Math.random() - 0.5) * 1.2,
      vy: -0.3 - Math.random() * 0.5,
      life: 100 + Math.floor(Math.random() * 80),
      r: 2 + Math.random() * 2,
      color: Math.random() > 0.5 ? '#ffaabb' : '#ffddee',
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.10,
    });
  }

  function firefly(x, y) {
    spawn(PT.FIREFLY, x, y, {
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      life: 180 + Math.floor(Math.random() * 120),
      r: 2.5,
      color: '#aaff44',
      data: { phase: Math.random() * Math.PI * 2 },
    });
  }

  function smokeChimney(x, y) {
    spawn(PT.SMOKE, x, y, {
      vx: (Math.random() - 0.5) * 0.4,
      vy: -0.5 - Math.random() * 0.8,
      life: 80 + Math.floor(Math.random() * 60),
      r: 4 + Math.random() * 6,
      color: '#888888',
      scaleV: 0.015,
    });
  }

  function waterBubble(x, y) {
    spawn(PT.BUBBLE, x, y, {
      vx: (Math.random() - 0.5) * 0.4,
      vy: -0.3 - Math.random() * 0.5,
      life: 40,
      r: 1.5 + Math.random() * 2,
      color: '#88ccff',
    });
  }

  function butterfly(x, y) {
    spawn(PT.BUTTERFLY, x, y, {
      vx: (Math.random() - 0.5) * 1.0,
      vy: -0.3 - Math.random() * 0.4,
      life: 200 + Math.floor(Math.random() * 150),
      r: 4,
      color: Math.random() > 0.5 ? '#ff88ff' : '#88aaff',
      data: { phase: Math.random() * Math.PI * 2, dir: Math.random() > 0.5 ? 1 : -1 },
    });
  }

  // ── Wetter-Spawn ───────────────────────────────────────────
  let TILE_SIZE = 40; // wird per setTileSize gesetzt
  function setTileSize(ts) { TILE_SIZE = ts; }

  function spawnWeather(weather, windSpd, camX, camY, vw, vh) {
    switch (weather) {
      case 'drizzle':
        for (let i = 0; i < 2; i++)
          rainDrop(camX + Math.random() * (vw + 60) - 30, camY - 15, windSpd);
        break;
      case 'rain':
        for (let i = 0; i < 6; i++)
          rainDrop(camX + Math.random() * (vw + 80) - 40, camY - 15, windSpd);
        break;
      case 'storm':
        for (let i = 0; i < 14; i++)
          rainDrop(camX + Math.random() * (vw + 120) - 60, camY - 20, windSpd * 1.5);
        // Gelegentlicher Blitz
        if (Math.random() < 0.004) lightningFlash();
        break;
      case 'snow':
        for (let i = 0; i < 3; i++)
          snowFlake(camX + Math.random() * (vw + 40), camY - 10, windSpd);
        break;
      case 'blizzard':
        for (let i = 0; i < 10; i++)
          snowFlake(camX + Math.random() * (vw + 80) - 40, camY - 15, windSpd * 1.8);
        break;
      case 'fog':
        if (Math.random() < 0.08)
          fogPuff(camX + Math.random() * vw, camY + Math.random() * vh);
        break;
    }
  }

  function spawnSeasonalAmbient(season, camX, camY, vw, vh, windSpd) {
    switch (season) {
      case 'spring':
        if (Math.random() < 0.01)
          blossomPetal(camX + Math.random() * vw, camY + Math.random() * vh * 0.3);
        if (Math.random() < 0.003)
          butterfly(camX + Math.random() * vw, camY + Math.random() * vh);
        break;
      case 'summer':
        if (Math.random() < 0.002)
          butterfly(camX + Math.random() * vw, camY + Math.random() * vh);
        break;
      case 'autumn':
        if (Math.random() < 0.02)
          leafFall(camX + Math.random() * vw, camY + Math.random() * vh * 0.4, 'autumn');
        break;
    }
  }

  function lightningFlash() {
    const el = document.getElementById('alert-flash');
    if (!el) return;
    el.style.background = 'rgba(200,200,255,0.22)';
    setTimeout(() => { el.style.background = 'rgba(255,0,0,0)'; }, 100);
  }

  // ── Update & Render ────────────────────────────────────────
  function update(ctx, camX, camY) {
    const next = [];
    for (const p of pool) {
      p.x   += p.vx;
      p.y   += p.vy;
      p.rot += p.rotV;
      p.scale = Math.max(0, p.scale + p.scaleV);
      p.life--;

      // Typ-spezifische Physik
      switch (p.type) {
        case PT.LEAF:
        case PT.BLOSSOM:
          p.vy += 0.03;
          p.vx += Math.sin(p.rot * 2) * 0.015;
          break;
        case PT.RAIN:
          p.vy += 0.25;
          break;
        case PT.SPARK:
        case PT.COIN_POP:
          p.vy += 0.1;
          p.vx *= 0.97;
          break;
        case PT.HIT:
          p.vy += 0.15;
          p.vx *= 0.88;
          break;
        case PT.STAR:
        case PT.PU_RING:
          p.vx *= 0.93;
          p.vy *= 0.93;
          break;
        case PT.SMOKE:
          p.vx *= 0.99;
          p.vy *= 0.99;
          break;
        case PT.FIREFLY:
          p.data.phase += 0.04;
          p.vx += Math.cos(p.data.phase * 1.3) * 0.06;
          p.vy += Math.sin(p.data.phase) * 0.06;
          p.vx *= 0.97;
          p.vy *= 0.97;
          break;
        case PT.BUTTERFLY:
          p.data.phase += 0.05;
          p.vx = Math.cos(p.data.phase * 0.8) * 1.2 * p.data.dir;
          p.vy = Math.sin(p.data.phase * 1.2) * 0.5 - 0.1;
          break;
        case PT.SNOW:
          p.vx += (Math.random() - 0.5) * 0.04;
          break;
      }

      if (p.life <= 0) continue;
      next.push(p);

      drawParticle(ctx, p, camX, camY);
    }
    pool = next;
  }

  function drawParticle(ctx, p, camX, camY) {
    const alpha = p.life / p.maxLife;
    const sx = p.x - camX;
    const sy = p.y - camY;

    ctx.save();

    switch (p.type) {
      case PT.LEAF:
      case PT.BLOSSOM: {
        ctx.globalAlpha = alpha * 0.88;
        ctx.translate(sx, sy);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
        // Mittelrippe
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(-p.r * 0.8, -0.5, p.r * 1.6, 1);
        break;
      }
      case PT.RAIN: {
        ctx.globalAlpha = alpha * 0.55;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + p.vx * 2, sy + p.vy * 2);
        ctx.stroke();
        break;
      }
      case PT.SNOW: {
        ctx.globalAlpha = alpha * 0.8;
        ctx.translate(sx, sy);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        // Schneeflocken-Form (Kreuz)
        ctx.fillRect(-p.r, -p.r * 0.3, p.r * 2, p.r * 0.6);
        ctx.fillRect(-p.r * 0.3, -p.r, p.r * 0.6, p.r * 2);
        break;
      }
      case PT.FOG: {
        ctx.globalAlpha = (alpha * 0.10) * (0.5 + 0.5 * Math.sin(p.life * 0.03));
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.r * p.scale);
        const rgb = '180,200,180';
        g.addColorStop(0, `rgba(${rgb},0.18)`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, p.r * p.scale, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case PT.SMOKE: {
        ctx.globalAlpha = alpha * 0.22 * p.scale;
        const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.r * (1 + p.scale));
        gr.addColorStop(0, 'rgba(140,140,140,0.3)');
        gr.addColorStop(1, 'rgba(100,100,100,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(sx, sy, p.r * (1 + p.scale), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case PT.FIREFLY: {
        const flicker = 0.4 + 0.6 * Math.sin(p.data.phase * 3);
        ctx.globalAlpha = alpha * flicker;
        ctx.shadowColor = p.color;
        ctx.shadowBlur  = 8;
        ctx.fillStyle   = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
        ctx.fill();
        // Glüh-Halo
        ctx.globalAlpha = alpha * flicker * 0.3;
        ctx.beginPath();
        ctx.arc(sx, sy, p.r * 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case PT.BUTTERFLY: {
        ctx.globalAlpha = alpha * 0.85;
        ctx.translate(sx, sy);
        const wingFlap = Math.sin(p.data.phase * 4) * 0.4;
        // Linker Flügel
        ctx.save();
        ctx.rotate(-0.3 + wingFlap);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(-p.r * 1.2, 0, p.r * 2, p.r * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Rechter Flügel
        ctx.save();
        ctx.rotate(0.3 - wingFlap);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.r * 1.2, 0, p.r * 2, p.r * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Körper
        ctx.fillStyle = '#222';
        ctx.fillRect(-1, -p.r * 1.5, 2, p.r * 3);
        break;
      }
      case PT.COIN_POP:
      case PT.SPARK: {
        ctx.globalAlpha = alpha * 0.9;
        ctx.shadowColor = p.color;
        ctx.shadowBlur  = 6;
        ctx.fillStyle   = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case PT.HIT: {
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle   = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case PT.STAR:
      case PT.PU_RING: {
        if (p.data.ring) {
          p.data.radius = lerp(p.data.radius, TILE_SIZE * 1.5, 0.1);
          ctx.globalAlpha = alpha * 0.6;
          ctx.strokeStyle = p.color;
          ctx.lineWidth   = 2;
          ctx.shadowColor = p.color;
          ctx.shadowBlur  = 8;
          ctx.beginPath();
          ctx.arc(sx, sy, p.data.radius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.globalAlpha = alpha * 0.9;
          ctx.shadowColor = p.color;
          ctx.shadowBlur  = 8;
          ctx.fillStyle   = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case PT.BUBBLE: {
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeStyle = p.color;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, p.r, 0, Math.PI * 2);
        ctx.stroke();
        // Highlight
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillStyle   = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx - p.r * 0.3, sy - p.r * 0.3, p.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ── Gras-Wind-Animation ───────────────────────────────────
  // Diese Funktion wird vom Graphics-Modul aufgerufen
  // Sie gibt Offsets für Gras-Halme zurück
  function getGrassWind(wx, wy, windPhase, windSpeed) {
    const freq1 = 0.08;
    const freq2 = 0.13;
    const amp   = windSpeed * 3.5;
    const wave1 = Math.sin(windPhase * 1.2 + wx * freq1 + wy * 0.05) * amp;
    const wave2 = Math.sin(windPhase * 0.7 + wy * freq2 + wx * 0.04) * amp * 0.5;
    return wave1 + wave2;
  }

  // ── Dorf-Effekte ──────────────────────────────────────────
  function spawnVillageEffects(lanternX, lanternY) {
    // Rauch aus Schornstein
    if (Math.random() < 0.04) smokeChimney(lanternX, lanternY - 8);
  }

  function spawnWaterEffects(wx, wy) {
    if (Math.random() < 0.006) waterBubble(wx, wy);
  }

  // ── Clear ──────────────────────────────────────────────────
  function clear() { pool = []; }

  function getCount() { return pool.length; }

  // ── Public API ─────────────────────────────────────────────
  return {
    PT,
    spawn,
    coinBurst,
    hitEffect,
    powerUpEffect,
    leafFall,
    rainDrop,
    snowFlake,
    fogPuff,
    blossomPetal,
    firefly,
    smokeChimney,
    waterBubble,
    butterfly,
    spawnWeather,
    spawnSeasonalAmbient,
    update,
    getGrassWind,
    spawnVillageEffects,
    spawnWaterEffects,
    clear,
    getCount,
    setTileSize,
  };

})();
