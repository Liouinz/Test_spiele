/**
 * ═══════════════════════════════════════════════════════════
 *  ARCADE HUB — app.js
 *  Modular Game Launcher for GitHub Pages
 *  ─────────────────────────────────────────────────────────
 *  Modules:
 *   1. StorageManager  – localStorage persistence
 *   2. ThemeManager    – hell/dunkel Theme
 *   3. BackgroundFX    – animierter Canvas-Hintergrund
 *   4. Carousel        – Swipe, Drag, Keyboard Navigation
 *   5. FocusPanel      – Spiel-Detailansicht (Steam-ähnlich)
 *   6. Launcher        – App-Init, Manifest-Laden
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

/* ─────────────────────────────────────────────────────────
   1. STORAGE MANAGER
   Wraps localStorage mit JSON-Support und Fehlerbehandlung
   ───────────────────────────────────────────────────────── */
const StorageManager = (() => {
  const PREFIX = 'arcade-hub::';

  function get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('[Storage] Could not write:', e);
    }
  }

  function remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch {}
  }

  /** Zuletzt gespielt setzen */
  function setLastPlayed(gameId) {
    const now = new Date().toLocaleDateString('de-DE');
    const log = get('last-played', {});
    log[gameId] = now;
    set('last-played', log);
  }

  /** Letzte Spielzeit abrufen */
  function getLastPlayed(gameId) {
    const log = get('last-played', {});
    return log[gameId] || null;
  }

  /** Favorit togglen, gibt neuen Zustand zurück */
  function toggleFavorite(gameId) {
    const favs = get('favorites', []);
    const idx  = favs.indexOf(gameId);
    if (idx === -1) favs.push(gameId);
    else            favs.splice(idx, 1);
    set('favorites', favs);
    return idx === -1; // true = jetzt Favorit
  }

  function isFavorite(gameId) {
    return get('favorites', []).includes(gameId);
  }

  function getHighscore(gameId) {
    const scores = get('highscores', {});
    return scores[gameId] ?? null;
  }

  return { get, set, remove, setLastPlayed, getLastPlayed, toggleFavorite, isFavorite, getHighscore };
})();

/* ─────────────────────────────────────────────────────────
   2. THEME MANAGER
   ───────────────────────────────────────────────────────── */
const ThemeManager = (() => {
  let current = StorageManager.get('theme', 'dark');
  const html  = document.documentElement;
  const btn   = document.getElementById('theme-toggle');

  function apply(theme) {
    current = theme;
    html.setAttribute('data-theme', theme);
    StorageManager.set('theme', theme);
    // Icon tauschen
    if (btn) {
      btn.title = theme === 'dark' ? 'Zu Hell wechseln' : 'Zu Dunkel wechseln';
    }
  }

  function toggle() {
    apply(current === 'dark' ? 'light' : 'dark');
  }

  function init() {
    apply(current);
    btn?.addEventListener('click', toggle);
  }

  return { init, toggle, current: () => current };
})();

/* ─────────────────────────────────────────────────────────
   3. BACKGROUND FX
   Animierter Partikel-/Netz-Canvas
   ───────────────────────────────────────────────────────── */
