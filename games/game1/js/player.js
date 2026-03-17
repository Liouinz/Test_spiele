/**
 * ============================================================
 * PLAYER MODULE  –  player.js
 * ============================================================
 * Verantwortlich für:
 *   - 3D-Charakter-Modell (Minecraft-Style, PBR Materialien)
 *   - Velocity-basierte Bewegung mit Beschleunigung + Friction
 *     → kein abruptes Stoppen, weiche Start/Stop-Übergänge
 *   - Gliedmaßen-Animation: Idle-Bobbing + Walk-Swing
 *   - Kollisionsgrenzen gegen Zaun/Weltrand
 *
 * Warum Velocity + Friction statt direktem Position-Update?
 *   Direktes Update: Position += Speed * Input
 *   → sofortiger Stopp, kein Spielgefühl
 *
 *   Velocity + Friction: Velocity += Accel * Input; Velocity *= Friction
 *   → weicher Anlauf, smooth Abbremsverhalten = deutlich besseres Game Feel
 *
 * Kollisionsgrenzen:
 *   Spieler wird am Zaun (±hw, ±hd) geclampt. Zaun ist ~0.5 Einheiten
 *   vom Spielfeld-Rand entfernt → unsichtbare Barrier hinter Holz.
 * ============================================================
 */

import { THREE } from './engine.js';
import { WORLD }  from './world.js';

// ─── Konstanten ──────────────────────────────────────────────
const ACCEL       = 28;    // Beschleunigung (Einheiten/s²)
const MAX_SPEED   = 7.0;   // Maximale Laufgeschwindigkeit
const FRICTION    = 8.5;   // Reibung – je höher, desto schneller Stopp
const COLL_MARGIN = 0.55;  // Kollisions-Puffer zum Zaun

// ─── Player-Klasse ───────────────────────────────────────────
export class Player {
  constructor(scene) {
    this.scene    = scene;
    this.group    = new THREE.Group();         // Wurzel-Objekt
    this.velocity = new THREE.Vector3();       // Aktuelle Geschwindigkeit
    this.facing   = 0;                         // Blickrichtung (Y-Rotation in rad)
    this._walkTime = 0;
    this._limbs   = {};   // Referenzen auf animierbare Pivots
    this._idleT   = 0;    // Idle-Animation-Timer
  }

  /**
   * build()
   * Konstruiert den Charakter aus BoxGeometries.
   * Alle Körperteile werden als eigene Meshes in einer Gruppe organisiert.
   * Arme und Beine haben Pivot-Groups mit Drehpunkt an Schulter/Hüfte.
   */
  build() {
    this._buildBody();
    this._buildHead();
    this._buildLimbs();
    this.group.position.set(0, 0, 0);
    this.scene.add(this.group);
    return this;
  }

  // ── Materialien ──────────────────────────────────────────
  _mat(color, roughness = 0.82, metalness = 0.0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  _matSkin()  { return this._mat(0xf5c99a, 0.80); }
  _matShirt() { return this._mat(0x1a6bb5, 0.75); }
  _matPants() { return this._mat(0x2c2c7a, 0.80); }
  _matHair()  { return this._mat(0x2e1a0a, 0.85); }
  _matShoes() { return this._mat(0x1a1008, 0.90); }
  _matEye()   { return new THREE.MeshBasicMaterial({ color: 0x111111 }); }
  _matMouth() { return new THREE.MeshBasicMaterial({ color: 0x8b2020 }); }

  // ── Körper ───────────────────────────────────────────────
  _buildBody() {
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.group.add(m);
      return m;
    };

    // Torso (Hemd)
    add(new THREE.BoxGeometry(0.52, 0.68, 0.30), this._matShirt(), 0, 0.90, 0);

    // Hüftband (leicht dunkler)
    add(new THREE.BoxGeometry(0.54, 0.10, 0.32), this._mat(0x1a1a5a), 0, 0.58, 0);
  }

  // ── Kopf ─────────────────────────────────────────────────
  _buildHead() {
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.group.add(m);
      return m;
    };

    // Kopf
    add(new THREE.BoxGeometry(0.52, 0.52, 0.52), this._matSkin(), 0, 1.48, 0);

