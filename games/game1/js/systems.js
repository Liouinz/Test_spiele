/**
 * ============================================================
 * SYSTEMS MODULE  –  systems.js
 * ============================================================
 * Enthält alle Game-Systeme (nicht-visuelle Logik):
 *
 *   InputSystem       – Tastatur + dynamischer Touch-Joystick
 *   CameraController  – Smooth-Orbit Third-Person Kamera
 *   CoinSystem        – Spawn, Animation, Glow, Collect-Effekt
 *   ParticleSystem    – Pool-basierte Partikel (Münz-Burst)
 *   UISystem          – Münz-Zähler, Back-Button, Mobile-Hinweise
 *
 * Design-Entscheidungen:
 *   - InputSystem gibt einen normalisierten Vektor zurück, kein
 *     direktes Positions-Update → saubere Trennung von Input + Physik
 *   - CameraController nutzt Lerp für alle 3 Achsen → kein Ruckeln
 *   - Partikel-Pool statt neuer Objekte = kein GC-Druck
 *   - Münzen nutzen emissive Materials für Glow (kein Post-Processing nötig)
 * ============================================================
 */

import { THREE } from './engine.js';

// ═══════════════════════════════════════════════════════════
//  INPUT SYSTEM
// ═══════════════════════════════════════════════════════════
/**
 * Kapselt Tastatur + Touch-Joystick.
 * getDirection() → normalisierten {x, z} Vektor für Player.
 *
 * Touch-System:
 *   - Joystick spawnt wo der Finger aufsetzt (dynamisch)
 *   - Auslenkung vom Ursprung bestimmt Richtung + Intensität
 *   - Maximaler Radius = JOY_MAX_RADIUS px
 *   - Rechte Bildschirm-Hälfte = Kamera-Drag (separater Touch)
 */
export class InputSystem {
  constructor() {
    this._keys     = {};
    this._joy      = { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0 };
    this._camDrag  = { active: false, id: null, lastX: 0, lastY: 0, deltaX: 0, deltaY: 0 };
    this._pinch    = null;   // { startDist, startCamDist }
    this._JOY_R    = 44;     // Joystick-Maximal-Radius in Pixel

    this._joyBaseEl  = document.getElementById('joy-base');
    this._joyStickEl = document.getElementById('joy-stick');
  }

  init(rendererCanvas) {
    this._bindKeyboard();
    this._bindTouch(rendererCanvas);
    this._bindMouse(rendererCanvas);
    return this;
  }