const BackgroundFX = (() => {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return { init() {} };
  const ctx = canvas.getContext('2d');

  let W, H, particles = [], raf;
  const N = window.innerWidth < 600 ? 40 : 80;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.6 + 0.1,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Draw gradient background meshes
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    if (isDark) {
      const g1 = ctx.createRadialGradient(W * 0.2, H * 0.3, 0, W * 0.2, H * 0.3, W * 0.45);
      g1.addColorStop(0, 'rgba(0,229,255,0.06)');
      g1.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, W, H);

      const g2 = ctx.createRadialGradient(W * 0.8, H * 0.7, 0, W * 0.8, H * 0.7, W * 0.4);
      g2.addColorStop(0, 'rgba(123,97,255,0.06)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);
    }

    // Particles
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = isDark
        ? `rgba(100,160,255,${p.alpha})`
        : `rgba(60,100,200,${p.alpha * 0.4})`;
      ctx.fill();
    });

    // Connect nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          const alpha = (1 - dist / 120) * (isDark ? 0.08 : 0.04);
          ctx.strokeStyle = isDark
            ? `rgba(0,229,255,${alpha})`
            : `rgba(60,100,200,${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    raf = requestAnimationFrame(draw);
  }

  function init() {
    resize();
    for (let i = 0; i < N; i++) particles.push(makeParticle());
    window.addEventListener('resize', resize);
    draw();
  }

  return { init };
})();

/* ─────────────────────────────────────────────────────────
   4. CAROUSEL
   Unterstützt: Mouse-Drag, Touch-Swipe, Keyboard, Arrows
   ───────────────────────────────────────────────────────── */
const Carousel = (() => {
  const track     = document.getElementById('carousel-track');
  const dotsWrap  = document.getElementById('carousel-dots');
  const arrowL    = document.getElementById('arrow-left');
  const arrowR    = document.getElementById('arrow-right');

  let games      = [];
  let current    = 0;
  let isDragging = false;
  let startX     = 0;
  let dragX      = 0;
  let isTouch    = false;
  let onChangeCb = null;

  /* ── Initialisierung ── */
  function init(gameList, cb) {
    games      = gameList;
    onChangeCb = cb;
    renderCards();
    renderDots();
    bindEvents();
    goTo(0, false);
  }

  /* ── Karten rendern ── */
  function renderCards() {
    track.innerHTML = '';
    games.forEach((g, i) => {
      const card = document.createElement('div');
      card.className    = 'game-card';
      card.role         = 'option';
      card.dataset.idx  = i;
      card.dataset.status = g.status;
      card.setAttribute('aria-label', g.title);
      card.setAttribute('aria-selected', 'false');

      // Accent-Farbe
      card.style.setProperty('--card-accent-color', g.coverColor || '#00e5ff');

      // Cover
      const coverEl = document.createElement('div');
      coverEl.className = 'card-cover';
      if (g.cover) {
        coverEl.style.backgroundImage = `url('${g.cover}')`;
        coverEl.style.backgroundColor = g.coverColor + '33';
      } else {
        // Fallback Gradient wenn kein Cover
        coverEl.style.background = `linear-gradient(135deg, ${g.coverColor || '#00e5ff'}22, #080c14)`;
      }

      // Overlay, Glow-Line
      const overlay    = document.createElement('div');
      overlay.className = 'card-overlay';
      const accentLine = document.createElement('div');
      accentLine.className = 'card-accent-line';

      // Badge
      let badgeEl = '';
      if (g.badge) {
        const b = document.createElement('div');
        b.className = `card-badge badge--${g.badge.toLowerCase()}`;
        b.textContent = g.badge;
        card.appendChild(b);
      }

      // Content
      const content = document.createElement('div');
      content.className = 'card-content';
      content.innerHTML = `
        <div class="card-title">${g.title}</div>
        <div class="card-genre">${g.genre || ''}</div>
        <div class="card-status">
          <span class="status-dot ${g.status}"></span>
          <span class="status-label">${g.status === 'ready' ? 'Bereit' : 'Coming Soon'}</span>
        </div>
      `;

      // Coming-soon overlay
      const cso = document.createElement('div');
      cso.className = 'card-coming-soon';
      cso.textContent = 'COMING SOON';

      card.appendChild(coverEl);
      card.appendChild(overlay);
      card.appendChild(accentLine);
      card.appendChild(content);
      card.appendChild(cso);

      // Click → Focus-Panel öffnen
      card.addEventListener('click', (e) => {
        if (isDragging || Math.abs(dragX) > 5) return;
        if (i !== current) {
          goTo(i);
        } else {
          FocusPanel.open(games[i]);
        }
      });

      track.appendChild(card);
    });
  }

  /* ── Dots rendern ── */
  function renderDots() {
    dotsWrap.innerHTML = '';
    games.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'dot';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', `Spiel ${i + 1}`);
      dot.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(dot);
    });
  }

  /* ── Zum Index navigieren ── */
  function goTo(idx, animate = true) {
    current = Math.max(0, Math.min(idx, games.length - 1));

    const cards    = track.querySelectorAll('.game-card');
    const cardW    = getCardWidth();
    const offset   = calcOffset(current, cardW);

    // Übergangsanimation
    track.style.transition = animate
      ? 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
      : 'none';
    track.style.transform = `translateX(${offset}px)`;

    // Floating-Klasse kurz entfernen damit Transition sauber startet
    cards.forEach((card, i) => {
      card.classList.remove('active', 'floating');
      card.setAttribute('aria-selected', 'false');
    });

    const active = cards[current];
    if (active) {
      active.classList.add('active');
      active.setAttribute('aria-selected', 'true');
      // Float mit kleiner Verzögerung starten
      setTimeout(() => active.classList.add('floating'), 600);
    }

    // Dots updaten
    dotsWrap.querySelectorAll('.dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
      d.setAttribute('aria-selected', i === current ? 'true' : 'false');
    });

    // Arrows
    if (arrowL) arrowL.disabled = current === 0;
    if (arrowR) arrowR.disabled = current === games.length - 1;

    // Callback → UI aktualisieren
    onChangeCb?.(games[current], current);
  }

  /* ── Offset berechnen: Aktive Karte zentrieren ── */
  function calcOffset(idx, cardW) {
    const gap      = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-gap')) || 20;
    const viewW    = document.querySelector('.carousel-track-container').offsetWidth;
    const centerX  = viewW / 2;
    const cardLeft = idx * (cardW + gap);
    return centerX - cardLeft - cardW / 2;
  }

  function getCardWidth() {
    const card = track.querySelector('.game-card');
    return card ? card.offsetWidth : 280;
  }

  /* ── Events binden ── */
  function bindEvents() {
    // Arrows
    arrowL?.addEventListener('click', () => goTo(current - 1));
    arrowR?.addEventListener('click', () => goTo(current + 1));

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (FocusPanel.isOpen()) return;
      if (e.key === 'ArrowLeft')  goTo(current - 1);
      if (e.key === 'ArrowRight') goTo(current + 1);
      if (e.key === 'Enter')      FocusPanel.open(games[current]);
    });

    // Touch
    const container = document.querySelector('.carousel-track-container');
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove',  onTouchMove,  { passive: true });
    container.addEventListener('touchend',   onTouchEnd,   { passive: true });

    // Mouse drag
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);

    // Resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => goTo(current, false), 150);
    });
  }

  /* ── Touch Handlers ── */
  function onTouchStart(e) {
    isTouch  = true;
    isDragging = false;
    dragX    = 0;
    startX   = e.touches[0].clientX;
    track.style.transition = 'none';
  }
  function onTouchMove(e) {
    dragX = e.touches[0].clientX - startX;
    isDragging = Math.abs(dragX) > 6;
    if (isDragging) {
      const base = calcOffset(current, getCardWidth());
      track.style.transform = `translateX(${base + dragX * 0.4}px)`;
    }
  }
  function onTouchEnd() {
    if (Math.abs(dragX) > 60) {
      dragX < 0 ? goTo(current + 1) : goTo(current - 1);
    } else {
      goTo(current); // Snap zurück
    }
    setTimeout(() => { isDragging = false; dragX = 0; }, 100);
  }

  /* ── Mouse Drag Handlers ── */
  function onMouseDown(e) {
    if (isTouch) return;
    isDragging = false;
    dragX    = 0;
    startX   = e.clientX;
    track.style.transition = 'none';
    document.querySelector('.carousel-track-container').classList.add('grabbing');
  }
  function onMouseMove(e) {
    if (!startX || isTouch) return;
    dragX = e.clientX - startX;
    if (Math.abs(dragX) > 8) {
      isDragging = true;
      const base = calcOffset(current, getCardWidth());
      track.style.transform = `translateX(${base + dragX * 0.4}px)`;
    }
  }
  function onMouseUp() {
    if (!isDragging || isTouch) { startX = 0; return; }
    if (Math.abs(dragX) > 70) {
      dragX < 0 ? goTo(current + 1) : goTo(current - 1);
    } else {
      goTo(current);
    }
    startX = 0;
    setTimeout(() => { isDragging = false; dragX = 0; }, 100);
    document.querySelector('.carousel-track-container').classList.remove('grabbing');
  }

  return { init, goTo, current: () => current };
})();

