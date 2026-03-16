// ═══════════════════════════════════════════════════════════════
//  COIN FOREST v5.1 – auth.js
//  Profile, Gast-Modus, Browser-Fingerprint, localStorage
// ═══════════════════════════════════════════════════════════════

'use strict';

const Auth = (() => {

  const MAX_PROFILES   = 5;
  const STORAGE_KEY    = 'cf_profiles';
  const ACTIVE_KEY     = 'cf_active_profile';
  const FINGERPRINT_KEY = 'cf_device_id';

  // ── Browser-Fingerprint ────────────────────────────────────
  function generateFingerprint() {
    const parts = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      navigator.platform || '',
    ];
    let hash = 0;
    const str = parts.join('|');
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'dev_' + Math.abs(hash).toString(36);
  }

  function getDeviceId() {
    let id = localStorage.getItem(FINGERPRINT_KEY);
    if (!id) {
      id = generateFingerprint() + '_' + Date.now().toString(36);
      localStorage.setItem(FINGERPRINT_KEY, id);
    }
    return id;
  }

  // ── Profil-Struktur ────────────────────────────────────────
  function createProfile(name) {
    return {
      id:        Date.now().toString(36) + Math.random().toString(36).slice(2),
      name:      name.toUpperCase().slice(0, 12),
      deviceId:  getDeviceId(),
      createdAt: Date.now(),
      stats: {
        gamesPlayed: 0,
        totalCoins:  0,
        totalScore:  0,
        bestScore:   0,
        bestLevel:   0,
        bestCombo:   0,
        totalTime:   0,  // Sekunden
        banditsAvoided: 0,
        powerUpsUsed:   0,
        achievementsUnlocked: 0,
      },
      scores:  [],  // Top-10 Scores dieses Profils
      settings: {
        mapSize:    'mittel',
        startSeason: 0,
        sfx:         true,
        vibration:   true,
      },
    };
  }

  // ── Storage ────────────────────────────────────────────────
  function loadProfiles() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  }

  function saveProfiles(profiles) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  }

  // ── Profil-Verwaltung ─────────────────────────────────────
  function getProfiles() { return loadProfiles(); }

  function getActiveProfile() {
    const id = localStorage.getItem(ACTIVE_KEY);
    if (!id) return null;
    return loadProfiles().find(p => p.id === id) || null;
  }

  function setActiveProfile(id) {
    localStorage.setItem(ACTIVE_KEY, id);
  }

  function createAndSetProfile(name) {
    const profiles = loadProfiles();
    if (profiles.length >= MAX_PROFILES) return null;
    const profile = createProfile(name);
    profiles.push(profile);
    saveProfiles(profiles);
    setActiveProfile(profile.id);
    return profile;
  }

  function updateProfile(id, updater) {
    const profiles = loadProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return;
    updater(profiles[idx]);
    saveProfiles(profiles);
  }

  function deleteProfile(id) {
    const profiles = loadProfiles().filter(p => p.id !== id);
    saveProfiles(profiles);
    if (localStorage.getItem(ACTIVE_KEY) === id) {
      localStorage.removeItem(ACTIVE_KEY);
    }
  }

  // ── Score speichern ───────────────────────────────────────
  function saveScore(score, level, coins, combo, timeSeconds) {
    const profile = getActiveProfile();
    if (!profile) return false; // Gast

    const entry = {
      score, level, coins, combo,
      timeSeconds,
      date: Date.now(),
    };

    updateProfile(profile.id, p => {
      p.stats.gamesPlayed++;
      p.stats.totalCoins  += coins;
      p.stats.totalScore  += score;
      p.stats.totalTime   += timeSeconds;
      if (score > p.stats.bestScore) p.stats.bestScore = score;
      if (level > p.stats.bestLevel) p.stats.bestLevel = level;
      if (combo > p.stats.bestCombo) p.stats.bestCombo = combo;

      p.scores.push(entry);
      p.scores.sort((a, b) => b.score - a.score);
      if (p.scores.length > 10) p.scores.length = 10;
    });

    return true;
  }

  // ── Profil-Name validieren ────────────────────────────────
  function validateName(name) {
    const trimmed = name.trim();
    if (trimmed.length < 2) return { ok: false, msg: 'Mindestens 2 Zeichen' };
    if (trimmed.length > 12) return { ok: false, msg: 'Maximal 12 Zeichen' };
    if (!/^[a-zA-Z0-9_\-äöüÄÖÜ]+$/.test(trimmed)) return { ok: false, msg: 'Nur Buchstaben & Zahlen' };
    const taken = loadProfiles().some(p => p.name === trimmed.toUpperCase());
    if (taken) return { ok: false, msg: 'Name bereits vergeben' };
    return { ok: true };
  }

  // ── Einstellungen speichern ───────────────────────────────
  function saveSetting(key, value) {
    const profile = getActiveProfile();
    if (!profile) {
      // Gast: in sessionStorage
      sessionStorage.setItem('cf_guest_' + key, JSON.stringify(value));
      return;
    }
    updateProfile(profile.id, p => {
      p.settings[key] = value;
    });
  }

  function getSetting(key, defaultVal) {
    const profile = getActiveProfile();
    if (!profile) {
      try {
        const val = sessionStorage.getItem('cf_guest_' + key);
        return val !== null ? JSON.parse(val) : defaultVal;
      } catch { return defaultVal; }
    }
    return profile.settings[key] ?? defaultVal;
  }

  // ── Profil-Statistiken aktualisieren ──────────────────────
  function updateStats(delta) {
    const profile = getActiveProfile();
    if (!profile) return;
    updateProfile(profile.id, p => {
      for (const [key, val] of Object.entries(delta)) {
        if (key in p.stats) p.stats[key] += val;
      }
    });
  }

  // ── Gast-Modus ────────────────────────────────────────────
  function isGuest() { return !getActiveProfile(); }

  function getDisplayName() {
    const p = getActiveProfile();
    return p ? p.name : 'GAST';
  }

  // ── UI befüllen ───────────────────────────────────────────
  function applySettingsToUI() {
    const mapSize    = getSetting('mapSize', 'mittel');
    const season     = getSetting('startSeason', 0);

    // Map-Größe Buttons
    document.querySelectorAll('[data-setting="mapSize"]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === mapSize);
    });

    // Jahreszeit Buttons
    document.querySelectorAll('[data-setting="startSeason"]').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.value) === season);
    });

    // Spieler-Name
    const nameInput = document.getElementById('player-name');
    if (nameInput) {
      const p = getActiveProfile();
      nameInput.value = p ? p.name : '';
    }
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    getProfiles,
    getActiveProfile,
    setActiveProfile,
    createAndSetProfile,
    updateProfile,
    deleteProfile,
    saveScore,
    validateName,
    saveSetting,
    getSetting,
    updateStats,
    isGuest,
    getDisplayName,
    applySettingsToUI,
    getDeviceId,
    MAX_PROFILES,
  };

})();
