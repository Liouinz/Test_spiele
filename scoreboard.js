// ═══════════════════════════════════════════════════════════════
//  COIN FOREST v5.1 – scoreboard.js
//  Lokales Scoreboard Top-50, Statistiken, Profil-Anzeige
// ═══════════════════════════════════════════════════════════════

'use strict';

const Scoreboard = (() => {

  const GLOBAL_KEY = 'cf_global_scores';
  const MAX_GLOBAL = 50;

  // ── Globale Score-Liste ───────────────────────────────────
  function loadGlobal() {
    try { return JSON.parse(localStorage.getItem(GLOBAL_KEY) || '[]'); }
    catch { return []; }
  }
  function saveGlobal(list) {
    localStorage.setItem(GLOBAL_KEY, JSON.stringify(list));
  }

  // ── Score hinzufügen ──────────────────────────────────────
  function addScore(score, level, coins, combo, timeSeconds, playerName) {
    const list = loadGlobal();
    const entry = {
      score, level, coins, combo, timeSeconds,
      name: (playerName || 'GAST').toUpperCase().slice(0, 12),
      date: Date.now(),
      deviceId: Auth ? Auth.getDeviceId() : 'unknown',
    };
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    if (list.length > MAX_GLOBAL) list.length = MAX_GLOBAL;
    saveGlobal(list);
    return list.findIndex(e => e === entry);
  }

  // ── Rangliste abrufen ─────────────────────────────────────
  function getGlobalScores(sortBy = 'score') {
    const list = loadGlobal();
    switch (sortBy) {
      case 'score':  list.sort((a,b) => b.score  - a.score);  break;
      case 'level':  list.sort((a,b) => b.level  - a.level);  break;
      case 'coins':  list.sort((a,b) => b.coins  - a.coins);  break;
      case 'combo':  list.sort((a,b) => b.combo  - a.combo);  break;
      case 'time':   list.sort((a,b) => b.timeSeconds - a.timeSeconds); break;
      case 'date':   list.sort((a,b) => b.date   - a.date);   break;
    }
    return list;
  }

  // ── Eigene Scores ─────────────────────────────────────────
  function getMyScores() {
    const profile = Auth ? Auth.getActiveProfile() : null;
    if (!profile) return [];
    return loadGlobal().filter(e => e.deviceId === Auth.getDeviceId());
  }

  // ── Bestes Score ─────────────────────────────────────────
  function getBestScore() {
    const list = loadGlobal();
    return list.length > 0 ? list[0].score : 0;
  }

  function getMyBestScore() {
    const my = getMyScores();
    return my.length > 0 ? Math.max(...my.map(e => e.score)) : 0;
  }

  // ── Ist neuer Highscore? ──────────────────────────────────
  function isNewHighscore(score) {
    return score > getMyBestScore();
  }

  // ── Formatierung ─────────────────────────────────────────
  function formatScore(n) {
    return n.toLocaleString('de-DE');
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}`;
  }

  function getRankMedal(rank) {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return `#${rank + 1}`;
  }

  // ── Scoreboard-Screen rendern ─────────────────────────────
  function render(sortBy = 'score', showMine = false) {
    const list = showMine ? getMyScores() : getGlobalScores(sortBy);
    const myDeviceId = Auth ? Auth.getDeviceId() : '';
    const container = document.getElementById('scores-list');
    if (!container) return;

    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:24px;font-size:8px;color:var(--text3)">
          Noch keine Einträge.<br><br>Spiele zuerst eine Runde!
        </div>`;
      return;
    }

    list.forEach((entry, i) => {
      const isMe = entry.deviceId === myDeviceId;
      const div = document.createElement('div');
      div.className = 'score-entry' + (isMe ? ' me' : '');
      div.innerHTML = `
        <span class="se-rank">${getRankMedal(i)}</span>
        <span class="se-name">${entry.name}${isMe ? ' ◀' : ''}</span>
        <span class="se-score">${formatScore(entry.score)}</span>
        <span class="se-level">Lv${entry.level}</span>
        <span class="se-date">${formatDate(entry.date)}</span>
      `;
      container.appendChild(div);
    });
  }

  // ── Achievements definieren ───────────────────────────────
  const ACHIEVEMENTS = [
    { id: 'first_coin',   icon: '🪙', name: 'Erster Coin!',     desc: 'Ersten Coin eingesammelt.',       condition: s => s.totalCoins >= 1      },
    { id: 'coin_100',     icon: '💰', name: 'Reicher Spieler',  desc: '100 Coins gesammelt.',            condition: s => s.totalCoins >= 100    },
    { id: 'coin_1000',    icon: '🏦', name: 'Münzmeister',      desc: '1000 Coins gesammelt.',           condition: s => s.totalCoins >= 1000   },
    { id: 'first_level',  icon: '⭐', name: 'Aufgestiegen!',    desc: 'Level 2 erreicht.',              condition: s => s.bestLevel >= 2       },
    { id: 'level_10',     icon: '🌟', name: 'Profi-Sammler',    desc: 'Level 10 erreicht.',              condition: s => s.bestLevel >= 10      },
    { id: 'combo_5',      icon: '🔥', name: 'Kombinierer',      desc: '5x Combo erreicht.',              condition: s => s.bestCombo >= 5       },
    { id: 'combo_15',     icon: '💥', name: 'Combo-König',      desc: '15x Combo erreicht.',             condition: s => s.bestCombo >= 15      },
    { id: 'survivor',     icon: '🛡️', name: 'Überlebender',    desc: '5 Minuten gespielt.',             condition: s => s.totalTime >= 300     },
    { id: 'veteran',      icon: '🎖️', name: 'Veteran',         desc: '10 Spiele gespielt.',             condition: s => s.gamesPlayed >= 10    },
    { id: 'pu_collector', icon: '✨', name: 'Power-Hunter',     desc: '20 Power-Ups gesammelt.',         condition: s => s.powerUpsUsed >= 20   },
  ];

  function checkAchievements(stats) {
    const profile = Auth ? Auth.getActiveProfile() : null;
    const unlocked = profile ? (profile.unlockedAchievements || []) : [];
    const newOnes = [];

    ACHIEVEMENTS.forEach(ach => {
      if (unlocked.includes(ach.id)) return;
      if (ach.condition(stats)) {
        unlocked.push(ach.id);
        newOnes.push(ach);
      }
    });

    if (newOnes.length > 0 && profile) {
      Auth.updateProfile(profile.id, p => {
        p.unlockedAchievements = unlocked;
        p.stats.achievementsUnlocked = unlocked.length;
      });
    }

    return newOnes;
  }

  // ── Statistiken-Panel rendern ─────────────────────────────
  function renderStats() {
    const profile = Auth ? Auth.getActiveProfile() : null;
    const s = profile ? profile.stats : null;
    const container = document.getElementById('stats-panel');
    if (!container || !s) return;

    const unlocked = profile.unlockedAchievements || [];
    const achCount = `${unlocked.length}/${ACHIEVEMENTS.length}`;

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:6px;color:var(--text2)">
        <div class="stat-cell"><span class="sc-l">Spiele</span><span class="sc-v">${s.gamesPlayed}</span></div>
        <div class="stat-cell"><span class="sc-l">Bestpunktz.</span><span class="sc-v" style="color:var(--green)">${formatScore(s.bestScore)}</span></div>
        <div class="stat-cell"><span class="sc-l">Coins gesamt</span><span class="sc-v" style="color:var(--accent)">${formatScore(s.totalCoins)}</span></div>
        <div class="stat-cell"><span class="sc-l">Bestes Level</span><span class="sc-v" style="color:var(--accent)">${s.bestLevel}</span></div>
        <div class="stat-cell"><span class="sc-l">Beste Combo</span><span class="sc-v" style="color:var(--orange)">x${s.bestCombo}</span></div>
        <div class="stat-cell"><span class="sc-l">Spielzeit</span><span class="sc-v">${formatTime(Math.floor(s.totalTime))}</span></div>
        <div class="stat-cell"><span class="sc-l">Power-Ups</span><span class="sc-v" style="color:var(--purple)">${s.powerUpsUsed}</span></div>
        <div class="stat-cell"><span class="sc-l">Erfolge</span><span class="sc-v" style="color:var(--accent)">${achCount}</span></div>
      </div>
      <style>.stat-cell{display:flex;justify-content:space-between;padding:4px 8px;background:var(--dark2);border:1px solid var(--border)}.sc-l{color:var(--text3)}.sc-v{color:var(--text)}</style>
    `;
  }

  // ── Top 3 für Menü ────────────────────────────────────────
  function renderTop3Menu() {
    const list  = getGlobalScores('score').slice(0, 3);
    const myDev = Auth ? Auth.getDeviceId() : '';
    const container = document.getElementById('top3-list');
    if (!container) return;

    container.innerHTML = '';
    if (list.length === 0) {
      container.innerHTML = '<div style="font-size:7px;color:var(--text3);padding:8px;text-align:center">Noch keine Scores!</div>';
      return;
    }

    list.forEach((entry, i) => {
      const isMe = entry.deviceId === myDev;
      const div  = document.createElement('div');
      div.className = 'hs-row';
      div.innerHTML = `
        <span class="hs-medal">${getRankMedal(i)}</span>
        <span class="hs-name">${entry.name}</span>
        <span class="hs-level">Lv${entry.level}</span>
        <span class="hs-score">${formatScore(entry.score)}</span>
      `;
      container.appendChild(div);
    });
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    addScore,
    getGlobalScores,
    getMyScores,
    getBestScore,
    getMyBestScore,
    isNewHighscore,
    formatScore,
    formatTime,
    formatDate,
    getRankMedal,
    render,
    renderStats,
    renderTop3Menu,
    checkAchievements,
    ACHIEVEMENTS,
  };

})();