  // ── Tastatur ──────────────────────────────────────────────
  _bindKeyboard() {
    window.addEventListener('keydown', e => {
      this._keys[e.key] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))
        e.preventDefault();
    });
    window.addEventListener('keyup', e => { this._keys[e.key] = false; });
  }

  // ── Touch ─────────────────────────────────────────────────
  _bindTouch(canvas) {
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const isLeft = t.clientX < window.innerWidth / 2;
        if (isLeft && !this._joy.active) {
          this._startJoy(t);
        } else if (!isLeft && !this._camDrag.active) {
          this._startCamDrag(t);
        }
      }
      if (e.touches.length >= 2) {
        const d = this._touchDist(e.touches[0], e.touches[1]);
        this._pinch = { startDist: d, startCamDist: null };  // camDist kommt vom CameraController
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this._joy.active     && t.identifier === this._joy.id)     this._moveJoy(t);
        if (this._camDrag.active && t.identifier === this._camDrag.id) this._moveCamDrag(t);
      }
      if (e.touches.length >= 2 && this._pinch) {
        this._pinch.currentDist = this._touchDist(e.touches[0], e.touches[1]);
      }
    }, { passive: false });

    const onEnd = e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this._joy.active     && t.identifier === this._joy.id)     this._resetJoy();
        if (this._camDrag.active && t.identifier === this._camDrag.id) this._camDrag.active = false;
      }
      if (e.touches.length < 2) {
        this._pinch = null;
        this._camDrag.deltaX = this._camDrag.deltaY = 0;
      }
    };
    canvas.addEventListener('touchend',    onEnd, { passive: false });
    canvas.addEventListener('touchcancel', onEnd, { passive: false });
  }

  _startJoy(t) {
    const j = this._joy;
    j.active = true; j.id = t.identifier;
    j.baseX = t.clientX; j.baseY = t.clientY;
    j.dx = j.dy = 0;
    // Joystick-Base an Finger-Position setzen
    const el = this._joyBaseEl;
    el.style.left   = (t.clientX - 55) + 'px';
    el.style.top    = (t.clientY - 55) + 'px';
    el.style.bottom = 'auto';
  }

  _moveJoy(t) {
    const j   = this._joy;
    const dx  = t.clientX - j.baseX;
    const dy  = t.clientY - j.baseY;
    const len = Math.hypot(dx, dy) || 1;
    const cl  = Math.min(len, this._JOY_R);
    j.dx      = (dx / len) * (cl / this._JOY_R);
    j.dy      = (dy / len) * (cl / this._JOY_R);
    // Stick-Grafik aktualisieren
    this._joyStickEl.style.left = (55 + j.dx * this._JOY_R) + 'px';
    this._joyStickEl.style.top  = (55 + j.dy * this._JOY_R) + 'px';
  }

  _resetJoy() {
    const j = this._joy;
    j.active = false; j.dx = j.dy = 0;
    this._joyStickEl.style.left = '55px';
    this._joyStickEl.style.top  = '55px';
    const el = this._joyBaseEl;
    el.style.left   = '50px';
    el.style.bottom = '50px';
    el.style.top    = 'auto';
  }

  _startCamDrag(t) {
    const c = this._camDrag;
    c.active = true; c.id = t.identifier;
    c.lastX = t.clientX; c.lastY = t.clientY;
    c.deltaX = c.deltaY = 0;
  }

  _moveCamDrag(t) {
    const c = this._camDrag;
    c.deltaX = t.clientX - c.lastX;
    c.deltaY = t.clientY - c.lastY;
    c.lastX  = t.clientX;
    c.lastY  = t.clientY;
  }

  _touchDist(t1, t2) {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  }

  // ── Maus-Kamera + Scroll ──────────────────────────────────
  _bindMouse(canvas) {
    let down = false, lx = 0, ly = 0;
    canvas.addEventListener('mousedown', e => {
      down = true; lx = e.clientX; ly = e.clientY;
      this._camDrag.deltaX = this._camDrag.deltaY = 0;
    });
    window.addEventListener('mouseup', () => {
      down = false;
      this._camDrag.deltaX = this._camDrag.deltaY = 0;
    });
    window.addEventListener('mousemove', e => {
      if (!down) return;
      this._camDrag.deltaX = e.clientX - lx;
      this._camDrag.deltaY = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener('wheel', e => {
      this._scrollDelta = e.deltaY;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  /**
   * getDirection()
   * Gibt den normalisierten Eingabe-Vektor zurück.
   * { x: -1..1, z: -1..1 }  (nicht auf 1 normalisiert, für Joystick-Analogität)
   */
  getDirection() {
    const k  = this._keys;
    let x = 0, z = 0;
    if (k['ArrowLeft']  || k['a'] || k['A']) x -= 1;
    if (k['ArrowRight'] || k['d'] || k['D']) x += 1;
    if (k['ArrowUp']    || k['w'] || k['W']) z -= 1;
    if (k['ArrowDown']  || k['s'] || k['S']) z += 1;
    if (this._joy.active) { x += this._joy.dx; z += this._joy.dy; }
    // Diagonal normalisieren
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    return { x, z };
  }

  /** Kamera-Dreh-Delta dieses Frames (wird nach dem Lesen resettet) */
  consumeCamDelta() {
    const d = { x: this._camDrag.deltaX, y: this._camDrag.deltaY };
    this._camDrag.deltaX = this._camDrag.deltaY = 0;
    return d;
  }

  /** Pinch-Zoom-Faktor (null wenn kein Pinch aktiv) */
  getPinch() { return this._pinch || null; }

  /** Scroll-Delta (Mausrad) */
  consumeScrollDelta() {
    const d = this._scrollDelta || 0;
    this._scrollDelta = 0;
    return d;
  }
}


// ═══════════════════════════════════════════════════════════
//  CAMERA CONTROLLER
// ═══════════════════════════════════════════════════════════
/**
 * Smooth Third-Person Orbit-Kamera.
 *
 * Orbit-Modell:
 *   cam.h  = horizontaler Winkel um Y-Achse
 *   cam.v  = vertikaler Winkel (Elevation)
 *   cam.dist = Abstand zum Target
 *
 * Alle drei Werte werden per Lerp interpoliert → kein Ruckeln.
 * Kamera-Position:
 *   x = target.x + dist * sin(h) * cos(v)
 *   y = target.y + dist * sin(v) + eyeHeight
 *   z = target.z + dist * cos(h) * cos(v)
 */
export class CameraController {
  constructor(camera) {
    this.camera      = camera;
    this.h           = 0;      // horizontaler Winkel
    this.v           = 0.42;   // vertikaler Winkel (Elevation)
    this.dist        = 11;     // Soll-Abstand
    this._smoothDist = 11;     // Aktuell interpolierter Abstand
    this.distMin     = 3;
    this.distMax     = 22;
    this._target     = new THREE.Vector3();
    this._lookAt     = new THREE.Vector3();
  }

  /**
   * update(dt, targetPos, input)
   * Verarbeitet Kamera-Input und interpoliert Position.
   */
  update(dt, targetPos, input) {
    // ── Kamera drehen (Maus/Touch) ──
    const camDelta  = input.consumeCamDelta();
    this.h         -= camDelta.x * 0.0075;
    this.v          = THREE.MathUtils.clamp(this.v + camDelta.y * 0.0075, 0.08, 1.25);

    // ── Zoom (Scroll + Pinch) ──
    const scroll = input.consumeScrollDelta();
    if (scroll) this.dist = THREE.MathUtils.clamp(this.dist + scroll * 0.013, this.distMin, this.distMax);

    const pinch = input.getPinch();
    if (pinch && pinch.startCamDist == null) {
      pinch.startCamDist = this._smoothDist;  // Erst jetzt Dist einfrieren
    }
    if (pinch && pinch.currentDist && pinch.startCamDist != null) {
      const ratio  = pinch.startDist / pinch.currentDist;
      this.dist    = THREE.MathUtils.clamp(pinch.startCamDist * ratio, this.distMin, this.distMax);
    }

    // ── Position interpolieren (Smooth Lerp) ──
    this._smoothDist += (this.dist - this._smoothDist) * Math.min(1, 8 * dt);

    const sh  = Math.sin(this.h), ch = Math.cos(this.h);
    const sv  = Math.sin(this.v), cv = Math.cos(this.v);
    const tx  = targetPos.x + this._smoothDist * sh * cv;
    const ty  = targetPos.y + this._smoothDist * sv + 1.5;
    const tz  = targetPos.z + this._smoothDist * ch * cv;

    // Kamera-Position Lerp (weicher als direktes Setzen)
    const lerpSpeed = Math.min(1, 10 * dt);
    this.camera.position.x += (tx - this.camera.position.x) * lerpSpeed;
    this.camera.position.y += (ty - this.camera.position.y) * lerpSpeed;
    this.camera.position.z += (tz - this.camera.position.z) * lerpSpeed;

    // LookAt-Punkt = Spieler-Kopf-Höhe
    this._lookAt.set(targetPos.x, targetPos.y + 1.1, targetPos.z);
    this.camera.lookAt(this._lookAt);
  }
}


// ═══════════════════════════════════════════════════════════
//  PARTICLE SYSTEM
// ═══════════════════════════════════════════════════════════
/**
 * Einfaches Pool-basiertes Partikel-System.
 * Partikel werden beim Einsammeln einer Münze gespawnt.
 * Pool verhindert häufige GC-Zyklen.
 */
export class ParticleSystem {
  constructor(scene) {
    this.scene   = scene;
    this._active = [];   // Aktive Partikel
    this._pool   = [];   // Inaktive (recyclebar)

    // Geteiltes Geo/Mat für alle Partikel
    this._geo    = new THREE.SphereGeometry(0.09, 5, 4);
    this._mat    = new THREE.MeshBasicMaterial({ color: 0xe2c94e, transparent: true });
  }

  /**
   * burst(position, count)
   * Spawnt `count` Partikel an `position` mit zufälligem Impuls.
   */
  burst(position, count = 10) {
    for (let i = 0; i < count; i++) {
      const p = this._getParticle();
      p.mesh.position.copy(position);
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 2.2 + Math.random() * 2.0;
      p.vx    = Math.cos(angle) * speed;
      p.vy    = 2.5 + Math.random() * 2.0;
      p.vz    = Math.sin(angle) * speed;
      p.life  = 0.6 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.mesh.visible = true;
      this._active.push(p);
    }
  }

  _getParticle() {
    if (this._pool.length > 0) return this._pool.pop();
    const mesh = new THREE.Mesh(this._geo, this._mat.clone());
    this.scene.add(mesh);
    return { mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1 };
  }

  update(dt) {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];
      p.life -= dt;

      if (p.life <= 0) {
        p.mesh.visible = false;
        this._pool.push(p);
        this._active.splice(i, 1);
        continue;
      }

      // Bewegung + Schwerkraft
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 9.5 * dt;

      // Opacity nach Leben faden
      const t = p.life / p.maxLife;
      p.mesh.material.opacity = t * t;

      // Scale-Down beim Verschwinden
      const s = 0.5 + t * 0.5;
      p.mesh.scale.setScalar(s);
    }
  }
}


// ═══════════════════════════════════════════════════════════
//  COIN SYSTEM
// ═══════════════════════════════════════════════════════════
/**
 * Verwaltet Münzen:
 *   - Spawn auf dem Spielfeld (zufällig)
 *   - PBR-Material mit Emissive-Glow (simuliert Bloom ohne Post-Processing)
 *   - Rotations- + Hover-Animation
 *   - Kollisionsprüfung mit Spieler
 *   - Burst-Effekt + Collect-Scale-Animation beim Einsammeln
 */
export class CoinSystem {
  constructor(scene, particles, uiSystem) {
    this.scene     = scene;
    this.particles = particles;
    this.ui        = uiSystem;
    this._coins    = [];   // { mesh, baseY, phase, collected }
    this._total    = 20;
    this._count    = 0;
  }

  get count()  { return this._count; }
  get total()  { return this._total; }

  spawn(count = 20, fieldW = 32, fieldD = 64) {
    // Alte entfernen
    this._coins.forEach(c => this.scene.remove(c.mesh));
    this._coins = [];
    this._count = 0;
    this._total = count;

    const geo = new THREE.TorusGeometry(0.3, 0.09, 12, 20);
    // PBR-Gold Material mit Emissive für Glow-Effekt
    const mat = new THREE.MeshStandardMaterial({
      color:             0xFFD700,
      roughness:         0.25,
      metalness:         0.85,
      emissive:          new THREE.Color(0xAA6600),
      emissiveIntensity: 0.45,
    });

    const hw = fieldW / 2, hd = fieldD / 2;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat.clone());
      const bx   = (Math.random() - 0.5) * (fieldW - 4);
      const bz   = (Math.random() - 0.5) * (fieldD - 4);
      mesh.position.set(bx, 0.9, bz);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this._coins.push({
        mesh,
        baseY:     0.9,
        phase:     Math.random() * Math.PI * 2,
        collected: false,
        // Einsammel-Animation
        collectTimer: 0,
        collecting:   false,
      });
    }

    this.ui.updateCoins(0, count);
  }

  /**
   * update(dt, elapsed, playerPos)
   * Animiert Münzen + prüft Kollision mit Spieler.
   * COLLECT_DIST: Radius in dem eine Münze eingesammelt wird.
   */
  update(dt, elapsed, playerPos) {
    const COLLECT_DIST = 1.5;

    for (const coin of this._coins) {
      if (coin.collected) continue;

      // Schwebeanimation (Sinus)
      coin.mesh.position.y = coin.baseY + Math.sin(elapsed * 2.2 + coin.phase) * 0.14;
      // Rotation
      coin.mesh.rotation.y = elapsed * 2.8;

      // Einsammel-Animation (Scale-Up + Fade)
      if (coin.collecting) {
        coin.collectTimer += dt;
        const t = coin.collectTimer / 0.3;
        coin.mesh.scale.setScalar(1 + t * 1.2);
        coin.mesh.material.opacity = Math.max(0, 1 - t * 2);
        if (coin.collectTimer >= 0.3) {
          coin.collected = true;
          this.scene.remove(coin.mesh);
        }
        continue;
      }

      // Emissive-Pulsieren (verstärkt Glow-Gefühl)
      coin.mesh.material.emissiveIntensity = 0.35 + Math.sin(elapsed * 3.5 + coin.phase) * 0.18;

      // Kollisionsprüfung
      const dx = coin.mesh.position.x - playerPos.x;
      const dz = coin.mesh.position.z - playerPos.z;
      if (Math.hypot(dx, dz) < COLLECT_DIST) {
        this._collect(coin);
      }
    }
  }

  _collect(coin) {
    this._count++;
    coin.collecting = true;
    coin.collectTimer = 0;
    coin.mesh.material.transparent = true;

    // Partikel-Burst an Münz-Position
    this.particles.burst(coin.mesh.position, 10);

    // UI aktualisieren
    this.ui.updateCoins(this._count, this._total);
  }

  allCollected() {
    return this._count >= this._total;
  }
}


