// ═══════════════════════════════════════════════════════════════
//  COIN FOREST v5.1 – world.js
//  Jahreszeiten, Tag/Nacht, Wetter, Beleuchtungs-System
// ═══════════════════════════════════════════════════════════════

'use strict';

const World = (() => {

  // ── Konstanten ─────────────────────────────────────────────
  const SEASON_DURATION = 10 * 60 * 60; // 10 Minuten × 60 Sek × 60 FPS = Ticks
  const DAY_DURATION    = 2  * 60 * 60; // 2 Minuten pro Spieltag
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

  const SEASON_DEF = {
    spring: {
      name: 'Frühling', icon: '🌸',
      skyDay:   '#87ceeb', skyDawn:  '#ffb347', skyNight: '#0d1b3e',
      ambientDay:   'rgba(255,250,220,0.0)',
      ambientDusk:  'rgba(255,150,50,0.18)',
      ambientNight: 'rgba(0,0,50,0.52)',
      ambientDawn:  'rgba(255,200,100,0.14)',
      fogColor: 'rgba(200,230,200,',
      weatherChances: { clear: 0.55, rain: 0.3, drizzle: 0.15 },
      grassTint:  [45, 90, 27],
      treeTint:   [40, 100, 30],
      waterTint:  [30, 100, 160],
      speedMult:  1.0,
      coinMult:   1.0,
      enemyMult:  1.0,
      particles:  ['blossom', 'butterfly'],
    },
    summer: {
      name: 'Sommer', icon: '☀️',
      skyDay:   '#5bb8ff', skyDawn:  '#ff6b35', skyNight: '#08122e',
      ambientDay:   'rgba(255,255,200,0.04)',
      ambientDusk:  'rgba(255,100,20,0.22)',
      ambientNight: 'rgba(0,0,40,0.58)',
      ambientDawn:  'rgba(255,220,120,0.16)',
      fogColor: 'rgba(220,240,200,',
      weatherChances: { clear: 0.65, storm: 0.2, heat: 0.15 },
      grassTint:  [38, 95, 22],
      treeTint:   [25, 85, 20],
      waterTint:  [25, 110, 180],
      speedMult:  1.0,
      coinMult:   1.1,
      enemyMult:  1.0,
      particles:  ['firefly', 'butterfly', 'heat'],
    },
    autumn: {
      name: 'Herbst', icon: '🍁',
      skyDay:   '#c4a882', skyDawn:  '#cc5500', skyNight: '#0f1420',
      ambientDay:   'rgba(255,150,50,0.08)',
      ambientDusk:  'rgba(200,80,10,0.28)',
      ambientNight: 'rgba(10,5,30,0.62)',
      ambientDawn:  'rgba(200,120,50,0.18)',
      fogColor: 'rgba(180,180,140,',
      weatherChances: { clear: 0.3, rain: 0.35, fog: 0.25, storm: 0.1 },
      grassTint:  [80, 60, 20],
      treeTint:   [160, 60, 10],
      waterTint:  [30, 80, 120],
      speedMult:  1.0,
      coinMult:   1.0,
      enemyMult:  1.1,
      particles:  ['leaf', 'fog'],
    },
    winter: {
      name: 'Winter', icon: '❄️',
      skyDay:   '#b0c8e8', skyDawn:  '#a0b0cc', skyNight: '#05101e',
      ambientDay:   'rgba(180,200,255,0.06)',
      ambientDusk:  'rgba(100,120,180,0.20)',
      ambientNight: 'rgba(0,5,30,0.68)',
      ambientDawn:  'rgba(150,170,220,0.14)',
      fogColor: 'rgba(200,220,255,',
      weatherChances: { clear: 0.35, snow: 0.45, blizzard: 0.2 },
      grassTint:  [220, 230, 240],
      treeTint:   [200, 210, 220],
      waterTint:  [150, 180, 220],
      speedMult:  0.85,
      coinMult:   1.0,
      enemyMult:  1.0,
      particles:  ['snow', 'snowstorm'],
    },
  };

  const WEATHER_DEF = {
    clear:    { name: 'Klar',       icon: '☀️',  windStr: 0.3,  vizMult: 1.0,  speedPenalty: 0    },
    drizzle:  { name: 'Nieselregen', icon: '🌦️', windStr: 0.5,  vizMult: 0.85, speedPenalty: 0.05 },
    rain:     { name: 'Regen',       icon: '🌧️', windStr: 0.8,  vizMult: 0.75, speedPenalty: 0.10 },
    storm:    { name: 'Gewitter',    icon: '⛈️',  windStr: 1.5,  vizMult: 0.60, speedPenalty: 0.20 },
    fog:      { name: 'Nebel',       icon: '🌫️', windStr: 0.1,  vizMult: 0.50, speedPenalty: 0.08 },
    snow:     { name: 'Schneefall',  icon: '🌨️', windStr: 0.6,  vizMult: 0.80, speedPenalty: 0.12 },
    blizzard: { name: 'Schneesturm', icon: '❄️',  windStr: 2.0,  vizMult: 0.40, speedPenalty: 0.25 },
    heat:     { name: 'Hitzewelle',  icon: '🌡️', windStr: 0.0,  vizMult: 0.90, speedPenalty: 0    },
  };

  // ── State ──────────────────────────────────────────────────
  let state = {
    seasonIdx:     0,
    seasonTick:    0,
    dayTick:       0,
    dayIdx:        0,         // aktueller Tag innerhalb der Saison
    weather:       'clear',
    weatherTick:   0,
    weatherDur:    0,
    windPhase:     0,
    windSpeed:     0.3,
    windTarget:    0.3,
    lightR: 255, lightG: 255, lightB: 255, lightA: 0,
    targetLR: 255, targetLG: 255, targetLB: 255, targetLA: 0,
  };

  // ── Getter ─────────────────────────────────────────────────
  function getSeason()     { return SEASONS[state.seasonIdx]; }
  function getSeasonDef()  { return SEASON_DEF[getSeason()]; }
  function getWeather()    { return state.weather; }
  function getWeatherDef() { return WEATHER_DEF[state.weather]; }
  function getWindPhase()  { return state.windPhase; }
  function getWindSpeed()  { return state.windSpeed; }
  function getDayPhase()   { return (state.dayTick % DAY_DURATION) / DAY_DURATION; } // 0..1
  function isNight()       { const p = getDayPhase(); return p > 0.45 && p < 0.85; }
  function isDawn()        { const p = getDayPhase(); return p >= 0.85 && p < 0.95; }
  function isDusk()        { const p = getDayPhase(); return p >= 0.35 && p < 0.45; }
  function getDetectBonus(){ return isNight() ? 1.6 : 1.0; }

  function getSpeedMult() {
    const s = getSeasonDef();
    const w = getWeatherDef();
    return s.speedMult * (1 - w.speedPenalty);
  }

  function getCoinMult()  { return getSeasonDef().coinMult; }
  function getEnemyMult() { return getSeasonDef().enemyMult; }

  // ── Tag/Nacht Licht berechnen ──────────────────────────────
  function computeTargetLight() {
    const phase = getDayPhase();
    const sd    = getSeasonDef();

    // Phase-Segmente: 0=Dawn(0..0.15), Day(0.15..0.35), Dusk(0.35..0.45), Night(0.45..0.85), Dawn2(0.85..1.0)
    let r = 0, g = 0, b = 0, a = 0;

    if (phase < 0.12) {
      // Morgendämmerung
      const t = phase / 0.12;
      r = lerp(20,  255, t); g = lerp(20,  200, t); b = lerp(60, 150, t);
      a = lerp(0.55, 0.12, t);
    } else if (phase < 0.38) {
      // Tag
      a = 0.0; r = 255; g = 252; b = 220;
    } else if (phase < 0.48) {
      // Abenddämmerung
      const t = (phase - 0.38) / 0.10;
      r = lerp(255, 180, t); g = lerp(200, 80, t); b = lerp(150, 60, t);
      a = lerp(0.0, 0.28, t);
    } else if (phase < 0.82) {
      // Nacht
      a = 0.58; r = 0; g = 5; b = 50;
    } else {
      // Morgendämmerung 2
      const t = (phase - 0.82) / 0.18;
      r = lerp(0, 255, t); g = lerp(5, 200, t); b = lerp(50, 150, t);
      a = lerp(0.58, 0.0, t);
    }

    // Jahreszeit-Tint
    if (getSeason() === 'winter') { r *= 0.85; g *= 0.88; b *= 1.05; }
    if (getSeason() === 'autumn') { r *= 1.05; g *= 0.92; b *= 0.85; }

    state.targetLR = clamp(r, 0, 255);
    state.targetLG = clamp(g, 0, 255);
    state.targetLB = clamp(b, 0, 255);
    state.targetLA = clamp(a, 0, 1);
  }

  function lerp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function smoothLight() {
    const spd = 0.008;
    state.lightR = lerp(state.lightR, state.targetLR, spd);
    state.lightG = lerp(state.lightG, state.targetLG, spd);
    state.lightB = lerp(state.lightB, state.targetLB, spd);
    state.lightA = lerp(state.lightA, state.targetLA, spd * 0.5);
  }

  function getLightOverlay() {
    const r = Math.round(state.lightR);
    const g = Math.round(state.lightG);
    const b = Math.round(state.lightB);
    const a = state.lightA.toFixed(3);
    return `rgba(${r},${g},${b},${a})`;
  }

  // ── Wetter-System ──────────────────────────────────────────
  function pickWeather() {
    const sd = getSeasonDef();
    const chances = sd.weatherChances;
    let roll = Math.random();
    for (const [w, chance] of Object.entries(chances)) {
      roll -= chance;
      if (roll <= 0) return w;
    }
    return 'clear';
  }

  function changeWeather() {
    const old = state.weather;
    state.weather    = pickWeather();
    state.weatherDur = (180 + Math.random() * 480) * 60; // 3–11 Minuten in Ticks
    state.weatherTick = 0;

    const wd = getWeatherDef();
    state.windTarget = wd.windStr * (0.8 + Math.random() * 0.4);

    if (typeof setStatus === 'function' && old !== state.weather) {
      setStatus(`${wd.icon} Wetter ändert sich: ${wd.name}`);
    }
  }

  // ── Hauptupdate ────────────────────────────────────────────
  function tick() {
    // Wind
    state.windPhase  += 0.018 * (0.5 + state.windSpeed);
    state.windSpeed   = lerp(state.windSpeed, state.windTarget, 0.004);
    if (Math.random() < 0.001) {
      state.windTarget = getWeatherDef().windStr * (0.6 + Math.random() * 0.8);
    }

    // Tag/Nacht
    state.dayTick++;
    if (state.dayTick >= DAY_DURATION) {
      state.dayTick = 0;
      state.dayIdx++;
    }

    // Licht
    computeTargetLight();
    smoothLight();

    // Wetter
    state.weatherTick++;
    if (state.weatherTick >= state.weatherDur) {
      changeWeather();
    }

    // Jahreszeit
    state.seasonTick++;
    if (state.seasonTick >= SEASON_DURATION) {
      state.seasonTick = 0;
      state.seasonIdx  = (state.seasonIdx + 1) % 4;
      const sd = getSeasonDef();
      if (typeof setStatus === 'function') {
        setStatus(`${sd.icon} Jahreszeit: ${sd.name}!`);
      }
      // Wetter neu wählen
      changeWeather();
    }

    return state;
  }

  // ── DOM Overlay setzen ─────────────────────────────────────
  function applyOverlay() {
    const el = document.getElementById('night-overlay');
    if (!el) return;
    el.style.background = getLightOverlay();
  }

  function updateHUDSeason() {
    const sd = getSeasonDef();
    const el = document.getElementById('hud-season-icon');
    if (el) el.textContent = sd.icon;
    const el2 = document.getElementById('hud-season-name');
    if (el2) el2.textContent = sd.name;

    const wd = getWeatherDef();
    const wEl = document.getElementById('status-weather');
    if (wEl) wEl.textContent = `${wd.icon} ${wd.name}`;

    const sEl = document.getElementById('status-season');
    if (sEl) sEl.textContent = `${sd.icon} ${sd.name}`;

    // Tag/Nacht Icon
    const dayEl = document.getElementById('hud-daytime');
    if (dayEl) {
      const phase = getDayPhase();
      if (phase < 0.12 || phase > 0.88) dayEl.textContent = '🌅';
      else if (isNight())               dayEl.textContent = '🌙';
      else if (isDusk())                dayEl.textContent = '🌆';
      else                              dayEl.textContent = '☀️';
    }
  }

  // ── Partikel-Typ für aktuelle Situation ───────────────────
  function getActiveParticleTypes() {
    const sd = getSeasonDef();
    const wd = getWeather();
    const types = [...sd.particles];

    if (wd === 'rain' || wd === 'drizzle') types.push('rain');
    if (wd === 'storm')    types.push('rain', 'lightning');
    if (wd === 'snow')     types.push('snow');
    if (wd === 'blizzard') types.push('snow', 'blizzard');
    if (wd === 'fog')      types.push('fog');
    if (isNight() && getSeason() === 'summer') types.push('firefly');

    return types;
  }

  // ── Tile-Farb-Überschreibungen je Jahreszeit ──────────────
  function getGrassTint() {
    const [r, g, b] = getSeasonDef().grassTint;
    return { r, g, b };
  }
  function getTreeTint() {
    const [r, g, b] = getSeasonDef().treeTint;
    return { r, g, b };
  }
  function getWaterTint() {
    const [r, g, b] = getSeasonDef().waterTint;
    return { r, g, b };
  }

  // ── Winter: Schneeschicht ──────────────────────────────────
  function getSnowCoverage() {
    if (getSeason() !== 'winter') return 0;
    // Nimmt über die Saison-Dauer zu
    return clamp(state.seasonTick / (SEASON_DURATION * 0.3), 0, 1);
  }

  // ── Saison-Fortschritt ────────────────────────────────────
  function getSeasonProgress() {
    return state.seasonTick / SEASON_DURATION; // 0..1
  }

  function getSeasonTimeLeft() {
    const left = SEASON_DURATION - state.seasonTick;
    const secs = Math.floor(left / 60);
    const m    = Math.floor(secs / 60);
    const s    = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ── Initialisierung ────────────────────────────────────────
  function init(startSeason = 0) {
    state.seasonIdx   = startSeason;
    state.seasonTick  = 0;
    state.dayTick     = Math.floor(DAY_DURATION * 0.15); // Start: Morgen
    state.dayIdx      = 0;
    state.windPhase   = 0;
    state.windSpeed   = 0.3;
    state.windTarget  = 0.3;
    changeWeather();
    computeTargetLight();
    state.lightR = state.targetLR;
    state.lightG = state.targetLG;
    state.lightB = state.targetLB;
    state.lightA = state.targetLA;
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    init,
    tick,
    applyOverlay,
    updateHUDSeason,
    getSeason,
    getSeasonDef,
    getWeather,
    getWeatherDef,
    getWindPhase,
    getWindSpeed,
    getDayPhase,
    isNight,
    isDawn,
    isDusk,
    getDetectBonus,
    getSpeedMult,
    getCoinMult,
    getEnemyMult,
    getLightOverlay,
    getActiveParticleTypes,
    getGrassTint,
    getTreeTint,
    getWaterTint,
    getSnowCoverage,
    getSeasonProgress,
    getSeasonTimeLeft,
    SEASON_DEF,
    WEATHER_DEF,
    get state() { return state; },
  };

})();