/* ─────────────────────────────────────────────────────────
   5. FOCUS PANEL (Steam-ähnliches Spiel-Detailfenster)
   ───────────────────────────────────────────────────────── */
const FocusPanel = (() => {
  const overlay   = document.getElementById('focus-overlay');
  const panel     = document.getElementById('focus-panel');
  const closeBtn  = document.getElementById('focus-close');
  const playBtn   = document.getElementById('focus-play-btn');
  const favBtn    = document.getElementById('focus-fav-btn');
  const launchPrg = document.getElementById('launch-progress');
  const launchBar = document.getElementById('launch-bar');

  let activeGame   = null;
  let open         = false;
  let launching    = false;

  /* ── Öffnen ── */
  function openPanel(game) {
    if (!game) return;
    activeGame = game;
    open       = true;

    // Inhalte befüllen
    document.getElementById('focus-cover').style.backgroundImage =
      game.cover ? `url('${game.cover}')` : 'none';
    document.getElementById('focus-cover').style.backgroundColor =
      (game.coverColor || '#00e5ff') + '33';
    document.getElementById('focus-cover-glow').style.background = '';

    const badge = document.getElementById('focus-badge');
    if (game.badge) {
      badge.textContent = game.badge;
      badge.className   = `focus-badge visible badge--${game.badge.toLowerCase()}`;
    } else {
      badge.className = 'focus-badge';
    }

    document.getElementById('focus-title').textContent  = game.title;
    document.getElementById('focus-genre').textContent  = game.genre || '';
    document.getElementById('focus-desc').textContent   = game.description || '';
    document.getElementById('focus-rating').textContent = game.rating ? `★ ${game.rating}` : '—';
    document.getElementById('focus-status').textContent =
      game.status === 'ready' ? '✓ Bereit' : '⏳ Coming Soon';
    document.getElementById('focus-status').style.color =
      game.status === 'ready' ? '#00e87a' : 'var(--gold)';

    const hs = StorageManager.getHighscore(game.id);
    document.getElementById('focus-highscore').textContent = hs !== null ? hs.toLocaleString() : '—';

    // Favorit-Button
    const isFav = StorageManager.isFavorite(game.id);
    favBtn.classList.toggle('active', isFav);

    // Play-Button
    if (game.status === 'ready') {
      playBtn.disabled     = false;
      playBtn.innerHTML    = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> SPIELEN`;
    } else {
      playBtn.disabled     = true;
      playBtn.innerHTML    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> COMING SOON`;
    }
    launchPrg.classList.remove('visible');
    launching = false;

    // Zeigen
    overlay.classList.add('open');
    document.body.classList.add('focus-open');
    closeBtn.focus();
  }

  /* ── Schließen ── */
  function closePanel() {
    open = false;
    launching = false;
    overlay.classList.remove('open');
    document.body.classList.remove('focus-open');
    launchPrg.classList.remove('visible');
  }

  /* ── Spiel starten ── */
  function launchGame(game) {
    if (!game || game.status !== 'ready' || launching) return;
    launching = true;

    playBtn.disabled = true;
    launchPrg.classList.add('visible');
    launchBar.style.width = '0%';

    StorageManager.setLastPlayed(game.id);
    showToast(`🎮 ${game.title} wird gestartet…`);

    // Ladebalken-Animation
    let progress = 0;
    const speeds = [2, 3, 1.5, 4, 2.5];
    let speedIdx = 0;
    const fill = setInterval(() => {
      progress += speeds[speedIdx % speeds.length] * (Math.random() + 0.5);
      speedIdx++;
      if (progress >= 100) {
        progress = 100;
        clearInterval(fill);
        launchBar.style.width = '100%';
        setTimeout(() => {
          // Spiel in neuem Tab öffnen
          window.open(game.path, '_blank');
          closePanel();
          launching = false;
        }, 400);
      }
      launchBar.style.width = progress + '%';
    }, 80);
  }

  /* ── Events ── */
  function init() {
    closeBtn.addEventListener('click', closePanel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePanel();
    });
    playBtn.addEventListener('click', () => launchGame(activeGame));
    favBtn.addEventListener('click', () => {
      if (!activeGame) return;
      const isFav = StorageManager.toggleFavorite(activeGame.id);
      favBtn.classList.toggle('active', isFav);
      showToast(isFav ? `❤️ ${activeGame.title} zu Favoriten hinzugefügt` : `💔 Aus Favoriten entfernt`);
    });
    document.addEventListener('keydown', (e) => {
      if (open && e.key === 'Escape') closePanel();
    });
  }

  return {
    init,
    open: openPanel,
    close: closePanel,
    isOpen: () => open,
  };
})();

