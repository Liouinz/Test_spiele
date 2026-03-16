// ═══════════════════════════════════════════════════════════════
//  COIN FOREST v5.1 – input.js
//  Joystick, Tastatur, Touch, Pause-Fix, Format-Erkennung
// ═══════════════════════════════════════════════════════════════

'use strict';

const Input = (() => {

  // ── State ──────────────────────────────────────────────────
  const state = {
    dx: 0,
    dy: 0,
    active: false,
    locked: false,      // true = Pause, kein Bewegungs-Input
    touchId: null,
    joyBaseX: 0,
    joyBaseY: 0,
  };

  const keys = {};
  const MAX_RADIUS = 0; // wird per Format gesetzt

  // ── Format-Erkennung ───────────────────────────────────────
  const FORMATS = {
    PHONE_S:    { maxW: 380,  ratio: 9/19,   joyR: 0.44 },
    PHONE_M:    { maxW: 430,  ratio: 9/19.5, joyR: 0.44 },
    PHONE_L:    { maxW: 480,  ratio: 9/20,   joyR: 0.42 },
    PHONE_XL:   { maxW: 520,  ratio: 9/21,   joyR: 0.42 },
    TABLET_P:   { maxW: 768,  ratio: 3/4,    joyR: 0.35 },
    TABLET_L:   { maxW: 1200, ratio: 16/9,   joyR: 0.28 },
    PC_HD:      { maxW: 1920, ratio: 16/9,   joyR: 0.22 },
    PC_WIDE:    { maxW: 9999, ratio: 21/9,   joyR: 0.18 },
  };

  function detectFormat() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = w / h;
    const portrait = h > w;

    let fmt = 'PHONE_M';
    if (w < 380)       fmt = 'PHONE_S';
    else if (w < 430)  fmt = 'PHONE_M';
    else if (w < 480)  fmt = 'PHONE_L';
    else if (w < 520)  fmt = 'PHONE_XL';
    else if (w < 768)  fmt = portrait ? 'PHONE_XL' : 'TABLET_L';
    else if (w < 1200) fmt = portrait ? 'TABLET_P' : 'TABLET_L';
    else if (w < 1920) fmt = 'PC_HD';
    else               fmt = 'PC_WIDE';

    return { fmt, w, h, ratio, portrait };
  }

  function applyFormat() {
    const { fmt, w, h, portrait } = detectFormat();
    const def = FORMATS[fmt];

    // Joystick-Größe als CSS-Variable setzen
    const joySize  = Math.round(Math.min(w, h) * (portrait ? 0.33 : 0.22));
    const thumbSize = Math.round(joySize * 0.38);
    const btnSize   = Math.round(joySize * 0.42);
    const joyH      = Math.round(joySize * 1.25);

    document.documentElement.style.setProperty('--joy-size',  joySize  + 'px');
    document.documentElement.style.setProperty('--joy-thumb', thumbSize + 'px');
    document.documentElement.style.setProperty('--btn-size',  btnSize  + 'px');
    document.documentElement.style.setProperty('--joy-h',     joyH     + 'px');

    // Joy-Radius für Daumen-Bewegung
    state.maxRadius = joySize * 0.36;

    // Canvas-Max-Breite
    const maxCanvasW = Math.min(w, portrait ? w : Math.round(h * 9 / 16));
    document.getElementById('gameCanvas')?.style && (
      document.getElementById('gameCanvas').style.maxWidth = maxCanvasW + 'px'
    );

    return { joySize, thumbSize, btnSize, joyH, maxCanvasW };
  }

  // ── Joystick Elemente ──────────────────────────────────────
  let joyOuter, joyThumb, joyZone, joyWrap;

  function initJoystick() {
    joyOuter = document.getElementById('joy-outer');
    joyThumb = document.getElementById('joy-thumb');
    joyZone  = document.getElementById('joystick-zone');
    joyWrap  = document.getElementById('joystick-wrap');

    if (!joyZone || !joyThumb) return;

    // Touch-Events NUR auf der Joystick-Zone (nicht auf Buttons)
    joyZone.addEventListener('touchstart', onTouchStart, { passive: false });
    joyZone.addEventListener('touchmove',  onTouchMove,  { passive: false });
    joyZone.addEventListener('touchend',   onTouchEnd,   { passive: false });
    joyZone.addEventListener('touchcancel',onTouchEnd,   { passive: false });

    resetThumb();
  }

  function getJoyCenter() {
    const rect = joyWrap.getBoundingClientRect();
    return {
      x: rect.left + rect.width  / 2,
      y: rect.top  + rect.height / 2,
    };
  }

  function onTouchStart(e) {
    if (state.locked) return;
    // Sicherstellen dass Touch nicht auf einem Button liegt
    const target = e.target;
    if (target.closest('.act-btn') || target.closest('#btn-pause') || target.closest('#btn-menu')) return;

    e.preventDefault();
    const touch = e.changedTouches[0];
    state.touchId = touch.identifier;

    const center = getJoyCenter();
    state.joyBaseX = center.x;
    state.joyBaseY = center.y;
    state.active = true;
    joyThumb.classList.add('active');
  }

  function onTouchMove(e) {
    if (state.locked || !state.active) return;
    e.preventDefault();

    // Richtigen Touch finden
    let touch = null;
    for (const t of e.changedTouches) {
      if (t.identifier === state.touchId) { touch = t; break; }
    }
    if (!touch) return;

    const dx = touch.clientX - state.joyBaseX;
    const dy = touch.clientY - state.joyBaseY;
    const mag = Math.hypot(dx, dy);
    const maxR = state.maxRadius || 40;

    const clampedDX = mag > maxR ? (dx / mag) * maxR : dx;
    const clampedDY = mag > maxR ? (dy / mag) * maxR : dy;

    // Normalisierte Werte (-1 bis 1)
    state.dx = clampedDX / maxR;
    state.dy = clampedDY / maxR;

    // Thumb visuell verschieben
    const hw = joyWrap.offsetWidth  / 2;
    const hh = joyWrap.offsetHeight / 2;
    joyThumb.style.left = (hw + clampedDX) + 'px';
    joyThumb.style.top  = (hh + clampedDY) + 'px';
  }

  function onTouchEnd(e) {
    // Prüfen ob es unser Touch war
    let found = false;
    for (const t of e.changedTouches) {
      if (t.identifier === state.touchId) { found = true; break; }
    }
    if (!found && e.type !== 'touchcancel') return;

    resetJoy();
  }

  function resetJoy() {
    state.active  = false;
    state.dx      = 0;
    state.dy      = 0;
    state.touchId = null;
    joyThumb && joyThumb.classList.remove('active');
    resetThumb();
  }

  function resetThumb() {
    if (!joyThumb || !joyWrap) return;
    const hw = joyWrap.offsetWidth  / 2;
    const hh = joyWrap.offsetHeight / 2;
    joyThumb.style.left = hw + 'px';
    joyThumb.style.top  = hh + 'px';
  }

  // ── Tastatur ───────────────────────────────────────────────
  function initKeyboard() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
  }

  function onKeyDown(e) {
    keys[e.key] = true;

    // Pause toggling
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (typeof togglePause === 'function') togglePause();
      return;
    }

    // M = Mini-Map toggle
    if (e.key === 'm' || e.key === 'M') {
      if (typeof UI !== 'undefined' && UI.toggleMiniMap) UI.toggleMiniMap();
    }

    updateKeyJoy();
  }

  function onKeyUp(e) {
    keys[e.key] = false;
    updateKeyJoy();
  }

  function updateKeyJoy() {
    if (state.locked) { state.active = false; state.dx = 0; state.dy = 0; return; }

    const dx = ((keys['ArrowRight'] || keys['d'] || keys['D']) ? 1 : 0)
             - ((keys['ArrowLeft']  || keys['a'] || keys['A']) ? 1 : 0);
    const dy = ((keys['ArrowDown']  || keys['s'] || keys['S']) ? 1 : 0)
             - ((keys['ArrowUp']    || keys['w'] || keys['W']) ? 1 : 0);

    state.active = dx !== 0 || dy !== 0;
    state.dx = dx;
    state.dy = dy;
  }

  // ── Pause-Fix ──────────────────────────────────────────────
  function lock() {
    state.locked = true;
    state.active = false;
    state.dx     = 0;
    state.dy     = 0;
    // Alle Keys als losgelassen markieren
    Object.keys(keys).forEach(k => { keys[k] = false; });
    resetJoy();
  }

  function unlock() {
    state.locked = false;
  }

  // ── Action Buttons (Pause, Menü) ───────────────────────────
  function initActionButtons() {
    const btnPause = document.getElementById('btn-pause');
    const btnMenu  = document.getElementById('btn-menu');

    if (btnPause) {
      // stopPropagation verhindert dass der Touch die Joystick-Zone aktiviert
      btnPause.addEventListener('touchstart', e => { e.stopPropagation(); }, { passive: true });
      btnPause.addEventListener('touchend',   e => {
        e.stopPropagation();
        e.preventDefault();
        if (typeof togglePause === 'function') togglePause();
      }, { passive: false });
      btnPause.addEventListener('click', () => {
        if (typeof togglePause === 'function') togglePause();
      });
    }

    if (btnMenu) {
      btnMenu.addEventListener('touchstart', e => { e.stopPropagation(); }, { passive: true });
      btnMenu.addEventListener('touchend', e => {
        e.stopPropagation();
        e.preventDefault();
        if (typeof goToMenu === 'function') goToMenu();
      }, { passive: false });
      btnMenu.addEventListener('click', () => {
        if (typeof goToMenu === 'function') goToMenu();
      });
    }
  }

  // ── Window Resize ──────────────────────────────────────────
  function initResize() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        applyFormat();
        resetThumb();
        if (typeof Game !== 'undefined' && Game.resizeCanvas) Game.resizeCanvas();
      }, 150);
    });

    // Orientation Change
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        applyFormat();
        resetThumb();
        if (typeof Game !== 'undefined' && Game.resizeCanvas) Game.resizeCanvas();
      }, 300);
    });
  }

  // ── Public API ─────────────────────────────────────────────
  function init() {
    applyFormat();
    initJoystick();
    initKeyboard();
    initActionButtons();
    initResize();
  }

  function getDX() { return state.locked ? 0 : state.dx; }
  function getDY() { return state.locked ? 0 : state.dy; }
  function isActive() { return !state.locked && state.active; }
  function isLocked() { return state.locked; }

  return { init, lock, unlock, getDX, getDY, isActive, isLocked, applyFormat };

})();