// ═══════════════════════════════════════════════════════════
//  UI SYSTEM
// ═══════════════════════════════════════════════════════════
/**
 * Verwaltet das Heads-Up-Display:
 *   - Münzen-Zähler (mit Puls-Animation bei Einsammeln)
 *   - Gewinn-Banner
 *   - Zurück-Button
 *   - Mobile-responsive
 */
export class UISystem {
  constructor() {
    this._coinCountEl = document.getElementById('coin-count');
    this._coinTotalEl = document.getElementById('coin-total');
    this._winBanner   = document.getElementById('win-banner');
  }

  init() {
    // Back-Button: funktioniert sowohl im Launcher-iframe als auch direkt
    document.getElementById('back-btn').addEventListener('click', () => {
      if (window.parent && window.parent.showLauncher) {
        window.parent.showLauncher();
      } else {
        window.location.href = '../index.html';
      }
    });
    return this;
  }

  updateCoins(count, total) {
    this._coinCountEl.textContent = count;
    this._coinTotalEl.textContent = total;
    // Kurzer Puls-Effekt bei Einsammeln
    this._coinCountEl.style.transform = 'scale(1.4)';
    this._coinCountEl.style.color     = '#ffe066';
    setTimeout(() => {
      this._coinCountEl.style.transform = 'scale(1)';
      this._coinCountEl.style.color     = '#e2c94e';
    }, 200);
  }

  showWinBanner() {
    this._winBanner.style.display = 'block';
  }

  hideWinBanner() {
    this._winBanner.style.display = 'none';
  }
}