/* ─────────────────────────────────────────────────────────
   6. FULLSCREEN TOGGLE
   ───────────────────────────────────────────────────────── */
function initFullscreen() {
  const btn = document.getElementById('fullscreen-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const isFs = !!document.fullscreenElement;
    btn.title = isFs ? 'Vollbild beenden' : 'Vollbild';
    // SVG tauschen
    btn.innerHTML = isFs
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`;
  });
}

/* ─────────────────────────────────────────────────────────
   7. TOAST NOTIFICATIONS
   ───────────────────────────────────────────────────────── */
let toastTimer = null;
function showToast(msg, duration = 2800) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = msg;
  el.classList.add('show');
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

/* ─────────────────────────────────────────────────────────
   8. UI UPDATER
   Wird vom Carousel aufgerufen wenn aktives Spiel sich ändert
   ───────────────────────────────────────────────────────── */
function onGameChange(game, idx) {
  if (!game) return;

  // Hero-Section
  animateTextChange('active-title', game.title);
  animateTextChange('active-genre', (game.genre || '').toUpperCase());

  // Info-Bar
  document.getElementById('active-rating').textContent =
    game.rating ? `★ ${game.rating}` : '—';
  document.getElementById('active-status').textContent =
    game.status === 'ready' ? '✓ Bereit' : '⏳ Coming Soon';

  const lp = StorageManager.getLastPlayed(game.id);
  document.getElementById('active-lastplayed').textContent = lp || 'Nie';
}

function animateTextChange(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.opacity   = '0';
  el.style.transform = 'translateY(8px)';
  setTimeout(() => {
    el.textContent = text;
    el.style.transition = 'opacity 0.3s, transform 0.3s';
    el.style.opacity     = '1';
    el.style.transform   = 'translateY(0)';
  }, 150);
}

/* ─────────────────────────────────────────────────────────
   9. COVER PLACEHOLDER GENERATOR
   Generiert Fallback-Cover wenn kein Bild vorhanden
   ───────────────────────────────────────────────────────── */
function generatePlaceholderCovers(games) {
  // Überprüfe ob Bilder existieren; wenn nicht → SVG-Fallback
  games.forEach(g => {
    if (!g.cover) {
      g.cover = generateSVGCover(g);
    }
  });
}

function generateSVGCover(game) {
  const color  = game.coverColor || '#00e5ff';
  const initials = game.title.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="440" viewBox="0 0 320 440">
      <defs>
        <linearGradient id="g${game.id}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#080c14" stop-opacity="1"/>
        </linearGradient>
        <filter id="blur${game.id}">
          <feGaussianBlur stdDeviation="3"/>
        </filter>
      </defs>
      <rect width="320" height="440" fill="url(#g${game.id})"/>
      <circle cx="160" cy="180" r="100" fill="${color}" opacity="0.06" filter="url(#blur${game.id})"/>
      <circle cx="160" cy="180" r="60" fill="${color}" opacity="0.1"/>
      <text x="160" y="205" text-anchor="middle" font-family="Rajdhani,sans-serif" font-size="52" font-weight="700" fill="${color}" opacity="0.9">${initials}</text>
      <text x="160" y="340" text-anchor="middle" font-family="Rajdhani,sans-serif" font-size="18" font-weight="600" fill="white" opacity="0.7">${game.title}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/* ─────────────────────────────────────────────────────────
   10. APP INIT
   ───────────────────────────────────────────────────────── */
async function init() {
  try {
    // Manifest laden
    let manifest;
    try {
      const res = await fetch('./manifest.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      manifest = await res.json();
    } catch (e) {
      console.error('[Launcher] manifest.json konnte nicht geladen werden:', e);
      showToast('⚠️ manifest.json nicht gefunden – Demo-Modus aktiv');
      manifest = { launcher: { title: 'ARCADE HUB', subtitle: 'Demo' }, games: [] };
    }

    const games = (manifest.games || []).slice(0, 10);

    // Titelleiste aus Manifest
    if (manifest.launcher?.title) {
      document.title = manifest.launcher.title;
      const logoText = document.querySelector('.logo-text');
      if (logoText) logoText.textContent = manifest.launcher.title;
    }

    // Player-Avatar Initial (erstes Spiel-Lieblings-Init)
    const playerEl = document.querySelector('.player-name');
    if (playerEl) playerEl.textContent = StorageManager.get('player-name', 'Player');

    // Fallback-Cover generieren
    generatePlaceholderCovers(games);

    // Sub-Module starten
    ThemeManager.init();
    BackgroundFX.init();
    FocusPanel.init();
    initFullscreen();
    Carousel.init(games, onGameChange);

    // Willkommens-Toast
    setTimeout(() => showToast('👾 Willkommen! Wähle ein Spiel aus.'), 1200);

  } catch (err) {
    console.error('[Launcher] Init-Fehler:', err);
  }
}

// Warte auf DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