    // Haare (oben + leicht über Stirn)
    add(new THREE.BoxGeometry(0.54, 0.18, 0.54), this._matHair(), 0,  1.76, 0);
    add(new THREE.BoxGeometry(0.54, 0.26, 0.10), this._matHair(), 0,  1.64, -0.30);  // Hinterkopf

    // Ohren
    add(new THREE.BoxGeometry(0.06, 0.18, 0.14), this._matSkin(), -0.29, 1.47, 0);
    add(new THREE.BoxGeometry(0.06, 0.18, 0.14), this._matSkin(),  0.29, 1.47, 0);

    // Augen
    const eyeGeo = new THREE.BoxGeometry(0.11, 0.09, 0.04);
    const eyeMat = this._matEye();
    add(eyeGeo, eyeMat, -0.13, 1.48, 0.27);
    add(eyeGeo, eyeMat,  0.13, 1.48, 0.27);

    // Augenbrauen
    const browGeo = new THREE.BoxGeometry(0.12, 0.04, 0.03);
    const browMat = this._matHair();
    add(browGeo, browMat, -0.13, 1.56, 0.27);
    add(browGeo, browMat,  0.13, 1.56, 0.27);

    // Nase
    add(new THREE.BoxGeometry(0.06, 0.06, 0.07), this._matSkin(), 0, 1.41, 0.28);

    // Mund
    add(new THREE.BoxGeometry(0.16, 0.04, 0.03), this._matMouth(), 0, 1.33, 0.27);
  }

  // ── Gliedmaßen (Pivot-Groups für Animation) ──────────────
  // pivot.position = Schulter/Hüft-Drehpunkt
  // mesh.position.y = -halbeGliedlänge (hängt nach unten)
  _buildLimbs() {
    const addPivot = (geo, mat, px, py, pz) => {
      const pivot = new THREE.Group();
      pivot.position.set(px, py, pz);
      const mesh  = new THREE.Mesh(geo, mat);
      // Mesh hängt nach unten vom Pivot
      mesh.position.y = -(geo.parameters.height / 2 + 0.01);
      mesh.castShadow = true;
      pivot.add(mesh);
      this.group.add(pivot);
      return pivot;
    };

    const armGeo  = new THREE.BoxGeometry(0.22, 0.62, 0.24);
    const foreGeo = new THREE.BoxGeometry(0.20, 0.30, 0.22);
    const legGeo  = new THREE.BoxGeometry(0.24, 0.58, 0.26);
    const shoeGeo = new THREE.BoxGeometry(0.26, 0.12, 0.30);

    // Arme (Schulter-Pivot)
    this._limbs.armL = addPivot(armGeo, this._matSkin(), -0.38, 1.22, 0);
    this._limbs.armR = addPivot(armGeo, this._matSkin(),  0.38, 1.22, 0);

    // Unterarme (am Ende der Arme – verschachtelt im Arm-Pivot)
    // Vereinfachung: Unterarme als feste Mesh unter Armstumpf
    // (Für echtes IK wäre das komplexer)

    // Beine (Hüft-Pivot)
    this._limbs.legL = addPivot(legGeo, this._matPants(), -0.15, 0.56, 0);
    this._limbs.legR = addPivot(legGeo, this._matPants(),  0.15, 0.56, 0);

    // Schuhe (hängen unter Beinen)
    const addShoe = (px, pz) => {
      const m = new THREE.Mesh(shoeGeo, this._matShoes());
      m.position.set(px, 0.06, pz + 0.03);
      m.castShadow = true;
      this.group.add(m);
      return m;
    };
    this._limbs.shoeL = addShoe(-0.15, 0);
    this._limbs.shoeR = addShoe( 0.15, 0);
  }

  /**
   * update(dt, inputDir, cameraH)
   *
   * inputDir: { x, z } normalisierter Eingabevektor (von InputSystem)
   * cameraH:  horizontaler Kamerawinkel (Bewegung relativ zur Kamera)
   *
   * Velocity-Formel:
   *   velocity += accel * input * dt
   *   velocity *= (1 - friction * dt)   // Exponentieller Abfall
   *   position += velocity * dt
   */
  update(dt, inputDir, cameraH) {
    this._applyMovement(dt, inputDir, cameraH);
    this._animate(dt, inputDir);
  }

  _applyMovement(dt, inputDir, cameraH) {
    const hasInput = Math.abs(inputDir.x) > 0.01 || Math.abs(inputDir.z) > 0.01;

    if (hasInput) {
      // Bewegungsrichtung relativ zur Kamera-Orientierung transformieren
      const wx =  inputDir.x * Math.cos(cameraH) + inputDir.z * Math.sin(cameraH);
      const wz = -inputDir.x * Math.sin(cameraH) + inputDir.z * Math.cos(cameraH);
      const len = Math.hypot(wx, wz) || 1;

      this.velocity.x += (wx / len) * ACCEL * dt;
      this.velocity.z += (wz / len) * ACCEL * dt;

      // Zielrichtung speichern (für Rotations-Animation)
      this.facing = Math.atan2(wx / len, wz / len);
    }

    // Friction (exponentieller Abfall)
    const frictionFactor = Math.max(0, 1 - FRICTION * dt);
    this.velocity.x *= frictionFactor;
    this.velocity.z *= frictionFactor;

    // Geschwindigkeit clampen
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > MAX_SPEED) {
      this.velocity.x = (this.velocity.x / speed) * MAX_SPEED;
      this.velocity.z = (this.velocity.z / speed) * MAX_SPEED;
    }

    // Sehr kleine Velocity auf 0 setzen (verhindert ewiges Gleiten)
    if (speed < 0.01) { this.velocity.x = this.velocity.z = 0; }

    // Position updaten
    this.group.position.x += this.velocity.x * dt;
    this.group.position.z += this.velocity.z * dt;

    // Kollision mit Zaun (AABB-Clamp)
    this.group.position.x = THREE.MathUtils.clamp(
      this.group.position.x,
      -WORLD.hw + COLL_MARGIN, WORLD.hw - COLL_MARGIN
    );
    this.group.position.z = THREE.MathUtils.clamp(
      this.group.position.z,
      -WORLD.hd + COLL_MARGIN, WORLD.hd - COLL_MARGIN
    );

    // Spieler dreht sich weich in Bewegungsrichtung
    if (hasInput) {
      let delta = this.facing - this.group.rotation.y;
      // Kürzester Drehweg
      while (delta >  Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      this.group.rotation.y += delta * Math.min(1.0, 12 * dt);
    }
  }

  _animate(dt, inputDir) {
    const speed   = Math.hypot(this.velocity.x, this.velocity.z);
    const isMoving = speed > 0.2;
    const l = this._limbs;

    if (isMoving) {
      // Lauf-Animation: Beine + Arme schwingen gegenphasig
      this._walkTime += dt * (6 + speed * 0.5);
      const swing = Math.sin(this._walkTime) * 0.45;

      l.legL.rotation.x  =  swing;
      l.legR.rotation.x  = -swing;
      l.armL.rotation.x  = -swing * 0.55;
      l.armR.rotation.x  =  swing * 0.55;

      // Leichtes Körper-Bobbing (auf-ab)
      this.group.position.y = Math.abs(Math.sin(this._walkTime * 2)) * 0.04;

      // Schuhe folgen den Beinen
      l.shoeL.position.y = 0.06 + Math.sin(this._walkTime)       * 0.04;
      l.shoeR.position.y = 0.06 + Math.sin(this._walkTime + Math.PI) * 0.04;

    } else {
      // Idle-Animation: leichtes Atmen (Körper auf-ab, Arme minimal)
      this._idleT += dt * 1.4;
      const breathe = Math.sin(this._idleT) * 0.018;

      // Gleitend zurück zur Ruheposition
      l.legL.rotation.x *= 0.80;
      l.legR.rotation.x *= 0.80;
      l.armL.rotation.x  = breathe * 0.3 + l.armL.rotation.x * 0.80;
      l.armR.rotation.x  = breathe * 0.3 + l.armR.rotation.x * 0.80;
      this.group.position.y = breathe;
      l.shoeL.position.y = 0.06;
      l.shoeR.position.y = 0.06;
    }
  }

  /** Gibt die aktuelle Weltposition zurück */
  getPosition() {
    return this.group.position;
  }
}
